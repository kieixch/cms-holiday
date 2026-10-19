import sharp from "sharp";

/**
 * Optimasi gambar sebelum diunggah.
 *
 * Semua fotolegacy datang dari WordPress dalam ukuran mentah (sering 2000-4000px
 * dan 1-3 MB). Disimpan apa adanya, kuota 10 GB R2 habis dalam hitungan bulan.
 * Jadi kita resize + konversi ke WebP di server sebelum objek masuk bucket.
 *
 * Catatan keamanan: SVG ditolak. SVG yang disajikan dari domain sendiri adalah
 * stored XSS — bisa memuat <script> yang dieksekusi di origin kita.
 */

const ALLOWED = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/avif", "avif"],
  ["image/gif", "gif"],
]);

/**
 * Batas-batas pemrosesan gambar.
 *
 * Dibaca saat dipanggil, bukan sekali di module load, supaya bisa diuji dan
 * bisa diubah tanpa restart. Nilai default untuk kasus umum.
 */
function limits() {
  return {
    /** Dimensi terpanjang. 2400px masih tajam untuk hero full-width di retina. */
    maxEdge: Number(process.env.MEDIA_MAX_EDGE ?? 2400),
    /**
     * Batas jumlah piksel total: guard terhadap decompression bomb.
     *
     * Pertahanan sesungguhnya adalah `limitInputPixels` milik sharp, yang
     * dipakai saat decode. Cek eksplisit di bawah hanya lapisan kedua.
     */
    maxPixels: Number(process.env.MEDIA_MAX_PIXELS ?? 50_000_000),
    /** Batas ukuran file masuk, sebelum diproses. */
    maxInputBytes: Number(process.env.MEDIA_MAX_BYTES ?? 25 * 1024 * 1024),
    quality: Number(process.env.MEDIA_WEBP_QUALITY ?? 82),
  };
}

/**
 * Tipe metadata sharp tidak bisa ditulis `sharp.Metadata` karena diekspor lewat
 * `export =` di dalam namespace, bukan named export. Jadi diturunkan dari
 * return type method-nya supaya tetap ikut berubah kalau upstream berubah.
 */
type ImageMetadata = Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;

export type OptimizedImage = {
  body: Buffer;
  mime: string;
  extension: string;
  width: number;
  height: number;
  /** Ukuran sebelum optimasi, untuk ditampilkan di UI. */
  originalBytes: number;
  bytes: number;
};

export function isAllowedImageType(mime: string): boolean {
  return ALLOWED.has(mime.toLowerCase());
}

/** Daftar MIME yang diterima, untuk pesan error di form upload. */
export const ACCEPTED_IMAGE_TYPES = [...ALLOWED.keys()];

export class ImageRejected extends Error {}

/**
 * Resize + konversi ke WebP.
 *
 * Gambus di-flatten jadi satu frame: foto animasi (GIF) memang hal yang tak
 * lazim di katalog travel, dan encoding WebP animasi jauh lebih lambat.
 */
export async function optimizeImage(input: Buffer, mime: string): Promise<OptimizedImage> {
  const L = limits();
  const normalized = mime.toLowerCase();
  if (!isAllowedImageType(normalized)) {
    throw new ImageRejected(
      `Format ${normalized || "tidak dikenal"} tidak didukung. Gunakan JPEG, PNG, WebP, AVIF, atau GIF.`,
    );
  }

  if (input.byteLength === 0) {
    throw new ImageRejected("File kosong.");
  }
  if (input.byteLength > L.maxInputBytes) {
    throw new ImageRejected(
      `Ukuran file ${mb(input.byteLength)} melebihi batas ${mb(L.maxInputBytes)}.`,
    );
  }

  const image = sharp(input, { failOn: "error", limitInputPixels: L.maxPixels });

  let meta: ImageMetadata;
  try {
    meta = await image.metadata();
  } catch (e) {
    // sharp menolak pixel-bom lewat limitInputPixels di dalam metadata(), jadi
    // error itu kita tangkap kasar sebagai "rusak" akan menyesatkan — foto
    // besar yang sah tetap bisa ditolak dengan pesan yang jelas.
    const msg = e instanceof Error ? e.message : String(e);
    if (/pixel limit|exceeds/i.test(msg)) {
      throw new ImageRejected(
        `Dimensi gambar melebihi batas ${L.maxPixels.toLocaleString("id-ID")} piksel. Kompres dulu atau perkecil resolusinya.`,
      );
    }
    throw new ImageRejected("File gambar tidak bisa dibaca atau rusak.");
  }

  if (!meta.width || !meta.height) {
    throw new ImageRejected("File gambar tidak punya dimensi yang valid.");
  }
  if (meta.width * meta.height > L.maxPixels) {
    throw new ImageRejected(
      `Dimensi ${meta.width}×${meta.height} melebihi batas ${L.maxPixels.toLocaleString("id-ID")} piksel.`,
    );
  }

  // rotate() menerapkan orientasi EXIF, dan metadata secara default dibuang oleh sharp.
  // Itu bonus privasi: lokasi GPS di foto travel ikut terhapus.
  const processed = image.rotate().resize({
    width: L.maxEdge,
    height: L.maxEdge,
    fit: "inside",
    withoutEnlargement: true,
  });

  const output = await processed
    .webp({ quality: L.quality, effort: 5 })
    .toBuffer({ resolveWithObject: true });

  return {
    body: output.data,
    mime: "image/webp",
    extension: "webp",
    width: output.info.width,
    height: output.info.height,
    originalBytes: input.byteLength,
    bytes: output.info.size,
  };
}

