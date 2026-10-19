import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

import {
  buildMediaKey,
  ImageRejected,
  managedKeyFromUrl,
  optimizeImage,
} from "../src/lib/image";

let pass = 0;
let fail = 0;

function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    pass++;
    console.log(`  ok   ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function rejects(name: string, fn: () => Promise<unknown>, expect?: RegExp) {
  try {
    await fn();
    check(name, false, "tidak menolak, seharusnya menolak");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (e instanceof ImageRejected || expect?.test(msg)) {
      check(name, true, msg.slice(0, 60));
    } else {
      check(name, false, `error tak terduga: ${msg}`);
    }
  }
}

async function main() {
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "imgtest-"));

console.log("\n1. Gambar besar di-resize + WebP");
{
  // 3000x2000 JPEG Solid, cukup besar untuk memicu resize.
  const src = await sharp({
    create: { width: 3000, height: 2000, channels: 3, background: "#1a5fb4" },
  })
    .jpeg({ quality: 95 })
    .toBuffer();

  const out = await optimizeImage(src, "image/jpeg");
  check("dtype output WebP", out.mime === "image/webp" && out.extension === "webp");
  check("lebar turun ke 2400", out.width === 2400, `${out.width}x${out.height}`);
  check("rasio aspect dijaga", Math.abs(out.height - 1600) <= 2, `tinggi ${out.height}`);
  check("ukuran mengecil", out.bytes < src.byteLength, `${kb(src.byteLength)} -> ${kb(out.bytes)}`);
  check("metadata asli dicatat", out.originalBytes === src.byteLength);
}

console.log("\n2. Gambar kecil tidak di-zoom (withoutEnlargement)");
{
  const src = await sharp({
    create: { width: 400, height: 300, channels: 3, background: "#26a269" },
  })
    .png()
    .toBuffer();
  const out = await optimizeImage(src, "image/png");
  check("dimensi tetap 400x300", out.width === 400 && out.height === 300, `${out.width}x${out.height}`);
  check("tetap WebP", out.mime === "image/webp");
}

console.log("\n3. Orientasi EXIF diterapkan");
{
  // EXIF orientation 6 = putar 90°, jadi 800x400 jadi 400x800.
  const src = await sharp({
    create: { width: 800, height: 400, channels: 3, background: "#e01b24" },
  })
    .withMetadata({ orientation: 6 })
    .jpeg()
    .toBuffer();
  const out = await optimizeImage(src, "image/jpeg");
  check("terputar jadi potret", out.width === 400 && out.height === 800, `${out.width}x${out.height}`);
}

console.log("\n4. Metadata dibuang (privasi GPS)");
{
  const src = await sharp({
    create: { width: 600, height: 600, channels: 3, background: "#f5c211" },
  })
    .withMetadata({ exif: { IFD0: { Copyright: "sekret" } } })
    .jpeg()
    .toBuffer();
  const out = await optimizeImage(src, "image/jpeg");
  const meta = await sharp(out.body).metadata();
  check("exif hilang", !meta.exif, meta.exif ? "exif masih ada" : "bersih");
}

console.log("\n5. File ditolak");
await rejects("SVG ditolak (stored XSS)", () => optimizeImage(Buffer.from("<svg/>"), "image/svg+xml"));
await rejects("file kosong", () => optimizeImage(Buffer.alloc(0), "image/jpeg"));
await rejects("bukan gambar", () => optimizeImage(Buffer.from("halo dunia"), "image/jpeg"), /tidak bisa dibaca|rusak/);
await rejects("MIME application/pdf", () => optimizeImage(Buffer.from("%PDF-1.4"), "application/pdf"));
{
  const gif = await sharp({
    create: { width: 200, height: 200, channels: 3, background: "#77767b" },
  })
    .gif()
    .toBuffer();
  const out = await optimizeImage(gif, "image/gif");
  check("GIF diterima lalu jadi WebP", out.mime === "image/webp" && out.width === 200);
}

console.log("\n5b. Batas piksel (decompression bomb)");
await pixelLimitChecks();

console.log("\n6. buildMediaKey");
{
  const key = buildMediaKey("Foto Utama screened 2026 (1).JPG", "webp");
  check("berbentuk YYYY/MM/slug-uuid.webp", /^\d{4}\/\d{2}\/foto-utama-screened-2026-1-[0-9a-f]{8}\.webp$/.test(key), key);
  check("path traversal dinetralkan", !buildMediaKey("../../etc/passwd", "webp").includes(".."), buildMediaKey("../../etc/passwd", "webp"));
  check("nama kosong -> fallback", buildMediaKey("!!!", "webp").includes("/gambar-"), buildMediaKey("!!!", "webp"));
  const a = buildMediaKey("sama.jpg", "webp");
  const b = buildMediaKey("sama.jpg", "webp");
  check("kunci unik per upload", a !== b);
}

console.log("\n7. managedKeyFromUrl hanya untuk milik kita");
{
  const prevLocal = process.env.STORAGE_PUBLIC_URL;
  const prevS3 = process.env.S3_PUBLIC_URL;
  process.env.STORAGE_PUBLIC_URL = "/uploads";
  process.env.S3_PUBLIC_URL = "https://img.holidaybanyuwangi.com";

  check("URL lokal dipetakan", managedKeyFromUrl("/uploads/2026/10/a.webp") === "2026/10/a.webp");
  check("R2 dipetakan", managedKeyFromUrl("https://img.holidaybanyuwangi.com/2026/10/b.webp") === "2026/10/b.webp");
  check("legacy WordPress ditolak", managedKeyFromUrl("https://holidaybanyuwangi.com/wp-content/uploads/x.jpg") === null);
  check("origin lain ditolak", managedKeyFromUrl("https://evil.example.com/uploads/a.webp") === null);

  process.env.STORAGE_PUBLIC_URL = prevLocal;
  process.env.S3_PUBLIC_URL = prevS3;
}

function kb(n: number) {
  return `${(n / 1024).toFixed(1)}KB`;
}

/**
 * Batas piksel diuji dengan gambar ASLI yang ukurannya melebihi batas, bukan
 * header palsu. Alasannya: sharp memvalidasi struktur PNG sebelum membaca
 * dimensi, jadi file header-only selalu ditolak sebagai "corrupt header" dan
 * tidak pernah menyentuh guard batas piksel sama sekali.
 *
 * Batas dikecilkan lewat env. Limit di src/lib/image.ts dibaca saat fungsi
 * dipanggil (bukan sekali saat modul dimuat) supaya bisa diuji
 * tanpa me-restart proses.
 */
async function pixelLimitChecks() {
  const real = await sharp({
    create: { width: 1200, height: 800, channels: 3, background: "#31363b" },
  })
    .jpeg()
    .toBuffer();
  const pixels = 1200 * 800;
  const previous = process.env.MEDIA_MAX_PIXELS;

  // Di bawah batas: harus lolos.
  process.env.MEDIA_MAX_PIXELS = String(pixels + 1000);
  try {
    const out = await optimizeImage(real, "image/jpeg");
    check("gambar di bawah batas piksel diterima", out.width === 1200, `${out.width}px`);
  } catch (e) {
    check("gambar di bawah batas piksel diterima", false, String(e));
  }

  // Di atas batas: harus ditolak, dan pesannya harus menyebut dimensi.
  process.env.MEDIA_MAX_PIXELS = String(pixels - 1000);
  try {
    await optimizeImage(real, "image/jpeg");
    check("gambar di atas batas piksel ditolak", false, "tidak ditolak");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    check("gambar di atas batas piksel ditolak", msg.includes("piksel"), msg.slice(0, 70));
    check(
      "pesan menyebut penyebab, bukan 'rusak'",
      !/rusak/i.test(msg),
      /rusak/i.test(msg) ? "masih pakai pesan rusak" : "pesan tepat",
    );
  }

  if (previous === undefined) delete process.env.MEDIA_MAX_PIXELS;
  else process.env.MEDIA_MAX_PIXELS = previous;
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${pass} lulus, ${fail} gagal`);
process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
