/**
 * Migrasi gambar lawas WordPress (URL `holidaybanyuwangi.com/wp-content/
 * uploads/...` yang masih tersimpan di database) ke Cloudflare R2.
 *
 * Kenapa: setelah domain menunjuk ke Vercel, path `/wp-content/*` tidak
 * dilayani siapa pun (403/404), sehingga seluruh gambar referensi itu putus.
 * Script ini menyalin filenya ke R2 lalu menulis ulang URL di database
 * menjadi path relatif `/uploads/wp-legacy/...` — mengikuti konvensi media
 * aplikasi (route `/uploads/[...key]` me-redirect ke domain bucket publik,
 * jadi mengganti `S3_PUBLIC_URL` nanti tetap otomatis ikut).
 *
 * Sumber file (pilih satu):
 *   --source <dir>    Salinan folder `wp-content/uploads` (hasil download
 *                     dari file manager hosting WordPress lama). Struktur
 *                     `wp-content/uploads/2026/...`, `uploads/2026/...`,
 *                     atau langsung `2026/...` semuanya dikenali.
 *   --from-url <base> Base URL hosting lama yang masih bisa mengunduh
 *                     file (mis. `http://IP-atau-subdomain-lama`).
 *
 * Mode default: DRY-RUN (hanya melaporkan rencana & file yang tidak ada).
 * Tambahkan `--apply` untuk benar-benar mengunggah & mengubah database.
 *
 * Jalankan (env R2 + DATABASE_URL harus terisi, bisa lewat `set "..."&&`):
 *   npx tsx scripts/migrate-legacy-images.ts --source E:\backup\uploads
 *   npx tsx scripts/migrate-legacy-images.ts --source E:\backup\uploads --apply
 *
 * Aman dijalankan berulang: file yang sudah ada di R2 dilewati dan URL yang
 * sudah diganti tidak ditemukan lagi di database (jadi tidak diubah).
 */
import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { prisma } from "../src/lib/db";

/* ------------------------------------------------------------------ */
/* Klien R2 (sengaja tidak lewat src/lib/storage.ts: modul itu memakai  */
/* "server-only" yang melempar error saat dijalankan di luar Next).     */
/* ------------------------------------------------------------------ */

const bucket = process.env.S3_BUCKET;
const s3 = new S3Client({
  region: process.env.S3_REGION ?? "auto",
  ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT } : {}),
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
  },
});

/* ------------------------------------------------------------------ */
/* Model yang bisa menyimpan URL gambar (semua punya kolom `id`).       */
/* ------------------------------------------------------------------ */

const MODELS = [
  "SiteSettings",
  "InstagramPost",
  "HtmlPage",
  "HomeStat",
  "Testimonial",
  "Category",
  "Benefit",
  "Package",
  "CardDay",
  "CardPrice",
  "FacilityPill",
  "PackageSchedule",
  "ItineraryDay",
  "TimelineItem",
  "FacilityGroup",
  "FacilityItem",
  "Pricing",
  "PriceColumn",
  "PriceRow",
  "PriceValue",
  "PriceItem",
  "GalleryImage",
  "HomeGalleryImage",
  "PackageNote",
  "MediaAsset",
] as const;

