/**
 * Isi kolom `HtmlPage.bio` untuk dua halaman link-bio (`/bio/<slug>`) dari
 * dokumen HTML aslinya.
 *
 * Editor `/adm-cms-hb/sosmed` sekarang menyunting data terstruktur, bukan dokumen
 * HTML utuh. Skrip ini membaca sumber konten apa adanya:
 *   - `data html/menu/instagram link bio/instagramlink.html`
 *   - `data html/menu/tiktok link bio/tiktoklink.html`
 *
 * Bagian statis (hero, galeri, CTA, footer) diambil dengan cheerio. Daftar
 * Open Trip / Private Trip di file aslinya di-render dari array JS (`OPEN`,
 * `PAKET`), jadi array itu diekstrak lalu di-`eval` apa adanya — tidak ada isi
 * yang diketik ulang di sini.
 *
 * Jalankan: pnpm db:seed-bio
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import * as cheerio from "cheerio";

import type { Prisma } from "../src/generated/prisma/client";
import type { BioLinkPageData, BioPackage, BioSchedule } from "../src/lib/bio";
import { prisma } from "../src/lib/db";

const DATA_DIR = resolve(process.cwd(), "..", "data html", "menu");

type Source = { slug: string; file: string };

const SOURCES: Source[] = [
  { slug: "instagram-link-bio", file: resolve(DATA_DIR, "instagram link bio", "instagramlink.html") },
  { slug: "tiktok-link-bio", file: resolve(DATA_DIR, "tiktok link bio", "tiktoklink.html") },
];

/** Teks dalam elemen, ` <br>` jadi baris baru, tag dilepas. */
function richText($: cheerio.CheerioAPI, selector: string): string {
  const clone = $(selector).first().clone();
  clone.find("br").replaceWith("\n");
  return clone
    .text()
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

/** Ambil `?text=` dari sebuah tautan wa.me (sudah URL-decoded). */
function waMessage(href: string | undefined): string {
  if (!href) return "";
  try {
    return new URL(href).searchParams.get("text") ?? "";
  } catch {
    return "";
  }
}

/**
 * Ekstrak literal array JS (`var NAME = [...]`) dengan menghitung kurung
 * seimbang, termasuk saat di dalam string. Input tepercaya (file konten).
 */
function extractArray(source: string, name: string): unknown {
  const marker = `var ${name} =`;
  const at = source.indexOf(marker);
  if (at === -1) throw new Error(`Tidak menemukan array "${name}" di sumber.`);
  const open = source.indexOf("[", at);
  if (open === -1) throw new Error(`Array "${name}" tidak dibuka dengan "["`);

  let depth = 0;
  let i = open;
  let quote: string | null = null;
  for (; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (ch === "\\") i += 1;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "[") depth += 1;
    else if (ch === "]") {
      depth -= 1;
      if (depth === 0) {
        i += 1;
        break;
      }
    }
  }

  const expr = source.slice(open, i);
  return new Function(`return ${expr};`)() as unknown;
}

type OpenRow = [string, string, number];
type PaketRow = {
  emoji: string;
  badge?: string;
  grup?: number;
  nama: string;
  desc: string;
  meta: string[];
  itinerary: { hari?: string; l: [string, string][] }[];
  kolom: string[];
  harga: number[][];
  inc: string[];
  exc: string[];
  addon?: string;
};

function buildPackages(rows: PaketRow[]): BioPackage[] {
  return rows.map((row) => ({
    emoji: row.emoji ?? "",
    image: null,
    badge: row.badge ?? "",
    badgeAlt: row.grup === 2,
    name: row.nama,
    desc: row.desc,
    meta: row.meta ?? [],
    itinerary: (row.itinerary ?? []).map((day) => ({
      day: day.hari ?? "",
      steps: (day.l ?? []).map((step) => ({ time: step[0], text: step[1] })),
    })),
    priceColumns: (row.kolom ?? []).map((label, index) => ({
      key: `c${index + 1}`,
      label,
    })),
    prices: (row.harga ?? []).map((line) => {
      const [pax, ...cells] = line;
      const values: Record<string, string> = {};
      (row.kolom ?? []).forEach((_, index) => {
        const cell = cells[index];
        if (cell !== undefined && cell !== null) values[`c${index + 1}`] = String(cell);
      });
      return { pax, values };
    }),
    includes: row.inc ?? [],
    excludes: row.exc ?? [],
    note: row.addon ?? "",
  }));
}

function parseSource(source: Source): BioLinkPageData {
  const html = readFileSync(source.file, "utf8");
  const $ = cheerio.load(html);

  const sectionLabels = $(".hb-sect span")
    .map((_, el) => $(el).text().trim())
    .get();

  const footerLegal = $(".hb-legal").first();

  const ctaHref = $("a.hb-cta").attr("href");

  const script = $("script").last().text();

  const openRows = extractArray(script, "OPEN") as OpenRow[];
  const paketRows = extractArray(script, "PAKET") as PaketRow[];

  const noteMatch = script.match(/hb-opennote">([^<]*)<\/div>/);

  return {
    logo: $("img.hb-logo").attr("src") ?? null,
    logoAlt: $("img.hb-logo").attr("alt") ?? "",
    brand: $(".hb-brand").first().text().trim(),
    tag: $(".hb-tag").first().text().trim(),
    subtitle: richText($, ".hb-sub"),
    chips: $(".hb-chips .hb-chip")
      .map((_, el) => $(el).text().trim())
      .get(),
    waNumber: (script.match(/var WA\s*=\s*"([^"]+)"/)?.[1] ?? "").replace(/[^\d]/g, ""),
    waGreeting: waMessage($("a.hb-wabar").attr("href")).split(" ")[0] || "Halo",
    waLink: "",
    waLabel: $("a.hb-wabar").find("span").first().text().trim(),
    waHint: $(".hb-wahint").first().text().trim(),
    waMessageTop: waMessage($("a.hb-wabar").attr("href")),

    openTripLabel: sectionLabels[0] ?? "",
    openTrips: openRows.map(([name, schedule, price]) => ({
      name,
      schedule: schedule as BioSchedule,
      price,
    })),
    openTripNote: noteMatch ? noteMatch[1].trim() : "",

    privateTripLabel: sectionLabels[1] ?? "",
    packages: buildPackages(paketRows),

    galleryLabel: sectionLabels[2] ?? "",
    gallery: $(".hb-gal figure img")
      .map((_, el) => ({
        url: $(el).attr("src") ?? "",
        alt: $(el).attr("alt") ?? "",
      }))
      .get(),

    ctaTitle: $("a.hb-cta h3").first().text().trim(),
    ctaText: $("a.hb-cta p").first().text().trim(),
    ctaLabel: $("a.hb-cta span").first().text().trim(),
    ctaMessage: waMessage(ctaHref),

    footerText: richText($, ".hb-end p"),
    footerLegal: footerLegal.text().trim(),
  };
}

async function main() {
  for (const source of SOURCES) {
    const data = parseSource(source);
    const result = await prisma.htmlPage.updateMany({
      where: { slug: source.slug, scope: "sosmed" },
      data: { bio: data as unknown as Prisma.InputJsonValue },
    });

    if (result.count === 0) {
      console.log(`  - ${source.slug}: baris tidak ditemukan, dilewati.`);
    } else {
      console.log(
        `  - ${source.slug}: ${data.openTrips.length} open trip, ${data.packages.length} paket, ${data.gallery.length} foto.`,
      );
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
