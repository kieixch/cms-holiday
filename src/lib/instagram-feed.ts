/**
 * Feed Instagram untuk seksi beranda.
 *
 * Sumber datanya **Meta Graph API resmi** (`GET /{ig-user-id}/media`),
 * bukan scraping halaman profil — halaman itu menyajikan login wall dan
 * endpoint `web_profile_info`-nya dibatasi 429, jadi tidak bisa diandalkan.
 *
 * Alurnya:
 *
 *   1. `ensureFresh()` menarik postingan terbaru (TTL 10 menit) lalu menyimpannya
 *      ke tabel `InstagramPost`. Sinkronisasi hanya jalan kalau `IG_USER_ID` +
 *      `IG_ACCESS_TOKEN` terisi; tanpa keduanya situs tetap tampil (grid kosong).
 *   2. `getInstagramFeed()` membaca dari database — halaman publik dan endpoint
 *      `/api/instagram-feed` tidak pernah menunggu Graph API secara langsung.
 *
 * Kenapa perlu sinkronisasi rutin: `media_url` untuk VIDEO hanya valid ±24 jam,
 * jadi TTL 10 menit (dihitung saat ada kunjungan) menjaga URL tetap segar.
 *
 * Kegagalan memakai backoff eksponensial (10 → 20 → 40 → 80 menit) supaya token
 * yang salah tidak membanjiri log, dan `contentVersion` hanya dinaikkan kalau
 * isi database benar-benar berubah — halaman publik lalu auto-refresh sendiri.
 */
import "server-only";

import { bumpContentVersion } from "./content-version";
import { prisma } from "./db";

const GRAPH_API = "https://graph.facebook.com/v23.0";
/**
 * Postingan per batch: 4 kolom × 2 baris. Halaman beranda merender satu batch
 * pertama di server, endpoint `/api/instagram-feed` menambah satu batch per
 * klik tombol "Muat Lebih Banyak".
 */
export const IG_BATCH = 8;
/** Postingan yang ditarik per sinkronisasi (grid + beberapa batch load-more). */
const FETCH_LIMIT = 50;
/** Jarak minimal antar percobaan sinkronisasi saat sukses. */
const TTL_MS = 10 * 60_000;

export type InstagramPostData = {
  id: string;
  permalink: string;
  caption: string;
  /** Sudah memilih thumbnail untuk VIDEO — aman dipakai langsung sebagai `src`. */
  imageUrl: string | null;
};

type GraphMedia = {
  id?: string;
  caption?: string;
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
};

type Credentials = { userId: string; token: string };

