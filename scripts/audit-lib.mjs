/**
 * Utilitas bersama untuk `audit-markup.mjs` dan `audit-baseline.mjs`.
 *
 * Kedua script dijalankan dengan `node` biasa (bukan tsx), jadi modul ini hanya
 * boleh bergantung pada modul bawaan Node — jangan impor cheerio/ts di sini.
 */
import fs from "node:fs";
import path from "node:path";

export const HTML_ROOT = path.resolve("..", "data html");
export const BASELINE_FILE = path.resolve("content", "audit-baseline.json");

/**
 * Halaman yang sengaja tidak diaudit karena tidak punya padanan di situs lama.
 *
 * Kategori 4D3N kini menampilkan halaman listing (dengan kartu paket),
 * sedangkan situs legacy hanya punya halaman detailnya. Halaman detail itu
 * tetap diaudit lewat entri paket `paket-trip-4d3n`.
 */
export const SKIP_PAGES = new Set(["private-trip-banyuwangi-4d3n"]);

export function stripNoise(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");
}

export function classes(html) {
  const out = new Set();
  for (const m of stripNoise(html).matchAll(/class="([^"]*)"/g)) {
    for (const c of m[1].split(/\s+/)) if (c) out.add(c);
  }
  return out;
}

/**
 * Teks yang benar-benar terlihat pembaca. Dipakai untuk memastikan tidak ada
 * konten yang hilang diam-diam (mis. baris harga kedua pada kartu Open Trip).
 */
export function visibleText(html) {
  return stripNoise(html)
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .split("\n")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.length > 1 && !/^[/#]/.test(s));
}

/** Daftar halaman publik yang diaudit, beserta file HTML legacy-nya. */
export function loadPages() {
  const content = JSON.parse(fs.readFileSync("content/content.json", "utf8"));
  const categoryFiles = new Set(
    content.categories.map((c) => c.sourceFile).filter(Boolean),
  );
  return [
    { slug: "", file: "menu/home page/homepage.html", skipClasses: false },
    ...content.categories
      // Sama seperti paket: kategori yang dibuat lewat panel admin tidak punya
      // `sourceFile`, jadi tidak ada file HTML legacy untuk dibandingkan.
      // Tanpa filter ini `path.join(HTML_ROOT, "")` menunjuk ke folder itu
      // sendiri dan audit gagal dengan EISDIR.
      .filter((c) => !SKIP_PAGES.has(c.slug) && c.sourceFile)
      .map((c) => ({ slug: c.slug, file: c.sourceFile, skipClasses: false })),
    ...content.packages
      // Hanya paket hasil impor yang punya padanan HTML legacy. Paket yang
      // dibuat langsung lewat panel admin tidak punya `sourceFile`, jadi tidak
      // ada file pembanding — kalau ikut dimasukkan, audit membaca path kosong
      // (EISDIR) dan gagal total.
      .filter((p) => p.hasDetailPage && p.sourceFile)
      .map((p) => ({
        slug: p.slug,
        file: p.sourceFile,
        // Sebagian paket berasal dari kartu pada halaman listing (mis. paket
        // "open-trip-baluran" yang diangkat dari halaman open trip). File
        // legacy-nya sama dengan file kategori, bukan halaman detail tersendiri,
        // jadi membandingkan class halaman stub-nya dengan listing penuh tidak
        // ada artinya. Teksnya tetap dipantau lewat baseline; hanya perbandingan
        // class struktur yang dilewati.
        skipClasses: categoryFiles.has(p.sourceFile),
      })),
  ];
}

export function pageUrl(base, slug) {
  return `${base}/${slug}${slug ? "/" : ""}`;
}