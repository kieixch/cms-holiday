/**
 * Smoke test end-to-end untuk storage + galeri gambar.
 *
 * Menjalankan server Next sendiri di port 3123 dengan STORAGE_DRIVER=local,
 * lalu mengujinya:
 *   1. anonim ditolak 401, halaman /adm-cms-hb/gallery dialihkan ke login
 *   2. sesi admin di-mint langsung (server action dari luar proses rapuh)
 *   2b. /adm-cms-hb/media lama Dialihkan ke /adm-cms-hb/gallery
 *   3. foto 3200x2400 diunggah -> diperkecil, jadi WebP, tersimpan
 *   4. file ada di disk DAN bisa diambil lewat URL publik
 *   5. dimensi, mime, folder, dan ukuran benar di database
 *   6. SVG dan file palsu ditolak
 *   7. path traversal di folder dinetralkan
 *   7b. `Category.cardImage`: opsional, bisa disimpan dan dikosongkan lagi
 *   7c. render kartu kategori: gambar hanya muncul kalau diisi, ikon hilang
 *   7d. halaman detail aset: guarded, form metadata, editor crop, 404
 *   8. GET /api/admin/gallery untuk picker: butuh sesi, bisa cari, bisa filter
 *   9. POST crop -> aset BARU, file asli utuh, provenance terisi
 *  10. crop ditolak kalau kotak melewati batas gambar
 *  11. proteksi hapus: aset yang punya turunan tidak bisa dihapus
 *
 * Perlu: `pnpm build` sudah dijalankan dan database sudah di-seed
 * (`pnpm db:seed` atau `pnpm setup`).
 */
import "dotenv/config";

import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SignJWT } from "jose";
import sharp from "sharp";

import { TypeCardGrid } from "../src/components/site/home-blocks";
import { prisma } from "../src/lib/db";

const PORT = Number(process.env.GALLERY_TEST_PORT ?? 3123);
const BASE = `http://localhost:${PORT}`;
const UPLOAD_DIR = path.resolve(process.env.STORAGE_LOCAL_PATH ?? "./storage/uploads");

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    pass++;
    console.log(`  ok   ${name}${detail ? ` - ${detail}` : ""}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}${detail ? ` - ${detail}` : ""}`);
  }
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    console.error(`\n${msg}`);
    process.exit(1);
  }
}

/** Nyalakan `next start` dan tunggu sampai siap. */
async function startServer(): Promise<ChildProcess> {
  const child = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)],
    {
      env: { ...process.env, STORAGE_DRIVER: "local", NODE_ENV: "production" },
      stdio: "ignore",
    },
  );

  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      const res = await fetch(`${BASE}/adm-cms-hb/login`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) return child;
    } catch {
      /* belum siap */
    }
  }
  child.kill();
  throw new Error(`Server tidak siap di ${BASE}. Jalankan \`pnpm build\` lebih dulu.`);
}

