import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { bumpContentVersion } from "@/lib/content-version";
import { prisma } from "@/lib/db";
import {
  buildMediaKey,
  ImageRejected,
  maxUploadBytes,
  normalizeFolder,
  optimizeImage,
} from "@/lib/image";
import { assertSameOrigin } from "@/lib/http";
import { getStorage, storageConfigured } from "@/lib/storage";

/** Batas baris per halaman supaya picker tidak pernah menarik ribuan aset. */
const PAGE_SIZE = 60;
const MAX_PAGE_SIZE = 120;
/** Maksimum file per sekali unggah; mencegah satu request menahan memori lama. */
const MAX_FILES = 10;
/**
 * Batas total per request, dipakai untuk pre-check `Content-Length`.
 * Disamakan dengan `experimental.proxyClientMaxBodySize` di next.config.ts
 * (100MB): kalau route mengizinkan lebih dari limit proxy, body dipotong
 * diam-diam dan `request.formData()` gagal parse dengan 400 yang
 * membingungkan. 100MB cukup untuk 10 foto kamera HP (~3-8MB per file).
 */
const MAX_TOTAL_UPLOAD_BYTES = 100 * 1024 * 1024;

/**
 * Daftar aset untuk picker gambar.
 *
 * Hanya aset yang sudah tersimpan yang dikembalikan — sesuai konsep galeri:
 * editor kategori/detail memanggil gambar yang sudah diunggah, bukan mengunggah
 * baru dari sana.
 */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  const url = new URL(request.url);
  const term = (url.searchParams.get("q") ?? "").trim().slice(0, 120);
  const folder = (url.searchParams.get("folder") ?? "").trim().slice(0, 80);
  const requestedPage = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);

  const where = {
    ...(folder ? { folder } : {}),
    ...(term
      ? {
          OR: [
            { filename: { contains: term, mode: "insensitive" as const } },
            { alt: { contains: term, mode: "insensitive" as const } },
            { folder: { contains: term, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  // Hitung total dulu supaya `page` bisa dibatasi ke halaman terakhir. Tanpa ini,
  // `?page=999999999` memaksa OFFSET sangat besar (mahal) di database.
  const total = await prisma.mediaAsset.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);

  const assets = await prisma.mediaAsset.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: Math.min(PAGE_SIZE, MAX_PAGE_SIZE),
    skip: (page - 1) * PAGE_SIZE,
    select: {
      id: true,
      url: true,
      filename: true,
      alt: true,
      mime: true,
      width: true,
      height: true,
      folder: true,
      derivedFromId: true,
    },
  });

  return NextResponse.json({
    assets,
    total,
    page,
    pageSize: PAGE_SIZE,
    hasMore: page * PAGE_SIZE < total,
  });
}

/**
 * Upload galeri.
 *
 * Route handler, bukan Server Action, karena body Server Action dibatasi 1MB
 * (lihat `serverActions.bodySizeLimit` di docs Next) sementara foto dari
 * kamera HP jauh di atas itu. Menaikkan limit global justru membuka
 * permukaan DoS di setiap action, jadi upload diarahkan ke sini saja.
 */
export async function POST(request: Request) {
  const crossSite = assertSameOrigin(request);
  if (crossSite) return crossSite;

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }
  if (!storageConfigured()) {
    return NextResponse.json(
      { error: "Konfigurasi storage belum lengkap. Isi S3_* di .env lalu restart." },
      { status: 500 },
    );
  }

  // Tolak lebih awal berdasar `Content-Length` sebelum body di-buffer ke memori.
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  const maxTotal = Math.min(maxUploadBytes() * MAX_FILES, MAX_TOTAL_UPLOAD_BYTES);
  if (Number.isFinite(declaredLength) && declaredLength > maxTotal) {
    return NextResponse.json(
      { error: "Total ukuran unggahan terlalu besar." },
      { status: 413 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Permintaan tidak bisa dibaca." }, { status: 400 });
  }

  const files = form.getAll("file").filter((v): v is File => v instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "Tidak ada file yang dikirim." }, { status: 400 });
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json(
      { error: `Maksimum ${MAX_FILES} file per unggahan.` },
      { status: 400 },
    );
  }

  const alt = String(form.get("alt") ?? "").slice(0, 300);
  const folder = normalizeFolder(String(form.get("folder") ?? ""));

  const storage = getStorage();
  const saved: { id: string; url: string; filename: string }[] = [];
  const failures: { name: string; error: string }[] = [];

  for (const file of files) {
    let key: string | null = null;
    try {
      const input = Buffer.from(await file.arrayBuffer());
      const image = await optimizeImage(input, file.type);

      key = buildMediaKey(file.name, image.extension);
      const objectKey = folder ? `${folder}/${key}` : key;
      const put = await storage.put(objectKey, image.body, image.mime);

      const row = await prisma.mediaAsset.create({
        data: {
          filename: file.name.slice(0, 255),
          url: put.url,
          mime: image.mime,
          size: image.bytes,
          width: image.width,
          height: image.height,
          alt,
          folder: folder || "uploads",
        },
        select: { id: true, url: true, filename: true },
      });

      saved.push(row);
      key = null; // Berhasil penuh, jangan dihapus di finally.
    } catch (e) {
      // Objek sudah ter-upload tapi insert DB gagal: file akan menggantung di
      // bucket tanpa jejak. R2 tidak punya versioning, jadi file yatim tidak
      // bisa dikembalikan — kita hapus sekarang.
      if (key) {
        const objectKey = folder ? `${folder}/${key}` : key;
        await storage.remove(objectKey).catch(() => {});
      }
      failures.push({
        name: file.name,
        error: e instanceof ImageRejected ? e.message : "Gagal menyimpan file.",
      });
    }
  }

  if (saved.length === 0) {
    return NextResponse.json(
      { error: failures[0]?.error ?? "Tidak ada file yang berhasil disimpan." },
      { status: 400 },
    );
  }

  await bumpContentVersion();

  return NextResponse.json({ saved, failures }, { status: failures.length ? 207 : 201 });
}
