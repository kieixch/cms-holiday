/**
 * Merging CSS legacy.
 *
 * Setiap halaman WordPress punya <style> sendiri. Daripada menebak mana yang
 * "benar", aturan yang sama di semua halaman dibiarkan global, sedangkan yang
 * berbeda di-scope ke kelas tipe halaman (.hb2d1n--home / --category /
 * --opentrip / --package) supaya tiap halaman tetap tampil persis seperti
 * aslinya.
 *
 * Jalankan: node scripts/merge-css.mjs
 */
import fs from "node:fs";
import path from "node:path";

const CSS_DIR = "content/css";
const OUT_FILE = path.join("src/styles/legacy.css");

/** hash CSS -> tipe halaman. Nilai = berapa banyak halaman memakai CSS itu,
 *  dipakai sebagai bobot saat memilih versi mayoritas. */
const PAGE_TYPES = {
  "5a21cfce": "home",
  "3eaaf240": "opentrip",
  "3e302071": "category",
  "096ff09e": "category",
  "4e6d5762": "category",
  "d1bed7bd": "package",
  "516a4f1c": "package",
  "1ed155f2": "package",
  "2de1b553": "package",
  "b677dfea": "package",
  "b3f22c34": "package",
  "87a0f221": "package",
  "fa213af5": "package",
  "054821a8": "package",
};

/**
 * Selector yang perilakunya berasal dari jumlah data, bukan dari desain.
 * Diganti utility class / nilai baku di `STANDARD`.
 */
const DYNAMIC = new Set([
  ".hb2d1n .package-grid",
  ".hb2d1n .itin-grid",
]);

/** Nilai baku untuk selector yang di satu halaman berbeda karena engagedesain
 *  yang tidak konsisten di file aslinya. 3 dari 4 tipe halaman memakai nilai
 *  di bawah, jadi itu yang dijadikan default. */
const STANDARD = {
  ".hb2d1n .gallery-grid": `display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;`,
  ".hb2d1n .timeline li": `position: relative;
  list-style: none;
  padding-bottom: 16px;
  font-size: 13.5px;
  color: #2C4A3B;`,
  ".hb2d1n .package-card .package-tag": `display: inline-block;
  align-self: flex-start;
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: #0EA572;
  background: #E6FBF3;
  padding: 5px 12px;
  border-radius: 999px;`,
  ".hb2d1n .package-card h3": `font-family: 'Baloo 2', sans-serif;
  font-size: 18px;
  font-weight: 700;
  margin: 0;
  color: #06402E;`,
  ".hb2d1n .package-card .package-rating": `font-size: 13px;
  font-weight: 600;
  color: #FF9F1C;
  display: flex;
  align-items: center;
  gap: 6px;`,
  ".hb2d1n .package-card .package-price .price": `font-family: 'Baloo 2', sans-serif;
  font-size: 22px;
  font-weight: 800;
  color: #06402E;`,
};

const norm = (s) => s.replace(/\s+/g, " ").trim();
const CLASS = (type) => `.hb2d1n--${type}`;

/** Pisahkan komentar /* ... *\/ yang menempel di depan selector. */
function splitComment(sel) {
  const m = sel.match(/^\s*(\/\*[\s\S]*?\*\/)\s*/);
  if (!m) return { comment: "", selector: sel.trim() };
  return { comment: m[1], selector: sel.slice(m[0].length).trim() };
}

/** At-rule tanpa body (mis. `@import url(...);`) harus disisihkan dulu,
 *  kalau tidak dia akan menempel ke selector blok berikutnya.
 *
 * Import font Google tidak ikut disalin ke CSS hasil. Font-nya dimuat lewat
 * next/font di src/app/layout.tsx, lalu nama familinya diganti jadi variabel
 * CSS supaya stylesheet ini tidak perlu memanggil Google sama sekali. */
const fontImports = [];
const preludes = [];

const FONT_FAMILIES = [
  ["Poppins", "--font-poppins"],
  ["Baloo 2", "--font-baloo-2"],
];

/* `@import url('...;...')` mengandung titik koma di dalam URL, jadi jangan
 * dipotong dengan `[^;]+`. */
