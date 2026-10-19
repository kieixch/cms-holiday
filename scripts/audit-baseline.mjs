/**
 * Rekam "baseline" teks audit: teks yang terlihat di situs yang sedang jalan,
 * per halaman publik. Dipakai `audit-markup.mjs` sebagai acuan teks menggantikan
 * HTML legacy.
 *
 * Kenapa perlu: teks legacy adalah ground-truth struktur, tapi isinya boleh
 * berubah lewat editor admin (mis. label emoji hari itinerary). Kalau audit
 * masih menuntut teks legacy, setiap editan yang disengaja akan selamanya
 * dianggap "teks hilang". Baseline direkam ulang setelah editan resmi, jadi
 * audit tetap tajam mendeteksi teks yang benar-benar hilang karena bug render.
 *
 * Jalankan server dulu, lalu: pnpm audit:baseline
 * Env opsional: BASE_URL (default http://localhost:3000)
 */
import fs from "node:fs";
import path from "node:path";
import { BASELINE_FILE, loadPages, pageUrl, visibleText } from "./audit-lib.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

const pages = loadPages();
const out = { generatedAt: new Date().toISOString(), base: BASE, pages: {} };

let failures = 0;
for (const page of pages) {
  const url = pageUrl(BASE, page.slug);
  try {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) {
      console.log(`HTTP ${res.status}  ${url}`);
      failures++;
      continue;
    }
    const html = await res.text();
    out.pages[page.slug] = visibleText(html);
    console.log(`OK    ${page.slug || "(beranda)"}  (${out.pages[page.slug].length} baris)`);
  } catch (error) {
    console.log(`GAGAL ${url}  ${error.message}`);
    failures++;
  }
}

if (failures > 0) {
  console.error(
    `\n${failures} halaman gagal direkam. Pastikan server jalan di ${BASE} (BASE_URL bisa diubah).`,
  );
  process.exit(1);
}

fs.mkdirSync(path.dirname(BASELINE_FILE), { recursive: true });
fs.writeFileSync(BASELINE_FILE, `${JSON.stringify(out, null, 2)}\n`, "utf8");
console.log(`\nBaseline ditulis: ${BASELINE_FILE}`);