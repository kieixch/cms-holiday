/**
 * Audit kemiripan markup: untuk setiap halaman publik, bandingkan himpunan
 * class dengan file HTML legacy aslinya, dan bandingkan teks terlihat dengan
 * baseline (`content/audit-baseline.json`, hasil `pnpm audit:baseline`).
 *
 * Pembagian tugas ini disengaja:
 *  - **Class** tetap diukur dari HTML legacy, karena struktur markup legacy
 *    tidak pernah berubah — kalau ada class legacy yang hilang, itu bug render.
 *  - **Teks** diukur dari baseline, karena isi teks boleh berubah lewat editor
 *    admin. Baseline harus disegharkan (`pnpm audit:baseline`) setiap kali
 *    konten resmi berubah; audit lalu hanya menandai teks yang benar-benar
 *    hilang dari render.
 *
 * Jalankan server produksi dulu: pnpm build && pnpm start
 * Lalu jalankan: pnpm audit:markup
 *
 * Classe yang memang tidak ada di markup asli hanya yang disengaja:
 *  - cols-N / pb-[50px] : berasal dari data & utility, bukan markup asli
 *  - module__ / h-full / min-h-full / object-cover : next/font & Tailwind
 *  - hbgl-* : layer desain baru (freedom-first redesign), hanya kelas
 *    tambahan pada markup — semua class & teks legacy tetap dipertahankan.
 *  - brand-logo-wrap : keputusan desain — logo SVG penuh dipakai di SEMUA
 *    halaman (non-beranda tadinya memakai emoji `brand-logo`); jadi
 *    `brand-logo-wrap` boleh lebih, dan kelas logo emoji boleh hilang
 *    (lihat MISSING_ALLOW).
 */
import fs from "node:fs";
import path from "node:path";
import {
  BASELINE_FILE,
  HTML_ROOT,
  classes,
  loadPages,
  pageUrl,
  visibleText,
} from "./audit-lib.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

const IGNORE = [
  /^cols-\d$/,
  /module__/,
  /^h-full$/,
  /^min-h-full$/,
  /^object-cover$/,
  /^pb-\[/,
  /^hb2d1n--/,
  /^hb2d1n$/,
  /^hbgl-/,
  /^brand-logo-wrap$/,
  // Penanda listing berisi tepat dua paket: kelas tambahan pada `.package-grid`
  // untuk mengecilkan kartu kedua (mis. Private 3D2N). Bukan bagian markup asli.
  /^is-pair$/,
  // Kartu tipe trip di beranda: kalau kategori punya `cardImage`, fotonya
  // menggantikan ikon emoji (`type-icon`). Variannya disengaja dan datanya
  // diatur lewat panel admin, jadi kelas barunya tidak dianggap selisih.
  /^type-card__image$/,
  // Seksi "Galeri Pengunjung" di beranda memakai komponen galeri paket
  // (`GalleryGrid`). Kelas legacy itu memang tidak ada di HTML beranda lama,
  // tapi pemakaiannya di beranda disengaja dan datanya diatur lewat editor.
  /^gallery-grid$/,
  /^gallery-item$/,
];

/**
 * Kelas logo emoji yang sengaja diganti logo SVG penuh di semua halaman
 * (keputusan desain: "logo konsisten seperti beranda"). Kelas ini boleh
 * hilang dari render non-beranda — bukan bug.
 *
 * `type-icon` masuk daftar ini karena kartu tipe trip boleh memakai foto
 * kategori; kalau semua kartu berfoto, ikon emoji tidak muncul sama sekali
 * di halaman — itu pilihan konten, bukan kerusakan render.
 */
const MISSING_ALLOW = [
  /^brand-logo$/,
  /^logo-icon$/,
  /^logo-text$/,
  /^l1$/,
  /^l2$/,
  /^type-icon$/,
];

if (!fs.existsSync(BASELINE_FILE)) {
  console.error(
    `Baseline teks belum ada: ${BASELINE_FILE}\n` +
      `Jalankan server lalu \`pnpm audit:baseline\` dulu.`,
  );
  process.exit(2);
}
const baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, "utf8"));

const pages = loadPages();

let bad = 0;
for (const page of pages) {
  const url = pageUrl(BASE, page.slug);
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    console.log(`HTTP ${res.status}  ${url}`);
    bad++;
    continue;
  }
  const renderedHtml = await res.text();
  const originalHtml = fs.readFileSync(path.join(HTML_ROOT, page.file), "utf8");

  const rendered = classes(renderedHtml);
  const original = classes(originalHtml);

  const missing = page.skipClasses
    ? []
    : [...original]
        .filter((c) => !rendered.has(c) && !MISSING_ALLOW.some((re) => re.test(c)))
        .sort();
  const extra = page.skipClasses
    ? []
    : [...rendered]
        .filter((c) => !IGNORE.some((re) => re.test(c)) && !original.has(c))
        .sort();

  // Teks: bandingkan dengan baseline. Baris baseline yang hilang = regresi.
  const wantText = baseline.pages[page.slug];
  if (!wantText) {
    console.log(`BEDA  ${page.slug || "(beranda)"}  (baseline belum punya halaman ini)`);
    bad++;
    continue;
  }
  const gotText = new Set(visibleText(renderedHtml));
  const lostText = wantText.filter((t) => !gotText.has(t));

  if (missing.length === 0 && extra.length === 0 && lostText.length === 0) {
    console.log(`OK    ${page.slug || "(beranda)"}`);
  } else {
    bad++;
    console.log(`BEDA  ${page.slug || "(beranda)"}`);
    if (missing.length) console.log(`      kurang  : ${missing.join(" ")}`);
    if (extra.length) console.log(`      lebih   : ${extra.join(" ")}`);
    for (const t of lostText.slice(0, 6)) console.log(`      teks    : ${t}`);
    if (lostText.length > 6) console.log(`      teks    : ...dan ${lostText.length - 6} baris lain`);
  }
}

console.log(`\n${pages.length - bad}/${pages.length} halaman cocok.`);
process.exit(bad === 0 ? 0 : 1);