const AT_RULE_WITHOUT_BODY =
  /@(import|charset|namespace)\s+(?:url\([^)]*\)|"[^"]*"|'[^']*'|[^;]+);/g;

function parse(css) {
  const stripped = css.replace(AT_RULE_WITHOUT_BODY, (m) => {
    if (/^@import\s+url\(['"]?https:\/\/fonts\.googleapis\.com/.test(m)) {
      fontImports.push(m.trim());
      return "";
    }
    preludes.push(m.trim());
    return "";
  });

  const out = [];
  let i = 0;
  while (i < stripped.length) {
    const open = stripped.indexOf("{", i);
    if (open === -1) break;
    let depth = 1;
    let j = open + 1;
    while (j < stripped.length && depth > 0) {
      if (stripped[j] === "{") depth++;
      else if (stripped[j] === "}") depth--;
      j++;
    }
    const { comment, selector } = splitComment(stripped.slice(i, open));
    if (selector) {
      out.push({
        comment,
        selector,
        body: stripped.slice(open + 1, j - 1),
      });
    }
    i = j;
  }
  return out;
}

/** 'Poppins' -> var(--font-poppins) */
function applyFontVars(css) {
  let out = css;
  for (const [family, variable] of FONT_FAMILIES) {
    out = out.replace(
      new RegExp(`font-family:\\s*'${family.replace(" ", "\\s*")}'\\s*,`, "g"),
      `font-family: var(${variable}),`,
    );
  }
  return out;
}

/**
 * Ganti prefix `.hb2d1n` dengan kelas tipe halaman, supaya
 * `.hb2d1n .hero` -> `.hb2d1n--home .hero`.
 * Wrapper halaman nanti ditulis `<div class="hb2d1n hb2d1n--home">`, sehingga
 * spesifisitasnya sama dengan aturan global dan urutan sumber yang menentukan.
 */
function retarget(selector, type) {
  return selector.replace(/\.hb2d1n\b/, CLASS(type));
}

/** Awali setiap selector di dalam blok media query dengan prefix tipe halaman. */
function scopeMediaBody(body, prefix) {
  return parse(body)
    .map((b) => {
      if (isMedia(b.selector)) {
        // media query bersarang: rekursif
        return `${b.comment}${b.selector} {\n${scopeMediaBody(b.body, prefix)}\n}`;
      }
      const sel = b.selector
        .split(",")
        .map((s) => retarget(s.trim(), prefix))
        .join(", ");
      return `${b.comment}${sel} {\n${b.body.trim()}\n}`;
    })
    .join("\n");
}

const isMedia = (sel) => sel.startsWith("@media");

/* ------------------------------------------------------------------ */
/* 1. Kumpulkan blok per tipe halaman                                  */
/* ------------------------------------------------------------------ */

const byType = { home: [], opentrip: [], category: [], package: [] };
const fileCount = { home: 0, opentrip: 0, category: 0, package: 0 };
for (const [hash, type] of Object.entries(PAGE_TYPES)) {
  const file = path.join(CSS_DIR, `${hash}.css`);
  if (!fs.existsSync(file)) {
    console.warn(`  ! CSS ${hash}.css tidak ditemukan, dilewati`);
    continue;
  }
  fileCount[type]++;
  const seen = new Set();
  for (const b of parse(fs.readFileSync(file, "utf8"))) {
    const key = norm(b.selector) + "|" + norm(b.body);
    if (seen.has(key)) continue;
    seen.add(key);
    byType[type].push(b);
  }
}

/** Varian dalam satu tipe: ambil versi yang dipakai paling banyak halaman,
 *  dan pertahankan komentar sectional yang menempel padanya. */
function majority(type) {
  /** selector -> Map<normalizedBody, {body, comment, n}> */
  const counts = new Map();
  for (const b of byType[type]) {
    const key = norm(b.selector);
    if (!counts.has(key)) counts.set(key, new Map());
    const bodies = counts.get(key);
    const nb = norm(b.body);
    const prev = bodies.get(nb);
    bodies.set(nb, {
      body: b.body,
      comment: prev?.comment ?? b.comment,
      n: (prev?.n ?? 0) + 1,
    });
  }

  const chosen = new Map();
  for (const [key, bodies] of counts) {
    let best = null;
    for (const entry of bodies.values()) {
      // `n` = jumlah halaman memakai varian ini, jadi varian yang dipakai
      // lebih banyak halaman menang (mis. 2 halaman half/full day > 1 halaman).
      if (!best || entry.n > best.n) best = entry;
    }
    chosen.set(key, best);
  }
  return chosen;
}

const majorityByType = {};
for (const type of Object.keys(byType)) majorityByType[type] = majority(type);

/* ------------------------------------------------------------------ */
/* 2. Tentukan blok global vs per tipe                                 */
/* ------------------------------------------------------------------ */

const allTypes = Object.keys(byType).filter((t) => byType[t].length > 0);

// Semua selector yang muncul di salah satu tipe
const allSelectors = new Set();
for (const t of allTypes) for (const sel of majorityByType[t].keys()) allSelectors.add(sel);

const shared = [];
const scoped = [];

for (const selector of allSelectors) {
  // Jumlah kolom ikut data -> ditangani utility class
  if (DYNAMIC.has(selector)) continue;
  // Nilai baku: semua varian sengaja dibuang, pakai blok STANDARD
  if (selector in STANDARD) continue;

  const owners = allTypes.filter((t) => majorityByType[t].has(selector));

  // Body yang dipakai paling banyak jadi aturan global; tipe yang berbeda
  // cukup menimpanya lewat blok ber-prefix (spesifisitas lebih tinggi).
  const tally = new Map();
  for (const t of owners) {
    const entry = majorityByType[t].get(selector);
    const key = norm(entry.body);
    if (!tally.has(key)) tally.set(key, { entry, count: 0, types: [] });
    tally.get(key).count++;
    tally.get(key).types.push(t);
  }

  let winner = null;
  for (const cand of tally.values()) {
    if (!winner || cand.count > winner.count) winner = cand;
  }

  shared.push({
    selector,
    body: winner.entry.body,
    comment: winner.entry.comment,
  });

  for (const t of owners) {
    if (winner.types.includes(t)) continue;
    const entry = majorityByType[t].get(selector);
    scoped.push({ type: t, selector, body: entry.body, comment: entry.comment });
  }
}

/* ------------------------------------------------------------------ */
/* 3. Susun file                                                       */
/* ------------------------------------------------------------------ */

const chunks = [];
chunks.push(`/* -------------------------------------------------------------------------
 * Stylesheet hasil migrasi dari <style> inline WordPress.
 *
 * Dibuat oleh scripts/merge-css.mjs - jangan diedit manual, ubah script-nya.
 *
 * .hb2d1n            : prefix yang sama dengan situs lama
 * .hb2d1n--home      : hanya beranda
 * .hb2d1n--category  : halaman listing kategori (kartu paket)
 * .hb2d1n--opentrip  : listing Open Trip (kartu rute + pill fasilitas)
 * .hb2d1n--package   : halaman detail paket (itinerary, fasilitas, harga, galeri)
 *
 * Font dimuat sendiri lewat next/font (src/app/layout.tsx), jadi nama famili
 * di sini memakai var(--font-poppins) dan var(--font-baloo-2).
 * ---------------------------------------------------------------------- */
`);

/** Ruleset dari {comment, selector, body} menjadi teks CSS. */
function emit(b) {
  if (isMedia(b.selector)) {
    return `${b.selector} {\n${b.body.trim()}\n}`;
  }
  return `${b.selector} {\n${b.body.trim()}\n}`;
}

// Urutan: variabel & base dulu, baru keyframes, baru komponen, baru responsive
const order = (b) => {
  const s = b.selector;
  if (s.includes("font-face") || s.startsWith("@keyframes")) return 1;
  if (s.includes(":root") || s === "*" || s === "body" || s.startsWith(".hb2d1n {")) return 0;
  if (isMedia(s)) return 90;
  return 20;
};

shared.sort((a, b) => order(a) - order(b));

const commentOf = (b) =>
  b.comment ? `/* ${b.comment.replace(/\/\*|\*\//g, "").trim()} */\n` : "";

const basic = shared.filter((b) => order(b) === 0 || order(b) === 1);
if (preludes.length > 0) chunks.push(preludes.join("\n") + "\n");
if (basic.length > 0) {
  chunks.push("/* ===== DASAR (font, body, keyframes) ===== */");
  for (const b of basic) chunks.push(commentOf(b) + emit(b));
}

chunks.push("\n/* ===== KOMPONEN & SEKSI (dipakai bersama) ===== */");
for (const b of shared) {
  if (order(b) === 20) {
    chunks.push(commentOf(b) + emit(b));
  }
}

// Media query milik satu tipe saja -> di-scope di dalamnya
const scopedMedia = scoped.filter((b) => isMedia(b.selector));

chunks.push("\n/* ===== RESPONSIVE ===== */");
for (const b of shared.filter((x) => isMedia(x.selector))) {
  chunks.push(commentOf(b) + emit(b));
}
for (const b of scopedMedia) {
  chunks.push(`${commentOf(b)}${b.selector} {\n${scopeMediaBody(b.body, b.type)}\n}`);
}

for (const type of allTypes) {
  const mine = scoped.filter((b) => b.type === type && !isMedia(b.selector));
  if (mine.length === 0) continue;
  chunks.push(`\n/* ===== KHUSUS: ${type.toUpperCase()} ===== */`);
  for (const b of mine) {
    chunks.push(`${commentOf(b)}${retarget(b.selector, type)} {\n${b.body.trim()}\n}`);
  }
}

chunks.push(`
/* =========================================================================
 * NILAI BAKU
 * Beberapa file HTML lama punya nilai yang berbeda-beda untuk selector yang
 * sama (selisih 0.5-2px, tidak disengaja). Di sini diseragamkan ke nilai yang
 * dipakai mayoritas halaman. Ubah nilai di scripts/merge-css.mjs, bukan di sini.
 * ========================================================================= */
`);
for (const [selector, body] of Object.entries(STANDARD)) {
  chunks.push(`${selector} {\n${body}\n}`);
}
chunks.push(`
/* Jumlah kolom TIDAK bisa ditebak dari isi: di situs asli halaman 3D2N memakai
   2 kolom meski hanya 2 paket, halaman 4D3N memakai 3 kolom meski 1 paket,
   dan paket Djawatan memakai galeri 2 kolom. Nilainya diambil dari CSS tiap
   halaman oleh scripts/extract-css.mjs, disimpan di database, lalu ditulis
   sebagai kelas cols-N di sini. */
.hb2d1n .package-grid { display: grid; gap: 20px; }
.hb2d1n .package-grid.cols-1 { grid-template-columns: 1fr; }
.hb2d1n .package-grid.cols-2 { grid-template-columns: repeat(2, 1fr); }
.hb2d1n .package-grid.cols-3 { grid-template-columns: repeat(3, 1fr); }
.hb2d1n .package-grid.cols-4 { grid-template-columns: repeat(4, 1fr); }

/* Listing Open Trip memakai kelas .trip-grid, bukan .package-grid. */
.hb2d1n .trip-grid.cols-1 { grid-template-columns: 1fr; }
.hb2d1n .trip-grid.cols-2 { grid-template-columns: repeat(2, 1fr); }
.hb2d1n .trip-grid.cols-3 { grid-template-columns: repeat(3, 1fr); }
.hb2d1n .trip-grid.cols-4 { grid-template-columns: repeat(4, 1fr); }

.hb2d1n .itin-grid { display: grid; gap: 24px; grid-template-columns: 1fr; max-width: 720px; margin: 0 auto; }
.hb2d1n .itin-grid.cols-1 { grid-template-columns: 1fr; max-width: 720px; margin: 0 auto; }
.hb2d1n .itin-grid.cols-2 { grid-template-columns: repeat(2, 1fr); max-width: none; margin: 0; }
.hb2d1n .itin-grid.cols-3 { grid-template-columns: repeat(3, 1fr); max-width: none; margin: 0; }

.hb2d1n .gallery-grid.cols-2 { grid-template-columns: repeat(2, 1fr); }
.hb2d1n .gallery-grid.cols-4 { grid-template-columns: repeat(4, 1fr); }

/* ===== RESPONSIVE: GRID DENGAN JUMLAH KOLOM DINAMIS =====
 * Blok ini harus diletakkan paling akhir, dan itu disengaja.
 *
 * Aturan .cols-N (dan .gallery-grid di blok NILAI BAKU) ditulis SETELAH
 * media query legacy, padahal specificity-nya lebih tinggi:
 *
 *   .hb2d1n .package-grid                 -> (0,2,0)  <- media query
 *   .hb2d1n .package-grid.cols-3          -> (0,3,0)  <- menang
 *
 * Akibatnya breakpoint legacy tidak berlaku sama sekali: di HP 375px grid
 * paket tetap 3 kolom, kartu jadi ~110px dan halaman gagal total. Aturan di
 * bawah memakai specificity yang sama dan muncul belakangan, jadi lipatan
 * yang dimaksud media query legacy akhirnya berlaku lagi.
 *
 * Breakpoint-nya sengaja disamakan dengan angka yang sudah dipakai media
 * query legacy, bukan angka baru. */
@media (max-width: 1000px) {
  .hb2d1n .itin-grid,
  .hb2d1n .itin-grid.cols-2,
  .hb2d1n .itin-grid.cols-3 {
    grid-template-columns: 1fr;
    max-width: 720px;
    margin: 0 auto;
  }
}
@media (max-width: 980px) {
  .hb2d1n .trip-grid.cols-3,
  .hb2d1n .trip-grid.cols-4 { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 960px) {
  .hb2d1n .package-grid.cols-3,
  .hb2d1n .package-grid.cols-4 { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 760px) {
  .hb2d1n .gallery-grid,
  .hb2d1n .gallery-grid.cols-4 { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 680px) {
  .hb2d1n .trip-grid.cols-2,
  .hb2d1n .trip-grid.cols-3,
  .hb2d1n .trip-grid.cols-4 { grid-template-columns: 1fr; }
}
@media (max-width: 640px) {
  .hb2d1n .package-grid.cols-2,
  .hb2d1n .package-grid.cols-3,
  .hb2d1n .package-grid.cols-4,
  .hb2d1n--home .package-grid { grid-template-columns: 1fr; }
}
@media (max-width: 480px) {
  .hb2d1n .gallery-grid,
  .hb2d1n .gallery-grid.cols-2,
  .hb2d1n .gallery-grid.cols-4 { grid-template-columns: 1fr; }
}

/* Tabel harga punya banyak kolom, jadi di layar sempit tidak bisa dilipat
 * menjadi kartu tanpa mengubah strukturnya. overflow:hidden bawaan legacy
 * membuat tabel terpotong dan harga jadi tidak terbaca; di sini diganti
 * scroll horizontal. Desktop tidak terpengaruh. */
@media (max-width: 860px) {
  .hb2d1n .price-table-wrap {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  .hb2d1n .price-table {
    min-width: 520px;
  }
}
`);

/* ------------------------------------------------------------------ */
/* 4. Tulis                                                             */
/* ------------------------------------------------------------------ */

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
let out = chunks.filter(Boolean).join("\n").replace(/\n{3,}/g, "\n\n") + "\n";
out = applyFontVars(out);
fs.writeFileSync(OUT_FILE, out, "utf8");

const kb = (Buffer.byteLength(out) / 1024).toFixed(1);
console.log(`shared : ${shared.length} blok`);
console.log(`scoped : ${scoped.length} blok`);
for (const t of allTypes) {
  console.log(`   ${t.padEnd(9)} ${scoped.filter((s) => s.type === t).length}`);
}
if (fontImports.length > 0) {
  console.log(`font   : ${fontImports.length} @import Google dibuang -> pakai next/font`);
}
console.log(`\nDitulis -> ${OUT_FILE} (${kb} kB)`);