const WP_URL =
  /https?:\/\/(?:www\.)?holidaybanyuwangi\.com\/wp-content\/uploads\/([^\s"'\\)<>]+)/g;

const IMAGE_EXT = new Set([".webp", ".jpg", ".jpeg", ".png", ".avif", ".gif"]);

/* ------------------------------------------------------------------ */
/* CLI                                                                 */
/* ------------------------------------------------------------------ */

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const APPLY = process.argv.includes("--apply");
const sourceDir = arg("source");
const fromUrl = arg("from-url")?.replace(/\/+$/, "");
if (!sourceDir && !fromUrl) {
  console.error(
    "Pilih sumber: --source <dir> atau --from-url <base>. Tambah --apply untuk eksekusi.",
  );
  process.exit(1);
}
if (!bucket || !process.env.S3_PUBLIC_URL) {
  console.error("Env R2 (S3_BUCKET, S3_PUBLIC_URL, dsb.) belum lengkap.");
  process.exit(1);
}

/** Coba temukan file di `--source` dengan beberapa kandidat lokasi. */
async function readLocal(rel: string): Promise<Buffer | null> {
  const root = sourceDir!;
  const candidates = [
    path.join(root, rel), // <root>/wp-content/uploads/... (asli)
    path.join(root, "wp-content", "uploads", rel),
    path.join(root, "uploads", rel),
    path.join(root, rel.replace(/^\/+/, "")),
    path.join(root, path.basename(rel)),
  ];
  for (const c of candidates) {
    try {
      return await fs.readFile(c);
    } catch {
      /* coba berikutnya */
    }
  }
  return null;
}

async function readRemote(rel: string): Promise<Buffer | null> {
  try {
    const res = await fetch(`${fromUrl}/wp-content/uploads/${rel}`, {
      headers: { "User-Agent": "CMSHoliday-Migrate/1.0" },
    });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

async function existsOnR2(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Rewriting rekursif di semua field tiap model                        */
/* ------------------------------------------------------------------ */

/** Daftar [model, id, field, nilaiBaru] yang perlu di-update. */
type Fix = {
  model: (typeof MODELS)[number];
  id: string;
  field: string;
  value: unknown;
};

function rewriteValue(v: unknown, map: Map<string, string>, hits: string[]): unknown {
  if (typeof v === "string") {
    let out = v;
    for (const [oldUrl, newUrl] of map) {
      if (out.includes(oldUrl)) {
        out = out.split(oldUrl).join(newUrl);
        hits.push(oldUrl);
      }
    }
    return out;
  }
  if (Array.isArray(v)) {
    let changed = false;
    const next = v.map((item) => {
      const r = rewriteValue(item, map, hits);
      if (r !== item) changed = true;
      return r;
    });
    return changed ? next : v;
  }
  if (v && typeof v === "object") {
    let changed = false;
    const next: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      const r = rewriteValue(val, map, hits);
      if (r !== val) changed = true;
      next[k] = r;
    }
    return changed ? next : v;
  }
  return v;
}

async function collectFixes(map: Map<string, string>): Promise<Fix[]> {
  const fixes: Fix[] = [];
  for (const model of MODELS) {
    // @ts-expect-error akses model dinamis
    const rows = await prisma[model].findMany();
    for (const row of rows as Record<string, unknown>[]) {
      for (const [field, value] of Object.entries(row)) {
        if (field === "id") continue;
        const hits: string[] = [];
        const next = rewriteValue(value, map, hits);
        if (hits.length > 0) {
          fixes.push({ model, id: row.id as string, field, value: next });
        }
      }
    }
  }
  return fixes;
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

async function main() {
  // 1. Kumpulkan URL unik dari database.
  const urls = new Set<string>();
  for (const model of MODELS) {
    // @ts-expect-error akses model dinamis
    const rows = await prisma[model].findMany();
    for (const row of rows) {
      const s = JSON.stringify(row);
      for (const m of s.matchAll(WP_URL)) {
        urls.add(m[0]);
      }
    }
  }
  const list = [...urls].sort();
  console.log(`URL gambar lawas unik di database: ${list.length}`);
  if (list.length === 0) {
    console.log("Tidak ada yang perlu dimigrasi.");
    return;
  }

  // 2. Salin ke R2 dengan key deterministik `wp-legacy/<path di uploads>`.
  const map = new Map<string, string>(); // URL lama -> URL baru (/uploads/...)
  let uploaded = 0;
  let skipped = 0;
  const missing: string[] = [];

  for (const url of list) {
    const rel = url.replace(
      /https?:\/\/(?:www\.)?holidaybanyuwangi\.com\/wp-content\/uploads\//,
      "",
    );
    const ext = path.extname(rel).toLowerCase();
    if (!IMAGE_EXT.has(ext)) {
      console.warn(`  lewati (bukan gambar): ${rel}`);
      continue;
    }
    const key = `wp-legacy/${rel}`;
    const newUrl = `/uploads/${key}`;

    if (await existsOnR2(key)) {
      skipped++;
      map.set(url, newUrl);
      console.log(`  sudah ada di R2: ${rel}`);
      continue;
    }

    const body = (await readLocal(rel)) ?? (fromUrl ? await readRemote(rel) : null);
    if (!body) {
      missing.push(rel);
      continue;
    }
    if (!APPLY) {
      console.log(`  [dry-run] akan unggah: ${rel} (${body.length} bytes)`);
      map.set(url, newUrl);
      continue;
    }
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType:
          ext === ".webp"
            ? "image/webp"
            : ext === ".png"
              ? "image/png"
              : ext === ".gif"
                ? "image/gif"
                : ext === ".avif"
                  ? "image/avif"
                  : "image/jpeg",
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
    uploaded++;
    map.set(url, newUrl);
    console.log(`  unggah: ${rel}`);
  }

  // 3. Lapor file yang tidak ditemukan (URL TIDAK diganti agar tidak salah
  //    menunjuk ke objek kosong).
  if (missing.length > 0) {
    console.warn(`\nFile tidak ditemukan di sumber (${missing.length}) — URL dibiarkan:`);
    for (const m of missing) console.warn(`  - ${m}`);
  }

  // 4. Tulis ulang URL di database.
  const fixes = await collectFixes(map);
  console.log(`\nPerubahan database: ${fixes.length} field pada ${new Set(fixes.map((f) => f.model)).size} model`);
  if (APPLY) {
    for (const f of fixes) {
      // @ts-expect-error akses model dinamis
      await prisma[f.model].update({
        where: { id: f.id },
        data: { [f.field]: f.value },
      });
    }
    console.log("Database diperbarui.");
  } else {
    console.log("(dry-run — jalankan lagi dengan --apply untuk menulis)");
  }

  console.log(
    `\nRingkasan: unggah=${APPLY ? uploaded : `[dry-run] ${map.size - skipped}`}, sudah ada=${skipped}, hilang=${missing.length}, field diganti=${fixes.length}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
