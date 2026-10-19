/**
 * Mengambil blok <style> inline dari setiap file HTML legacy dan memisahkannya
 * berdasarkan isi, supaya scripts/merge-css.mjs bisa membandingkan varian.
 *
 * Selain .css per varian, ditulis juga manifest.json yang memetakan file ->
 * varian -> nilai grid. Nilai grid ini bukan bisa ditebak dari jumlah kartu
 * (halaman 2D1N punya 3 kartu tapi 2 kolom), jadi harus ikut terbawa sebagai
 * data agar tiap halaman bisa diedit dari admin.
 *
 * Jalankan: node scripts/extract-css.mjs
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = path.resolve(process.cwd(), "..", "data html");
const out = [];

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".html")) out.push(p);
  }
}
walk(root);

/**
 * Ambil nilai `grid-template-columns` versi desktop, yaitu aturan yang tidak
 * berada di dalam @media / @keyframes.
 */
function desktopColumns(css, className) {
  const wanted = new RegExp(`\\.${className}\\b`);
  let at = 0; // karakter terakhir yang sudah diproses
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf("{", i);
    if (open === -1) break;
    let d = 1;
    let j = open + 1;
    while (j < css.length && d > 0) {
      if (css[j] === "{") d++;
      else if (css[j] === "}") d--;
      j++;
    }
    const head = css.slice(at, open).trim();
    const body = css.slice(open + 1, j - 1);
    const isAtRule = head.startsWith("@");
    if (!isAtRule && wanted.test(head)) {
      const cols = body.match(/grid-template-columns:\s*([^;]+);/);
      if (cols) return cols[1].replace(/\s+/g, " ").trim();
    }
    at = j;
    i = j;
  }
  return null;
}

const GRIDS = ["package-grid", "trip-grid", "itin-grid", "gallery-grid"];

const groups = new Map();
for (const file of out) {
  const html = fs.readFileSync(file, "utf8");
  const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
    .map((m) => m[1].trim())
    .join("\n");
  const hash = crypto.createHash("sha256").update(css).digest("hex").slice(0, 8);
  const rel = path.relative(root, file).split(path.sep).join("/");
  if (!groups.has(hash)) groups.set(hash, { css, files: [], grids: {} });
  const g = groups.get(hash);
  g.files.push(rel);
  for (const name of GRIDS) {
    const cols = desktopColumns(css, name);
    if (cols && g.grids[name] === undefined) g.grids[name] = cols;
  }
}

console.log(`Total file : ${out.length}`);
console.log(`Varian CSS : ${groups.size}\n`);

for (const [hash, g] of groups) {
  const cols = Object.entries(g.grids)
    .map(([k, v]) => `${k}=${v}`)
    .join("  ");
  console.log(`--- ${hash}  (${g.files.length} file)${cols ? `  ${cols}` : ""}`);
  for (const f of g.files) console.log(`      ${f}`);
  console.log();
}

fs.mkdirSync("content/css", { recursive: true });
const manifest = {};
for (const [hash, g] of groups) {
  fs.writeFileSync(path.join("content/css", `${hash}.css`), g.css, "utf8");
  for (const file of g.files) {
    manifest[file] = { hash, grids: g.grids };
  }
}
fs.writeFileSync(
  path.join("content/css", "manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
  "utf8",
);
console.log("CSS + manifest.json ditulis ke content/css/");

