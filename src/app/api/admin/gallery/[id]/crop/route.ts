import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { bumpContentVersion } from "@/lib/content-version";
import { prisma } from "@/lib/db";
import { cropImage, managedKeyFromUrl, normalizeFolder } from "@/lib/image";
import { assertSameOrigin } from "@/lib/http";
import { getStorage } from "@/lib/storage";

/** Batas sisi terpanjang hasil suntingan, sama seperti batas unggah. */
const MAX_EDGE = 2400;
/** Rotasi yang diizinkan. 90 derajat adalah kelipatan aman untuk JPEG/WebP. */
const ROTATIONS = [0, 90, 180, 270] as const;

/**
 * Crop / zoom / putar satu aset galeri.
 *
 * Hasilnya selalu aset BARU, bukan file yang ditimpa. Alasannya dua: R2 tidak
 * punya versioning sehingga `remove` tidak bisa dibatalkan, dan admin sering
 * perlu kembali ke versi penuh setelah memotong.
 *
 * Client hanya mengirim kotak crop dan sudut putar, bukan gambarnya, jadi batas
 * 1MB body tidak relevan di sini dan tidak perlu dinaikkan secara global.
 * Sumber dibaca dari storage memakai key yang sudah tersimpan.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const crossSite = assertSameOrigin(request);
  if (crossSite) return crossSite;

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  const { id } = await ctx.params;

  const asset = await prisma.mediaAsset.findUnique({ where: { id } });
  if (!asset) {
    return NextResponse.json({ error: "Gambar sudah tidak ada." }, { status: 404 });
  }
  if (!asset.width || !asset.height) {
    return NextResponse.json({ error: "Dimensi gambar tidak diketahui." }, { status: 422 });
  }

  let body: { x?: unknown; y?: unknown; w?: unknown; h?: unknown; rotation?: unknown; alt?: unknown; folder?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Body harus berupa JSON." }, { status: 400 });
  }

  const num = (v: unknown): number | null => {
    const n = typeof v === "number" ? v : Number.parseFloat(String(v));
    return Number.isFinite(n) ? n : null;
  };

  const x = num(body.x);
  const y = num(body.y);
  const w = num(body.w);
  const h = num(body.h);

  if (x === null || y === null || w === null || h === null || w < 1 || h < 1) {
    return NextResponse.json({ error: "Kotak crop tidak valid." }, { status: 400 });
  }

  const rotationRaw = num(body.rotation) ?? 0;
  const rotation = (ROTATIONS as readonly number[]).includes(rotationRaw) ? rotationRaw : 0;

  // Toleransi 1px untuk pembulatan float di client.
  if (x < -1 || y < -1 || x + w > asset.width + 1 || y + h > asset.height + 1) {
    return NextResponse.json({ error: "Kotak crop melebihi batas gambar." }, { status: 400 });
  }

  const key = managedKeyFromUrl(asset.url);
  if (!key) {
    return NextResponse.json(
      {
        error:
          "Gambar ini berasal dari impor lama dan filenya tidak ada di storage kita, " +
          "jadi tidak bisa disunting di sini.",
      },
      { status: 422 },
    );
  }

  const alt = String(body.alt ?? "").slice(0, 300);
  const folder = normalizeFolder(String(body.folder ?? asset.folder ?? ""));

  try {
    const source = await getStorage().get(key);
    const result = await cropImage(source, {
      left: Math.round(x),
      top: Math.round(y),
      width: Math.round(w),
      height: Math.round(h),
      rotation,
      maxEdge: MAX_EDGE,
    });

    const newKey = buildDerivativeKey(asset.filename);
    const put = await getStorage().put(newKey, result.body, result.mime);

    try {
      const row = await prisma.mediaAsset.create({
        data: {
          filename: asset.filename.replace(/\.[a-z0-9]+$/i, "") + "-suntingan.webp",
          url: put.url,
          mime: result.mime,
          size: result.bytes,
          width: result.width,
          height: result.height,
          alt: alt || asset.alt,
          folder: folder || "uploads",
          derivedFromId: asset.id,
        },
        select: { id: true, url: true, width: true, height: true, size: true },
      });

      await bumpContentVersion();

      return NextResponse.json({ asset: row }, { status: 201 });
    } catch (e) {
      // Objek sudah masuk bucket tapi insert DB gagal. R2 tidak punya versioning
      // jadi file tidak bisa dipulihkan; kita hapus sekarang daripada
      // meninggalkan objek yatim yang tidak pernah muncul di galeri.
      await getStorage()
        .remove(newKey)
        .catch(() => {});
      throw e;
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Gagal menyimpan hasil suntingan." },
      { status: 500 },
    );
  }
}

/**
 * Kunci untuk hasil suntingan.
 *
 * Folder asal dipertahankan supaya hasil suntingan tetap mengelompok dengan
 * induknya, dan suffix acak memastikan URL baru setiap kali admin menyimpan,
 * karena Cache-Control-nya immutable.
 */
function buildDerivativeKey(filename: string): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const base =
    filename
      .replace(/\.[^.]+$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "gambar";
  return `${yyyy}/${mm}/${base}-suntingan-${crypto.randomUUID().slice(0, 8)}.webp`;
}