/** Token sesi dengan struktur sama persis dengan src/lib/auth.ts. */
async function mintSession(userId: string, email: string, name: string): Promise<string> {
  const secret = new TextEncoder().encode(process.env.AUTH_SECRET ?? "");
  return new SignJWT({ email, name, role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secret);
}

async function main() {
  console.log(`Menyalakan server di ${BASE} ...`);
  server = await startServer();

  const admin = await prisma.adminUser.findFirst({ orderBy: { createdAt: "asc" } });
  assert(admin, "tidak ada AdminUser; jalankan pnpm admin:create lebih dulu");
  const token = await mintSession(admin!.id, admin!.email, admin!.name);
  auth = { cookie: `hb_admin_session=${token}` };

  console.log("\n1. Anonim tidak boleh upload");
  {
    const res = await fetch(`${BASE}/api/admin/gallery`, { method: "POST", body: new FormData() });
    check("401 tanpa sesi", res.status === 401, `status ${res.status}`);
  }

  console.log("\n2. Halaman galeri butuh sesi");
  {
    const anon = await fetch(`${BASE}/adm-cms-hb/gallery`, { redirect: "manual" });
    check("anonim dialihkan ke login", anon.status === 307 || anon.status === 302, `status ${anon.status}`);
    check("ke /adm-cms-hb/login", (anon.headers.get("location") ?? "").includes("/adm-cms-hb/login"), anon.headers.get("location") ?? "-");

    const authed = await fetch(`${BASE}/adm-cms-hb/gallery`, { headers: auth });
    check("dengan sesi 200", authed.status === 200, `status ${authed.status}`);
  }

  console.log("\n2b. Alias lama /adm-cms-hb/media");
  {
    const res = await fetch(`${BASE}/adm-cms-hb/media`, { headers: auth, redirect: "manual" });
    check("status redirect", res.status === 307 || res.status === 302, `status ${res.status}`);
    check("mengarah ke /adm-cms-hb/gallery", (res.headers.get("location") ?? "").includes("/adm-cms-hb/gallery"), res.headers.get("location") ?? "-");

    // Alias harus tetap terjaga sesi: halaman admin yang dialihkan tanpa cek
    // login bisa dipakai menebak halaman mana yang ada.
    const anon = await fetch(`${BASE}/adm-cms-hb/media`, { redirect: "manual" });
    check("tanpa sesi tetap ke login", (anon.headers.get("location") ?? "").includes("/adm-cms-hb/login"), anon.headers.get("location") ?? "-");
  }

  const before = await prisma.mediaAsset.count();

  console.log("\n3. Upload foto besar");
  const bigJpeg = await sharp({
    create: { width: 3200, height: 2400, channels: 3, background: "#0ea572" },
  })
    .jpeg({ quality: 95 })
    .toBuffer();

  let assetId: string | null = null;
  let assetUrl = "";
  let onDisk = "";

  {
    const form = new FormData();
    form.set("file", new Blob([bigJpeg], { type: "image/jpeg" }), "Foto Liburan Grande.jpg");
    form.set("folder", "smoke/uji");
    form.set("alt", "Uji unggah otomatis");

    const res = await fetch(`${BASE}/api/admin/gallery`, { method: "POST", headers: auth, body: form });
    const payload = (await res.json()) as {
      saved?: { id: string; url: string; filename: string }[];
      error?: string;
    };

    check("status 201", res.status === 201, `status ${res.status} ${payload.error ?? ""}`);
    check("satu file tersimpan", payload.saved?.length === 1);

    const asset = payload.saved?.[0];
    if (asset) {
      assetId = asset.id;
      assetUrl = asset.url;
      check("URL memuat folder", asset.url.includes("/smoke/uji/"), asset.url);
      check("ekstensi .webp", asset.url.endsWith(".webp"));
      check("nama asli disimpan", asset.filename === "Foto Liburan Grande.jpg", asset.filename);

      onDisk = path.resolve(UPLOAD_DIR, asset.url.replace(/^\/?uploads\//, ""));
      check("file ada di disk", fs.existsSync(onDisk), onDisk.replace(process.cwd(), "."));
      check("tidak keluar dari root upload", onDisk.startsWith(UPLOAD_DIR), onDisk);
    }
  }

  console.log("\n4. Hasil di disk");
  if (onDisk && fs.existsSync(onDisk)) {
    // File dibaca ke buffer dulu, bukan `sharp(path)`. sharp menahan file
    // descriptor sampai instance-nya di-GC, dan itu membuat `unlink` di
    // langkah 7 kena EPERM selama proses smoke masih hidup.
    const bytes = fs.readFileSync(onDisk);
    const meta = await sharp(bytes).metadata();
    check("diperkecil ke max 2400", (meta.width ?? 9999) <= 2400, `${meta.width}x${meta.height}`);
    check("format WebP", meta.format === "webp", meta.format ?? "?");
    check("lebih kecil dari asli", bytes.byteLength < bigJpeg.byteLength,
      `${(bytes.byteLength / 1024).toFixed(0)}KB <- ${(bigJpeg.byteLength / 1024).toFixed(0)}KB`);

    const pub = await fetch(`${BASE}${assetUrl}`);
    check("URL publik terlayani 200", pub.status === 200, `status ${pub.status}`);
    check("content-type webp", (pub.headers.get("content-type") ?? "").includes("webp"), pub.headers.get("content-type") ?? "-");
    // Body harus dibaca atau di-cancel: di Windows response yang belum
    // di-consume menahan file handle, dan langkah hapus di bagian 7 gagal EPERM.
    await pub.arrayBuffer();
  }

  console.log("\n5. Baris database");
  if (assetId) {
    const row = await prisma.mediaAsset.findUnique({ where: { id: assetId } });
    check("baris ada", Boolean(row));
    check("lebar 2400", row?.width === 2400, `${row?.width}x${row?.height}`);
    check("tinggi 1800 (aspect dijaga)", row?.height === 1800, `${row?.height}`);
    check("mime webp", row?.mime === "image/webp", row?.mime ?? "-");
    check("folder tersimpan", row?.folder === "smoke/uji", row?.folder ?? "-");
    check("alt tersimpan", row?.alt === "Uji unggah otomatis", row?.alt ?? "-");
    check("ukuran < 2.1e9 ( batas Int)", (row?.size ?? 0) > 0 && row!.size < 2_147_483_647, `${row?.size}`);
    check("total naik 1", (await prisma.mediaAsset.count()) === before + 1);
  }

  console.log("\n6. Penolakan");
  {
    const svg = new FormData();
    svg.set("file", new Blob([Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')], { type: "image/svg+xml" }), "jahat.svg");
    const r = await fetch(`${BASE}/api/admin/gallery`, { method: "POST", headers: auth, body: svg });
    const p = (await r.json()) as { error?: string };
    check("SVG ditolak 400", r.status === 400, `status ${r.status}`);
    check("pesan menyebut tidak didukung", /tidak didukung/i.test(p.error ?? ""), p.error ?? "");
  }
  {
    const fake = new FormData();
    fake.set("file", new Blob([Buffer.from("ini bukan gambar sama sekali")], { type: "image/jpeg" }), "palsu.jpg");
    const r = await fetch(`${BASE}/api/admin/gallery`, { method: "POST", headers: auth, body: fake });
    check("file palsu ditolak", r.status === 400, `status ${r.status}`);
  }
  {
    // Folder berisi "../" harus dinetralkan, bukan menulis di luar folder.
    const form = new FormData();
    form.set("file", new Blob([bigJpeg], { type: "image/jpeg" }), "x.jpg");
    form.set("folder", "../../../../etc");
    const r = await fetch(`${BASE}/api/admin/gallery`, { method: "POST", headers: auth, body: form });
    const p = (await r.json()) as { saved?: { url: string }[] };
    const url = p.saved?.[0]?.url ?? "";
    check("folder traversal dinetralkan", !url.includes(".."), url);
    check("tidak keluar dari /uploads", url.startsWith("/uploads/"), url);
    if (p.saved?.length) {
      const row = await prisma.mediaAsset.findFirst({ orderBy: { createdAt: "desc" } });
      if (row) {
        await prisma.mediaAsset.delete({ where: { id: row.id } });
        const key = row.url.replace(/^\/?uploads\//, "");
        const f = path.resolve(UPLOAD_DIR, key);
        if (f.startsWith(UPLOAD_DIR)) fs.rmSync(f, { force: true });
      }
    }
  }

  console.log("\n7. Pembersihan");

  console.log("\n7b. Gambar kategori: opsional dan tidak merusak markup lama");
  {
    const category = await prisma.category.findFirst({ orderBy: { createdAt: "asc" } });
    assert(category, "tidak ada kategori untuk diuji");

    // Kategori hasil impor tidak punya `cardImage`, jadi beranda harus tetap
    // memakai ikon. Halaman ini di-cache (revalidate 3600), jadi yang diuji di
    // sini memang kondisi default itu.
    const htmlBeranda = await (await fetch(`${BASE}/`)).text();
    const kartu = [...htmlBeranda.matchAll(/<a href="\/[^"]*\/" class="type-card">([\s\S]*?)<\/a>/g)]
      .map((m) => m[1]);
    const cardKosong = kartu.find((c) => !c.includes("type-card__image"));
    if (cardKosong) {
      check("kartu kategori tanpa gambar tidak punya elemen gambar", !/type-card__image/.test(cardKosong), "");
      check("kartu kategori tanpa gambar tetap punya ikon", /type-icon/.test(cardKosong), "");
    } else {
      // Semua kategori kini punya foto (konten diatur lewat panel), jadi
      // varian kartu tanpa gambar tidak muncul di halaman ini. Fungsinya tetap
      // diuji langsung terhadap komponennya pada 7c.
      console.log("  --  tidak ada kartu tanpa gambar di beranda; varian kosong diuji pada 7c");
      check(
        "kartu berfoto memakai gambar",
        kartu.length > 0 && kartu.every((c) => c.includes("type-card__image")),
        `${kartu.length} kartu`,
      );
    }

    if (assetId) {
      await prisma.category.update({
        where: { id: category!.id },
        data: { cardImage: assetUrl, cardImageAlt: "Alt dari picker" },
      });
      const filled = await prisma.category.findUnique({ where: { id: category!.id } });
      check("cardImage tersimpan dari picker", filled?.cardImage === assetUrl, filled?.cardImage ?? "-");
      check("cardImageAlt tersimpan", filled?.cardImageAlt === "Alt dari picker", filled?.cardImageAlt ?? "-");

      await prisma.category.update({
        where: { id: category!.id },
        data: { cardImage: null, cardImageAlt: null },
      });
      const cleared = await prisma.category.findUnique({ where: { id: category!.id } });
      check("gambar kategori bisa dikosongkan lagi", cleared?.cardImage === null, cleared?.cardImage ?? "-");
    }
  }

  console.log("\n7c. Render kartu kategori: gambar menggantikan ikon");
  {
    // Dicek langsung terhadap komponennya, bukan lewat HTTP: beranda di-cache
    // satu jam, jadi perubahan baris database tidak akan terlihat sampai
    // `revalidatePath("/")` dipanggil.
    const base = {
      slug: "contoh",
      name: "Contoh",
      icon: "&#9733;",
      description: "Deskripsi",
      price: "Rp 1.000.000",
      linkLabel: "Lihat",
    } as const;

    const markup = (image: string | null, imageAlt: string | null) =>
      renderToStaticMarkup(
        createElement(TypeCardGrid, {
          items: [{ ...base, image, imageAlt }],
        }),
      );

    const kosong = markup(null, null);
    check("tanpa image: tidak ada elemen gambar", !kosong.includes("type-card__image"), "");
    check("tanpa image: ikon tetap ada", kosong.includes("type-icon"), "");
    check("tanpa image: markup sama dengan kartu legacy", !kosong.includes("<img"), "");

    const terisi = markup("/uploads/2026/10/a.webp", "Alt uji");
    check("dengan image: gambar dirender", terisi.includes("type-card__image"), "");
    check("dengan image: URL aset dipakai", terisi.includes("/uploads/2026/10/a.webp"), "");
    check("dengan image: alt diteruskan", terisi.includes('alt="Alt uji"'), "");
    check("dengan image: ikon diganti, bukan ditambah", !terisi.includes("type-icon"), "");

    const tanpaAlt = markup("/uploads/2026/10/a.webp", null);
    check("imageAlt kosong -> alt kosong", tanpaAlt.includes('alt=""'), "");
  }

  console.log("\n7d. Halaman detail aset");
  {
    const anon = await fetch(`${BASE}/adm-cms-hb/gallery/${assetId}`, { redirect: "manual" });
    check(
      "butuh sesi",
      anon.status === 307 || anon.status === 302,
      `status ${anon.status}`,
    );

    const res = await fetch(`${BASE}/adm-cms-hb/gallery/${assetId}`, { headers: auth });
    const html = await res.text();
    check("halaman ada", res.status === 200, `status ${res.status}`);
    check("judul memakai nama file", html.includes("Foto Liburan Grande"), "");
    check("form alt dirender", html.includes('name="alt"'), "");
    check("form folder dirender", html.includes('name="folder"'), "");
    check("form nama file dirender", html.includes('name="filename"'), "");
    check("editor crop dirender untuk file milik storage", html.includes("admin-crop__box"), "");
    check("penanda hasil suntingan tersedia", html.includes("admin-crop__angle"), "");
    check(
      "URL gambar absolut ditampilkan",
      html.includes("admin-url__input") && html.includes(assetUrl),
      "",
    );

    const missing = await fetch(`${BASE}/adm-cms-hb/gallery/tidak-ada`, {
      headers: auth,
      redirect: "manual",
    });
    check("404 untuk id yang tidak ada", missing.status === 404, `status ${missing.status}`);

    // Aset impor lama: URL-nya menunjuk host luar, jadi filenya tidak ada di
    // storage. Editor harus mati dan alasannya dijelaskan, bukan diam-diam.
    const legacy = await prisma.mediaAsset.create({
      data: {
        filename: "warisan-impor.jpg",
        url: "https://contoh.example/wp-content/uploads/2020/01/warisan.jpg",
        mime: "image/jpeg",
        size: 1234,
        width: 800,
        height: 600,
        alt: "Foto lama",
        folder: "impor",
      },
      select: { id: true },
    });

    try {
      const legacyHtml = await (
        await fetch(`${BASE}/adm-cms-hb/gallery/${legacy.id}`, { headers: auth })
      ).text();
      check("aset impor: alasannya dijelaskan", /berasal dari impor lama/.test(legacyHtml), "");
      check("aset impor: editor crop tidak dirender", !legacyHtml.includes("admin-crop__box"), "");
      check("aset impor: form alt tetap ada", legacyHtml.includes('name="alt"'), "");
    } finally {
      await prisma.mediaAsset.delete({ where: { id: legacy.id } });
    }
  }

  console.log("\n8. Picker: GET /api/admin/gallery");
  {
    const anon = await fetch(`${BASE}/api/admin/gallery`);
    check("401 tanpa sesi", anon.status === 401, `status ${anon.status}`);

    const all = (await (await fetch(`${BASE}/api/admin/gallery`, { headers: auth })).json()) as {
      assets?: { id: string; url: string; derivedFromId: string | null }[];
      total?: number;
    };
    check("200 dengan sesi", Array.isArray(all.assets), "");
    check("total ikut dikembalikan", typeof all.total === "number", String(all.total));
    check("aset uji muncul", all.assets?.some((a) => a.id === assetId) === true, "");
    check("aset baru punya derivedFromId null", all.assets?.find((a) => a.id === assetId)?.derivedFromId === null, "");

    const q = encodeURIComponent("Foto Liburan Grande");
    const found = (await (await fetch(`${BASE}/api/admin/gallery?q=${q}`, { headers: auth })).json()) as {
      assets?: { id: string }[];
      total?: number;
    };
    check("pencarian menemukan file uji", found.assets?.some((a) => a.id === assetId) === true, "");
    check("pencarian mempersempit total", (found.total ?? 999) <= (all.total ?? 0), `${found.total} <= ${all.total}`);

    const folder = encodeURIComponent("smoke/uji");
    const byFolder = (await (await fetch(`${BASE}/api/admin/gallery?folder=${folder}`, { headers: auth })).json()) as {
      assets?: { folder: string }[];
    };
    check("filter folder hanya mengembalikan folder itu", byFolder.assets?.every((a) => a.folder === "smoke/uji") ?? false, "");

    const miss = (await (await fetch(`${BASE}/api/admin/gallery?q=${encodeURIComponent("zzz-tidak-ada-zzz")}`, { headers: auth })).json()) as {
      assets?: unknown[];
      total?: number;
    };
    check("pencarian tanpa hasil mengembalikan array kosong", Array.isArray(miss.assets) && miss.assets!.length === 0, "");
  }

  console.log("\n9. Crop membuat aset baru");
  let derivativeId: string | null = null;
  let derivativeDisk = "";
  if (assetId) {
    const originalBytes = fs.readFileSync(onDisk);

    const res = await fetch(`${BASE}/api/admin/gallery/${assetId}/crop`, {
      method: "POST",
      headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify({ x: 200, y: 150, w: 900, h: 600, rotation: 90, alt: "Hasil suntingan" }),
    });
    const payload = (await res.json()) as {
      asset?: { id: string; url: string; width: number; height: number };
      error?: string;
    };
    check("status 201", res.status === 201, `status ${res.status} ${payload.error ?? ""}`);

    if (payload.asset) {
      derivativeId = payload.asset.id;
      check("aset baru dibuat", Boolean(derivativeId), derivativeId);
      const dims = `${payload.asset.width}x${payload.asset.height}`;
      check(
        "rotasi 90 menukar sisi (900x600 -> 600x900)",
        payload.asset.width === 600 && payload.asset.height === 900,
        dims,
      );
      check("URL hasil berbeda dari asal", payload.asset.url !== assetUrl, payload.asset.url);

      derivativeDisk = path.resolve(UPLOAD_DIR, payload.asset.url.replace(/^\/?uploads\//, ""));
      check("file hasil ada di disk", fs.existsSync(derivativeDisk), derivativeDisk.replace(process.cwd(), "."));

      const row = await prisma.mediaAsset.findUnique({ where: { id: derivativeId } });
      check("provenance menunjuk ke asal", row?.derivedFromId === assetId, `${row?.derivedFromId} vs ${assetId}`);
      check("alt hasil tersimpan", row?.alt === "Hasil suntingan", row?.alt ?? "-");
      check("folder ikut diwarisi", row?.folder === "smoke/uji", row?.folder ?? "-");

      // whole point: file asli tidak boleh tersentuh.
      const afterBytes = fs.readFileSync(onDisk);
      check("file asli masih ada", fs.existsSync(onDisk));
      check("isi file asli tidak berubah", Buffer.compare(originalBytes, afterBytes) === 0, `${originalBytes.byteLength} vs ${afterBytes.byteLength}`);

      const stillThere = await prisma.mediaAsset.findUnique({ where: { id: assetId } });
      check("baris asal tetap ada", stillThere !== null, "");
      check("URL asal tidak berubah", stillThere?.url === assetUrl, stillThere?.url ?? "-");

      const pub = await fetch(`${BASE}${payload.asset.url}`);
      check("URL hasil suntingan terlayani", pub.status === 200, `status ${pub.status}`);
      await pub.arrayBuffer();
    }

    console.log("\n10. Crop di luar batas ditolak");
    {
      const over = await fetch(`${BASE}/api/admin/gallery/${assetId}/crop`, {
        method: "POST",
        headers: { ...auth, "content-type": "application/json" },
        body: JSON.stringify({ x: 0, y: 0, w: 99999, h: 99999, rotation: 0 }),
      });
      check("400 untuk kotak melebihi gambar", over.status === 400, `status ${over.status}`);

      const zero = await fetch(`${BASE}/api/admin/gallery/${assetId}/crop`, {
        method: "POST",
        headers: { ...auth, "content-type": "application/json" },
        body: JSON.stringify({ x: 0, y: 0, w: 0, h: 0, rotation: 0 }),
      });
      check("400 untuk kotak berukuran 0", zero.status === 400, `status ${zero.status}`);

      const anon = await fetch(`${BASE}/api/admin/gallery/${assetId}/crop`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ x: 0, y: 0, w: 10, h: 10, rotation: 0 }),
      });
      check("401 tanpa sesi", anon.status === 401, `status ${anon.status}`);

      const missing = await fetch(`${BASE}/api/admin/gallery/tidak-ada/crop`, {
        method: "POST",
        headers: { ...auth, "content-type": "application/json" },
        body: JSON.stringify({ x: 0, y: 0, w: 10, h: 10, rotation: 0 }),
      });
      check("404 untuk id yang tidak ada", missing.status === 404, `status ${missing.status}`);
    }

    console.log("\n11. Aset asal tidak bisa dihapus selama masih punya turunan");
    {
      const res = await fetch(`${BASE}/adm-cms-hb/gallery`, { headers: auth });
      const html = await res.text();
      check("penanda hasil suntingan muncul di daftar", /Hasil suntingan/.test(html), "");

      const del = await deleteViaServerAction(assetId!);
      check("hapus ditolak dengan alasan provenance", /asal-usul/i.test(del), del.slice(0, 120));
      check("baris asal masih ada", (await prisma.mediaAsset.findUnique({ where: { id: assetId! } })) !== null, "");
    }
  }

  if (derivativeId) {
    await prisma.mediaAsset.delete({ where: { id: derivativeId } });
    await removeWithRetry(derivativeDisk);
    check("baris turunan terhapus", (await prisma.mediaAsset.findUnique({ where: { id: derivativeId } })) === null);
  }

  if (assetId) {
    await prisma.mediaAsset.delete({ where: { id: assetId } });
    const gone = await removeWithRetry(onDisk);
    check("baris terhapus", (await prisma.mediaAsset.findUnique({ where: { id: assetId } })) === null);
    check("file terhapus dari disk", gone);
    check("total kembali", (await prisma.mediaAsset.count()) === before);
  }

  console.log(`\n${pass} lulus, ${fail} gagal`);
  return fail ? 1 : 0;
}

/**
 * Hapus file dengan beberapa percobaan.
 *
 * Windows Defender sering menahan file yang baru ditulis selama beberapa
 * detik, jadi `unlink` pertama bisa kena EPERM. Ini perilaku OS, bukan bug
 * aplikasi — di Linux (target deploy) tidak terjadi.
 */
async function removeWithRetry(file: string, attempts = 20): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    try {
      fs.rmSync(file, { force: true });
      if (!fs.existsSync(file)) return true;
    } catch {
      /* coba lagi */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return !fs.existsSync(file);
}

/** Body multipart sebagai string, dengan Content-Type yang di-set manual. */
function multipart(fields: Record<string, string>, boundary: string): string {
  let text = "";
  for (const [name, value] of Object.entries(fields)) {
    text += `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`;
  }
  text += `--${boundary}--\r\n`;
  return text;
}

type HiddenInput = { name: string; value: string };

/** Ambil semua `<input type="hidden">` di dalam satu blok `<form>`. */
function hiddenInputsOf(formHtml: string): HiddenInput[] {
  const out: HiddenInput[] = [];
  for (const tag of formHtml.match(/<input[^>]*>/g) ?? []) {
    if (!/type="hidden"/.test(tag)) continue;
    const name = tag.match(/name="([^"]*)"/)?.[1];
    if (!name) continue;
    const value = tag.match(/value="([^"]*)"/)?.[1] ?? "";
    out.push({ name, value });
  }
  return out;
}

/**
 * Ambil hidden field dari form hapus di HTML halaman galeri.
 *
 * `<form action={fn}>` tanpa `useActionState` hanya menyisipkan satu hidden
 * `$ACTION_ID_<hash>`, tanpa `$ACTION_KEY`. Halaman ini punya form lain (logout
 * di sidebar), jadi form yang dipilih adalah yang memuat `name="id"` supaya
 * tidak salah menunjuk aksi.
 */
async function readDeleteHidden(): Promise<HiddenInput[]> {
  const html = await (await fetch(`${BASE}/adm-cms-hb/gallery`, { headers: auth })).text();

  const forms = html.match(/<form[\s\S]*?<\/form>/g) ?? [];
  const target = forms.find((f) => /name="id"/.test(f));
  if (!target) return [];

  const hidden = hiddenInputsOf(target);
  const actionId = hidden.find((h) => h.name.startsWith("$ACTION_ID_"));
  return actionId ? [actionId] : [];
}

/** Panggil aksi hapus galeri dan kembalikan pesan error yang tampil. */
async function deleteViaServerAction(assetId: string): Promise<string> {
  const hidden = await readDeleteHidden();
  if (hidden.length === 0) return "(tidak menemukan action di HTML)";

  const fields: Record<string, string> = { id: assetId };
  for (const h of hidden) fields[h.name] = h.value;

  const boundary = `----opencodeGallery${Date.now().toString(16)}`;
  const res = await fetch(`${BASE}/adm-cms-hb/gallery`, {
    method: "POST",
    headers: { ...auth, "Content-Type": `multipart/form-data; boundary=${boundary}` },
    body: multipart(fields, boundary),
    redirect: "manual",
  });

  const text = await res.text();
  const location = res.headers.get("location") ?? "";

  // Aksi hapus meneruskan pesan lewat query param saat redirect, jadi pesan
  // dibaca dari `location` lebih dulu. Fallback ke body untuk kasus tanpa
  // redirect.
  const fromLocation = new URL(location, BASE).searchParams.get("galat");
  if (fromLocation) return fromLocation;

  const decoded = text.replace(/&quot;/g, '"').replace(/\\"/g, '"');
  const match = decoded.match(/"error":"([^"]{10,300})"/);
  return match?.[1] ?? `[status ${res.status}] ${decoded.slice(0, 300)}`;
}

let server: ChildProcess | null = null;

/** Header cookie sesi admin, dipakai helper di bawah `main`. */
let auth: { cookie: string } = { cookie: "" };

main()
  .then((code) => {
    server?.kill();
    process.exit(code);
  })
  .catch((e) => {
    server?.kill();
    console.error(e);
    process.exit(1);
  });