/** Nilai env kadang ikut terbawa tanda kutip dari `.env`; dibersihkan di sini. */
function clean(value: string | undefined): string {
  return (value ?? "").trim().replace(/^["']|["']$/g, "");
}

function readCredentials(): Credentials | null {
  const userId = clean(process.env.IG_USER_ID);
  const token = clean(process.env.IG_ACCESS_TOKEN);
  if (!userId || !token) return null;
  return { userId, token };
}

let lastAttemptAt = 0;
let failures = 0;

/**
 * Tarik postingan terbaru kalau cache sudah kedaluwarsa.
 *
 * Sengaja juga dipanggil saat `next build`: beranda di-SSG dari tabel
 * `InstagramPost`, jadi kalau sinkronisasi menunggu runtime, halaman bisa
 * ter-cache selama satu siklus revalidate dengan grid kosong. Kegagalan
 * (Graph API/DB tidak terjangkau dari mesin build) ditangkap di sini sehingga
 * build tetap lanjut dengan isi tabel apa adanya.
 *
 * Aman dipanggil berulang: percobaan dicatat lebih dulu (dan digandakan saat
 * gagal) supaya beberapa request paralel tidak ikut menarik API bersamaan.
 */
export async function ensureFresh(): Promise<void> {
  const now = Date.now();
  const backoff = TTL_MS * Math.min(2 ** failures, 8);
  if (now - lastAttemptAt < backoff) return;
  lastAttemptAt = now;

  if (!readCredentials()) return;

  try {
    const changed = await pull();
    failures = 0;
    if (changed) await bumpContentVersion();
  } catch (error) {
    failures += 1;
    console.error("[instagram-feed] sinkronisasi gagal:", redactToken(error));
  }
}

/**
 * Sembunyikan `access_token` sebelum error dicatat.
 *
 * Error dari `fetch()` bisa membawa URL lengkap — termasuk yang sedang kita
 * cegat di komentar lama, Next.js sendiri menyematkan URL fetch di pesan
 * "Dynamic server usage" / "Page changed from static to dynamic". Karena itu
 * redaksinya dilakukan di sini, bukan hanya dengan "tidak mencetak URL".
 */
function redactToken(error: unknown): string {
  const raw =
    error instanceof Error
      ? [error.name, error.message, error.stack ?? ""].join(" ")
      : String(error);
  return raw.replace(/([?&]access_token=)[^&\s"']+/gi, "$1***");
}

/** Tarik `{ig-user-id}/media` lalu samakan isi tabel. True = ada perubahan. */
async function pull(): Promise<boolean> {
  const credentials = readCredentials();
  if (!credentials) return false;

  const params = new URLSearchParams({
    fields: "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp",
    limit: String(FETCH_LIMIT),
    access_token: credentials.token,
  });
  const res = await fetch(`${GRAPH_API}/${credentials.userId}/media?${params}`, {
    // `revalidate` > 0 supaya sinkronisasi yang berjalan saat `next build`
    // tidak menandai halaman jadi dynamic (fetch `no-store` saat prerender
    // akan melempar "dynamic server usage"). Kebaruan datanya tetap terjaga:
    // `ensureFresh()` hanya menarik setiap TTL 10 menit, sama dengan nilai ini.
    next: { revalidate: TTL_MS / 1000 },
  });
  if (!res.ok) throw new Error(`Graph API merespons HTTP ${res.status}`);

  const payload = (await res.json()) as { data?: GraphMedia[] };
  if (!Array.isArray(payload.data)) {
    throw new Error("Graph API tidak mengembalikan field `data`.");
  }

  const incoming = payload.data
    .filter((media): media is GraphMedia & { id: string; permalink: string } =>
      Boolean(media.id && media.permalink),
    )
    .map((media) => ({
      igId: media.id,
      caption: (media.caption ?? "").trim(),
      mediaType: media.media_type ?? "IMAGE",
      mediaUrl: media.media_url ?? null,
      thumbnailUrl: media.thumbnail_url ?? null,
      permalink: media.permalink,
      takenAt: media.timestamp ? new Date(media.timestamp) : new Date(),
    }));

  const existing = await prisma.instagramPost.findMany();
  const byId = new Map(existing.map((row) => [row.igId, row]));
  let changed = false;

  for (const row of incoming) {
    const prev = byId.get(row.igId);
    if (!prev) {
      await prisma.instagramPost.create({ data: row });
      changed = true;
      continue;
    }
    const same =
      prev.caption === row.caption &&
      prev.mediaType === row.mediaType &&
      prev.mediaUrl === row.mediaUrl &&
      prev.thumbnailUrl === row.thumbnailUrl &&
      prev.permalink === row.permalink &&
      prev.takenAt.getTime() === row.takenAt.getTime();
    if (!same) {
      await prisma.instagramPost.update({ where: { id: prev.id }, data: row });
      changed = true;
    }
  }

  // Postingan yang keluar dari batch terbaru (atau dihapus di Instagram) ikut
  // dibersihkan supaya grid tidak pernah menampilkan tautan mati.
  const keep = new Set(incoming.map((row) => row.igId));
  const stale = existing.filter((row) => !keep.has(row.igId)).map((row) => row.id);
  if (stale.length > 0) {
    await prisma.instagramPost.deleteMany({ where: { id: { in: stale } } });
    changed = true;
  }

  return changed;
}

/**
 * Baca postingan untuk ditampilkan.
 *
 * `skip` / `take` dipakai grid 4 kolom × 2 baris (8 per batch) dan tombol
 * "Muat Lebih Banyak" yang selalu menambah satu batch berikutnya.
 */
export async function getInstagramFeed(
  skip: number,
  take: number,
): Promise<{ posts: InstagramPostData[]; total: number }> {
  await ensureFresh();

  const safeSkip = Math.max(0, Math.floor(skip));
  const safeTake = Math.min(Math.max(1, Math.floor(take)), 24);

  const [rows, total] = await Promise.all([
    prisma.instagramPost.findMany({
      orderBy: { takenAt: "desc" },
      skip: safeSkip,
      take: safeTake,
    }),
    prisma.instagramPost.count(),
  ]);

  return { posts: rows.map(toPublic), total };
}

function toPublic(row: {
  id: string;
  permalink: string;
  caption: string;
  mediaType: string;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
}): InstagramPostData {
  const image =
    row.mediaType === "VIDEO"
      ? (row.thumbnailUrl ?? row.mediaUrl)
      : (row.mediaUrl ?? row.thumbnailUrl);
  return {
    id: row.id,
    permalink: row.permalink,
    caption: row.caption,
    imageUrl: image,
  };
}
