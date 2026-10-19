import "server-only";

import fs from "node:fs/promises";
import path from "node:path";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

/**
 * Penyimpanan media.
 *
 * Dua driver, satu antarmuka:
 *   - `local` : tulis ke filesystem. Untuk dev atau VPS.
 *   - `s3`    : S3-compatible. Dipakai Cloudflare R2, Backblaze B2, atau
 *               Upstash Blob — semuanya cuma beda endpoint & kredensial.
 *
 * Driver `local` menulis ke `./storage/uploads`, di LUAR `public/`. Alasan:
 * Next.js mem-foto isi `public/` saat build, jadi file yang diunggah setelah
 * build tidak akan pernah tersaji. File lokal dilayani oleh route handler
 * `/uploads/[...key]` yang menerapkan allowlist ekstensi.
 *
 * `local` TIDAK boleh dipakai di Vercel: filesystem serverless hilang tiap
 * deploy, jadi media yang sudah diunggah ikut hilang.
 */

export type PutResult = {
  /** URL publik untuk disimpan di database. */
  url: string;
  /** Kunci objek, dipakai untuk hapus. */
  key: string;
};

export type StorageDriver = {
  readonly name: string;
  put(key: string, body: Buffer, mime: string): Promise<PutResult>;
  /** Baca objek kembali. Dipakai editor gambar (crop/zoom) dan rotasi. */
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
};

const driver = process.env.STORAGE_DRIVER ?? "local";

/** Cegah path traversal: key harus relatif dan tidak boleh keluar dari root. */
function safeJoin(root: string, key: string): string {
  const target = path.resolve(root, key);
  const base = path.resolve(root);
  if (target !== base && !target.startsWith(base + path.sep)) {
    throw new Error(`Key media tidak aman: ${key}`);
  }
  return target;
}

function localDriver(): StorageDriver {
  const root = process.env.STORAGE_LOCAL_PATH ?? "./storage/uploads";
  const publicBase = process.env.STORAGE_PUBLIC_URL ?? "/uploads";

  return {
    name: "local",
    async put(key, body) {
      const file = safeJoin(root, key);
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, body);
      return { url: `${publicBase}/${key}`, key };
    },
    async get(key) {
      return fs.readFile(safeJoin(root, key));
    },
    async remove(key) {
      // `force: true` berarti file yang memang sudah hilang tidak error.
      // Catatan Windows: file yang baru saja ditulis dan baru dilayani lewat
      // route `/uploads/[...key]` bisa ditahan Windows Defender/indexer
      // selama beberapa detik, jadi `rm` sempat kena EPERM di dev. Di Linux
      // (target deploy) ini tidak terjadi. Efeknya file yatim di disk, bukan
      // data hilang — baris database sudah dihapus dan tidak muncul lagi.
      await fs.rm(safeJoin(root, key), { force: true });
    },
  };
}

function s3Driver(): StorageDriver {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error('S3_BUCKET belum diisi (butuh saat STORAGE_DRIVER="s3")');

  const client = new S3Client({
    region: process.env.S3_REGION ?? "auto",
    ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT } : {}),
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
    },
  });

  return {
    name: "s3",
    async put(key, body, mime) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: mime,
          CacheControl: "public, max-age=31536000, immutable",
        }),
      );
      return { url: publicUrlFor(key), key };
    },
    async get(key) {
      const out = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      if (!out.Body) throw new Error(`Objek kosong: ${key}`);
      return Buffer.from(await out.Body.transformToByteArray());
    },
    async remove(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
  };
}

/**
 * URL publik untuk sebuah key.
 *
 * Untuk R2, ini domain bucket publik (mis. `https://img.domain.tld`) atau
 * custom domain. Bucket R2 tidak punya endpoint S3 yang bisa dipakai langsung
 * di browser, jadi `S3_PUBLIC_URL` wajib diisi — bukan `S3_ENDPOINT`.
 */
export function publicUrlFor(key: string): string {
  const base = process.env.S3_PUBLIC_URL ?? "";
  if (!base) {
    throw new Error(
      "S3_PUBLIC_URL belum diisi. Untuk R2 ini domain bucket publik atau custom domain.",
    );
  }
  return `${base.replace(/\/+$/, "")}/${key}`;
}

export function getStorage(): StorageDriver {
  return driver === "s3" ? s3Driver() : localDriver();
}

/** True kalau konfigurasi storage sudah siap dipakai. */
export function storageConfigured(): boolean {
  if (driver !== "s3") return true;
  return Boolean(
    process.env.S3_BUCKET &&
      process.env.S3_ACCESS_KEY_ID &&
      process.env.S3_SECRET_ACCESS_KEY &&
      process.env.S3_PUBLIC_URL,
  );
}