export type CropRegion = {
  /** Koordinat kotak crop dalam piksel gambar asli, dibulatkan. */
  left: number;
  top: number;
  width: number;
  height: number;
  /** 0, 90, 180, atau 270 derajat searah jarum jam. */
  rotation: number;
  maxEdge: number;
};

export type CroppedImage = {
  body: Buffer;
  mime: string;
  extension: string;
  width: number;
  height: number;
  bytes: number;
};

/**
 * Potong, putar, dan perkecil satu region dari gambar yang sudah tersimpan.
 *
/**
 * Terjemahkan kotak crop dari ruang gambar ASLI ke ruang gambar yang sudah
 * diputar.
 *
 * Sharp menjalankan operasi dalam urutan internal yang tidak bisa diatur:
 * `extract` selalu dipakai pada hasil `rotate`, bukan sebaliknya. Kalau kotak
 * 200x50 dikirim apa adanya lalu diputar 90 derajat, sharp akan memotong dari
 * gambar 100x200 dan melempar `extract_area: bad extract area`.
 *
 * Jadi client boleh mengirim koordinat yang mudah dibaca (gambar asli, belum
 * diputar) dan penerjemahan ke ruang terrotasi dilakukan di sini.
 *
 * Pemetaan titik (x, y) untuk gambar W x H:
 *   90 CW: (H-1-y, x)     180: (W-1-x, H-1-y)     270 CW: (y, W-1-x)
 *
 * Titik-titik itu lalu diekstrak menjadi batas kotak, dan sisi sudah tertukar
 * untuk sudut putar ganjil.
 */
function rotateCropRect(
  rect: { left: number; top: number; width: number; height: number },
  rotation: number,
  sourceWidth: number,
  sourceHeight: number,
): { left: number; top: number; width: number; height: number } {
  switch (rotation) {
    case 90:
      return {
        left: sourceHeight - rect.top - rect.height,
        top: rect.left,
        width: rect.height,
        height: rect.width,
      };
    case 180:
      return {
        left: sourceWidth - rect.left - rect.width,
        top: sourceHeight - rect.top - rect.height,
        width: rect.width,
        height: rect.height,
      };
    case 270:
      return {
        left: rect.top,
        top: sourceWidth - rect.left - rect.width,
        width: rect.height,
        height: rect.width,
      };
    default:
      return rect;
  }
}

/**
 * Potong, putar, dan perkecil satu region dari gambar yang sudah tersimpan.
 *
 * Dipisah dari `optimizeImage` karena sumbernya bukan upload mentah: bytes-nya
 * diambil kembali dari storage dan sudah pernah dibersihkan (WebP, EXIF
 * hilang), jadi yang perlu diulang hanya geometri bagian yang dipilih admin.
 *
 * Dua langkah eksplisit, putar seluruh gambar dulu baru potong, dipakai
 * alih-alih rantai `extract().rotate()` supaya tidak bergantung pada urutan
 * internal sharp. Penjelasan ada di `rotateCropRect`.
 *
 * Rotasi 90 dapat menukar sisi terpanjang, jadi batas `maxEdge` diterapkan
 * SESUDAH potong-putar. Kalau diterapkan sebelum, sisi yang tadinya sudah pas
 * bisa melewati batas setelah diputar.
 */
export async function cropImage(input: Buffer, region: CropRegion): Promise<CroppedImage> {
  const L = limits();

  if (input.byteLength === 0) throw new ImageRejected("Gambar sumber kosong.");
  if (input.byteLength > L.maxInputBytes) {
    throw new ImageRejected("Gambar sumber melebihi batas ukuran untuk disunting.");
  }

  const options = { failOn: "error" as const, limitInputPixels: L.maxPixels };

  let meta: ImageMetadata;
  try {
    meta = await sharp(input, options).metadata();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/pixel limit|exceeds/i.test(msg)) {
      throw new ImageRejected(
        `Dimensi gambar melebihi batas ${L.maxPixels.toLocaleString("id-ID")} piksel.`,
      );
    }
    throw new ImageRejected("Gambar tidak bisa dibaca atau rusak.");
  }
  if (!meta.width || !meta.height) {
    throw new ImageRejected("Gambar sumber tidak punya dimensi yang valid.");
  }

  // Rotasi di luar daftar ditolak diam-diam menjadi 0 supaya pemetaannya
  // tidak pernah menghitung ruang yang tidak ada.
  const rotation = [0, 90, 180, 270].includes(region.rotation) ? region.rotation : 0;

  const rect = rotateCropRect(
    { left: region.left, top: region.top, width: region.width, height: region.height },
    rotation,
    meta.width,
    meta.height,
  );

  const rotated =
    rotation === 0
      ? input
      : await sharp(input, { limitInputPixels: L.maxPixels }).rotate(rotation).toBuffer();

  const output = await sharp(rotated, { limitInputPixels: L.maxPixels })
    .extract(rect)
    .resize({
      width: region.maxEdge,
      height: region.maxEdge,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: L.quality, effort: 5 })
    .toBuffer({ resolveWithObject: true });

  return {
    body: output.data,
    mime: "image/webp",
    extension: "webp",
    width: output.info.width,
    height: output.info.height,
    bytes: output.info.size,
  };
}

/**
 * Kunci objek storage: `YYYY/MM/<slug-acak>.webp`.
 *
 * Suffix random mencegah tabrakan nama dan memastikan URL berubah setiap
 * upload ulang — penting karena Cache-Control-nya immutable.
 */
export function buildMediaKey(filename: string, extension: string): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");

  const base = slugify(basenameOf(filename).replace(/\.[^.]+$/, "")) || "gambar";
  const suffix = crypto.randomUUID().slice(0, 8);

  return `${yyyy}/${mm}/${base}-${suffix}.${extension}`;
}

/**
 * Ambil nama file saja. Nama dari `<input type="file">` biasanya sudah berupa
 * basename, tapi ini tetap defendsif kalau nama yang masuk mengandung path.
 */
function basenameOf(filename: string): string {
  return filename.split(/[/\\]/).pop() ?? filename;
}

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function mb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * True kalau URL menunjuk ke bucket kita sendiri — dipakai sebelum menghapus
 * MediaAsset, supaya file legacy di domain WordPress tidak ikut terhapus.
 */
export function isManagedUrl(url: string): boolean {
  const localBase = process.env.STORAGE_PUBLIC_URL ?? "/uploads";
  const s3Base = process.env.S3_PUBLIC_URL ?? "";
  if (url.startsWith(`${localBase.replace(/\/+$/, "")}/`)) return true;
  if (s3Base && url.startsWith(`${s3Base.replace(/\/+$/, "")}/`)) return true;
  return false;
}

/** Kunci storage dari URL yang dikelola kita, atau null kalau bukan milik kita. */
export function managedKeyFromUrl(url: string): string | null {
  const bases = [process.env.STORAGE_PUBLIC_URL, process.env.S3_PUBLIC_URL]
    .filter((v): v is string => Boolean(v))
    .map((v) => v.replace(/\/+$/, ""));
  for (const base of bases) {
    if (url.startsWith(`${base}/`)) return url.slice(base.length + 1);
  }
  return null;
}

/** Batas ukuran satu file mentah, sama dengan yang dipakai `optimizeImage`. */
export function maxUploadBytes(): number {
  return Number(process.env.MEDIA_MAX_BYTES ?? 25 * 1024 * 1024);
}

/**
 * Folder hanya boleh satu level, huruf/angka/strip. Tanpa ini, `folder` dari
 * form bisa menulis ke `2026/10/../../rahasia` di bucket.
 *
 * Dipakai baik oleh route upload maupun crop supaya aturannya tidak berbeda.
 */
export function normalizeFolder(input: string): string {
  const cleaned = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9/_-]/g, "")
    .replace(/-+/g, "-")
    .replace(/\/{2,}/g, "/")
    .replace(/^[-/]+|[-/]+$/g, "");
  if (!cleaned) return "";
  return cleaned.split("/").slice(0, 2).join("/");
}
