/**
 * Ekstraktor konten: membaca 26 file HTML Elementor di "../data html"
 * lalu menulis `content/content.json` sebagai sumber seed database.
 *
 * Jalankan: pnpm extract
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import * as cheerio from "cheerio";
import type {
  Benefit,
  Card,
  CardPrice,
  CategoryKey,
  CategoryOut,
  CtaBanner,
  GalleryImageOut,
  ItineraryDayOut,
  FacilityGroupOut,
  Hero,
  ListingOut,
  Note,
  PackageOut,
  PricingBlock,
  Sections,
  Testimonial,
  TypeCard,
} from "./content-types";

const HTML_ROOT = resolve(process.cwd(), "..", "data html");
const OUT_FILE = resolve(process.cwd(), "content", "content.json");
const CSS_MANIFEST = resolve(process.cwd(), "content", "css", "manifest.json");

type Cheerio = cheerio.CheerioAPI;
/** `Cheerio<Element>`; tipe elemen diambil dari instance Cheerio agar tidak
 *  bergantung pada paket `domhandler` secara langsung. */
type Sel = ReturnType<Cheerio>;

/* ------------------------------------------------------------------ */
/* Pemetaan file -> kategori                                           */
/* ------------------------------------------------------------------ */

const CATEGORY_META: Record<
  CategoryKey,
  { slug: string; detailDir: string; order: number }
> = {
  openTrip: { slug: "open-trip-banyuwangi", detailDir: "open trip", order: 1 },
  halfDay: {
    slug: "private-trip-banyuwangi-half-day",
    detailDir: "private half day",
    order: 2,
  },
  fullDay: {
    slug: "private-trip-banyuwangi-full-day",
    detailDir: "private full day",
    order: 3,
  },
  "2d1n": { slug: "private-trip-banyuwangi-2d1n", detailDir: "private 2d1n", order: 4 },
  "3d2n": { slug: "private-trip-banyuwangi-3d2n", detailDir: "private 3d2n", order: 5 },
  "4d3n": { slug: "private-trip-banyuwangi-4d3n", detailDir: "private 4d3n", order: 6 },
};

const LISTING_FILE: Record<CategoryKey, string> = {
  openTrip: join("menu", "open trip", "opentrip.html"),
  halfDay: join("menu", "private half day", "privatehalfday.html"),
  fullDay: join("menu", "private full day", "privatefullday.html"),
  "2d1n": join("menu", "private 2d1n", "private2d1n.html"),
  "3d2n": join("menu", "private 3d2n", "private3d2n.html"),
  // Berkas "menu" untuk 4D3N sebenarnya berisi halaman detail satu paket.
  "4d3n": join("menu", "private 4d3n", "private4d3n.html"),
};

const HOMEPAGE_FILE = join("menu", "home page", "homepage.html");

/** Slug kanonik untuk berkas 4D3N, karena tidak ada halaman listing. */
const IMPLICIT_SLUG: Partial<Record<string, string>> = {
  [join("menu", "private 4d3n", "private4d3n.html")]: "paket-trip-4d3n",
};

/**
 * Kartu beranda yang menunjuk ke halaman yang tidak pernah ada.
 *
 * Kartu "Full Day: Hutan Djawatan & TN Baluran" di beranda menunjuk ke /paket-trip-full-day-djawatan-baluran/
 * — URL yang 404 di data legacy maupun di situs live. Kartu tersebut
 * diganti dengan paket "Djawatan & Baluran" yang detailnya memang tersedia,
 * sesuai keputusan pemilik situs.
 */
const HOME_CARD_REPLACEMENT: Record<string, string> = {
  "paket-trip-full-day-djawatan-baluran": "Djawatan & Baluran",
};

/**
 * Highlight & label lokasi untuk kartu beranda paket pengganti. Kartu di
 * beranda selalu punya `.package-highlight` dan `.package-loc`, sedangkan
 * kartu di halaman kategori tidak — tanpa ini, kartu pengganti terlihat
 * lebih pendek dari kartu beranda lainnya.
 */
const HOME_CARD_HIGHLIGHT: Record<string, string> = {
  "Djawatan & Baluran": "⏰ 08.00–17.30: Eksplorasi Hutan Trembesi Djawatan & Savana Africa van Java Baluran",
};

const HOME_CARD_HIGHLIGHT_LOC: Record<string, string> = {
  "Djawatan & Baluran": "📍 Djawatan & Baluran",
};


/* ------------------------------------------------------------------ */
/* Utilitas                                                           */
/* ------------------------------------------------------------------ */

const SITE = "https://holidaybanyuwangi.com";

function loadHtml(relPath: string): Cheerio {
  const full = join(HTML_ROOT, relPath);
  return cheerio.load(readFileSync(full, "utf8"));
}

const norm = (s: string | undefined | null) => (s ?? "").replace(/\s+/g, " ").trim();

/* ------------------------------------------------------------------ */
/* Layout grid dari CSS asli                                           */
/* ------------------------------------------------------------------ */

/**
 * Manifest hasil scripts/extract-css.mjs: file HTML -> nilai grid versi desktop.
 * Nilai ini ikut dipindah ke database karena tidak bisa ditebak dari jumlah
 * kartu (halaman 3D2N punya 2 paket tapi 2 kolom, halaman 4D3N 1 paket tapi
 * 3 kolom, dan seterusnya).
 */
type CssManifest = Record<string, { hash: string; grids: Record<string, string> }>;

let cssManifest: CssManifest = {};
try {
  cssManifest = JSON.parse(readFileSync(CSS_MANIFEST, "utf8")) as CssManifest;
} catch {
  console.warn(
    "  ! content/css/manifest.json belum ada. Jalankan `pnpm css` lebih dulu agar jumlah kolom ikut terbawa.",
  );
}

const manifestKey = (relPath: string) => relPath.split(sep).join("/");

function gridColumnsOf(relPath: string, grid: string, fallback: number): number {
  const entry = cssManifest[manifestKey(relPath)];
  const raw = entry?.grids[grid];
  if (!raw) return fallback;
  const n = Number(raw.match(/repeat\((\d+)/)?.[1] ?? (/1fr/.test(raw) ? 1 : NaN));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 4) : fallback;
}

function texts($: Cheerio, sel: string): string[] {
  return $(sel)
    .toArray()
    .map((el) => norm($(el).text()));
}

/** Pisahkan judul bertanda aksen: "Private Trip <span>2D1N</span> Banyuwangi". */
function splitAccent($: Cheerio, $el: Sel) {
  let before = "";
  let accent = "";
  let after = "";
  let seen = false;

  for (const node of $el.contents().toArray()) {
    if (node.type === "tag" && node.tagName === "span") {
      accent = norm($(node).text());
      seen = true;
      continue;
    }
    if (node.type !== "text") continue;
    const t = norm(node.data);
    if (!t) continue;
    if (!seen) before = before ? `${before} ${t}` : t;
    else after = after ? `${after} ${t}` : t;
  }
  return { before, accent, after };
}

function slugFromHref(href: string | undefined): string | null {
  if (!href) return null;
  const m = href.match(new RegExp(`${SITE}/([^/?#]+)/?`));
  return m ? m[1] : null;
}

function waMessageFromHref(href: string | undefined): string | null {
  if (!href) return null;
  const m = href.match(/[?&]text=([^&]*)/);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1].replace(/\+/g, " "));
  } catch {
    return m[1];
  }
}

/** Ambil teks sebuah elemen anak, buang anak `<span>` tertentu. */
function textWithout($: Cheerio, $el: Sel, sel: string): string {
  return norm($el.clone().find(sel).remove().end().text());
}

/* ------------------------------------------------------------------ */
/* Parser                                                             */
/* ------------------------------------------------------------------ */

function parseHero($: Cheerio): Hero {
  const $hero = $(".hero").first();
  const $h1 = $hero.find("h1").first();
  const title = splitAccent($, $h1);
  const cta = $hero
    .find(".hero-cta a")
    .toArray()
    .map((a) => ({ href: $(a).attr("href") ?? "", label: norm($(a).text()) }));

  return {
    badges: texts($, ".hero-badges .badge"),
    decos: texts($, ".hero-deco"),
    title: title.before,
    accent: title.accent,
    suffix: title.after,
    description: norm($hero.find(".hero-content > p").first().text()),
    ctaPrimaryLabel: cta[0]?.label ?? "",
    ctaPrimaryHref: cta[0]?.href ?? "",
    ctaSecondaryLabel: cta[1]?.label ?? "",
    ctaSecondaryHref: cta[1]?.href ?? "",
  };
}

function parseCtaBanner($: Cheerio): CtaBanner | null {
  const $c = $(".cta-banner").first();
  if ($c.length === 0) return null;
  const $a = $c.find("a").first();
  return {
    title: norm($c.find("h2").first().text()),
    text: norm($c.find("p").first().text()),
    label: norm($a.text()),
    href: $a.attr("href") ?? "",
  };
}

function parseCard($: Cheerio, $c: Sel): Card {
  const $img = $c.find(".package-img img").first();
  const $price = $c.find(".package-price .price").first();
  const priceItems = $c
    .find(".package-price .price-item")
    .toArray()
    .map((el) => {
      const $p = $(el).find(".price").first();
      return {
        label: norm($(el).find(".label").first().text()),
        value: textWithout($, $p, "span"),
        unit: norm($p.find("span").first().text()),
      };
    });

  const $btn = $c.find("a.btn").last();
  const href = $btn.attr("href") ?? "";

  // Kartu Private & beranda memakai bentuk datar (.label + .price), sedangkan
  // Open Trip memakai daftar .price-item yang bisa lebih dari satu baris
  // (mis. Weekend + Weekday). Keduanya dinormalkan ke array `prices`.
  const flatLabel = norm($c.find(".package-price .label").first().text());
  const flatValue = textWithout($, $price, "span");
  const flatUnit = norm($price.find("span").first().text());
  const prices: CardPrice[] =
    priceItems.length > 0
      ? priceItems
      : flatValue
        ? [{ label: flatLabel, value: flatValue, unit: flatUnit }]
        : [];

  return {
    name: norm($c.find("h3").first().text()),
    image: $img.attr("src") ?? null,
    imageAlt: norm($img.attr("alt")),
    loc: norm($c.find(".package-loc").first().text()),
    homeLoc: norm($c.find(".package-loc").first().text()),
    tag: norm($c.find(".package-tag").first().text()),
    rating: norm($c.find(".package-rating").first().text()),
    highlight: norm($c.find(".package-highlight").first().text()),
    facilityPills: $c
      .find(".trip-facilities .facility-pill")
      .toArray()
      .map((el) => norm($(el).text())),
    days: $c
      .find(".package-days .day-row")
      .toArray()
      .map((el) => ({
        label: norm($(el).find("strong").first().text()).replace(/:$/, ""),
        title: textWithout($, $(el), "strong"),
      })),
    priceLabel: prices[0]?.label ?? "",
    priceValue: prices[0]?.value ?? "",
    priceUnit: prices[0]?.unit ?? "",
    prices,
    buttonLabel: norm($btn.text()),
    slug: slugFromHref(href),
    waMessage: waMessageFromHref(href),
    isWhatsappLink: href.startsWith("https://wa.me"),
    isPromoted: $c.hasClass("featured"),
  };
}

function parseItinerary($: Cheerio): ItineraryDayOut[] {
  return $(".itin-grid .itin-card")
    .toArray()
    .map((el) => {
      const $e = $(el);
      return {
        emoji: norm($e.find(".itin-card-head .emoji").first().text()),
        label: norm($e.find(".itin-card-head span").first().text()),
        title: norm($e.find(".itin-card-head h3").first().text()),
        items: $e
          .find(".timeline li")
          .toArray()
          .map((li) => ({
            time: norm($(li).find(".time").first().text()),
            text: textWithout($, $(li), ".time"),
          })),
      };
    });
}

function parseFacilities($: Cheerio): FacilityGroupOut[] {
  return $(".fasilitas-grid .fas-card")
    .toArray()
    .map((el) => {
      const $e = $(el);
      return {
        variant: $e.hasClass("include") ? ("INCLUDE" as const) : ("EXCLUDE" as const),
        title: norm($e.find("h3").first().text()),
        items: $e
          .find("li")
          .toArray()
          .map((li) => ({
            icon: norm($(li).find(".fas-icon").first().text()),
            text: textWithout($, $(li), ".fas-icon"),
          })),
      };
    });
}

function parsePricing($: Cheerio): PricingBlock | null {
  const $wrap = $(".price-table-wrap").first();
  if ($wrap.length > 0) {
    const headerCells = $wrap.find("thead th").toArray();
    return {
      kind: "TABLE" as const,
      note: norm($(".price-note").first().text()),
      firstHeader: norm($(headerCells[0]).text()),
      columns: headerCells.slice(1).map((el) => ({
        label: norm($(el).text()),
        cssClass:
          $(el).hasClass("col-driver")
            ? "col-driver"
            : $(el).hasClass("col-photo")
              ? "col-photo"
              : null,
      })),
      rows: $wrap
        .find("tbody tr")
        .toArray()
        .map((tr) => {
          const tds = $(tr).find("td").toArray();
          return {
            label: norm($(tds[0]).text()),
            cells: tds.slice(1).map((td) => ({
              value: norm($(td).text()),
              cssClass: $(td).hasClass("col-driver")
                ? "col-driver"
                : $(td).hasClass("col-photo")
                  ? "col-photo"
                  : null,
            })),
          };
        }),
    };
  }

  const items = $(".package-price .price-item")
    .toArray()
    .map((el) => {
      const $p = $(el).find(".price").first();
      return {
        label: norm($(el).find(".label").first().text()),
        value: textWithout($, $p, "span"),
        unit: norm($p.find("span").first().text()),
      };
    });

  if (items.length === 0) return null;
  return { kind: "ITEMS" as const, note: "", firstHeader: "", columns: [], rows: [], items };
}

function parseGallery($: Cheerio): GalleryImageOut[] {
  return $(".gallery-grid .gallery-item img")
    .toArray()
    .map((el) => ({ url: $(el).attr("src") ?? "", alt: norm($(el).attr("alt")) }));
}

/**
 * Catatan kuning. Teksnya bisa berisi `<strong>` (mis. nama tombol di dalam
 * catatan Open Trip). Karena isinya disimpan sebagai teks biasa (supaya bisa
 * diedit di panel admin), bagian tebal disimpan memakai konvensi `**tebal**`.
 */
function parseNote($: Cheerio): Note | null {
  const $n = $(".note-box").first();
  if ($n.length === 0) return null;

  const $body = $n.clone();
  $body.find(".note-icon").remove();
  $body.find("strong").each((_, el) => {
    $(el).replaceWith(`**${norm($(el).text())}**`);
  });
  $body.find("br").replaceWith(" ");

  return {
    icon: norm($n.find(".note-icon").first().text()),
    text: norm($body.text()),
  };
}

function parseBenefits($: Cheerio): Benefit[] {
  return $(".benefit-grid .benefit-card")
    .toArray()
    .map((el) => ({
      icon: norm($(el).find(".benefit-icon").first().text()),
      title: norm($(el).find("h4").first().text()),
      description: norm($(el).find("p").first().text()),
    }));
}

function parseTestimonials($: Cheerio): Testimonial[] {
  return $(".testimonial-grid .testimonial-card")
    .toArray()
    .map((el) => {
      const stars = norm($(el).find(".stars").first().text());
      return {
        stars: (stars.match(/\p{Extended_Pictographic}/gu) ?? []).length || 5,
        quote: norm($(el).find(".quote").first().text()),
        author: norm($(el).find(".author").first().clone().children().remove().end().text()),
        location: norm($(el).find(".author span").first().text()),
      };
    });
}

function parseStats($: Cheerio) {
  return $(".stats-bar .stat-item")
    .toArray()
    .map((el) => ({
      num: norm($(el).find(".num").first().text()),
      label: norm($(el).find(".lbl").first().text()),
    }));
}

function parseTypeCards($: Cheerio): TypeCard[] {
  return $(".type-grid .type-card")
    .toArray()
    .map((el) => {
      const href = $(el).attr("href") ?? "";
      return {
        slug: slugFromHref(href),
        icon: norm($(el).find(".type-icon").first().text()),
        title: norm($(el).find("h3").first().text()),
        description: norm($(el).find("p").first().text()),
        price: norm($(el).find(".type-price").first().text()),
        linkLabel: norm($(el).find(".type-link").first().text()),
      };
    });
}

/**
 * Ambil heading sebuah section + konten sesuai jenis grid-nya.
 *
 * `relPath` dipakai untuk membaca jumlah kolom versi desktop dari
 * content/css/manifest.json, karena tiap halaman punya CSS sendiri.
 */
function parseSections($: Cheerio, relPath = ""): Sections {
  const sections: Sections = {};
  const cols = (grid: string, fallback: number) =>
    relPath ? gridColumnsOf(relPath, grid, fallback) : fallback;

  $("section.section").each((_, el) => {
    const $s = $(el);
    const $title = $s.find(".section-title").first();
    const t = splitAccent($, $title);
    const meta = {
      tag: norm($s.find(".section-tag").first().text()),
      title: t.before,
      accent: t.accent,
      suffix: t.after,
      description: norm($s.find(".section-desc").first().text()),
      anchor: norm($s.attr("id")),
    };

    if ($s.find(".type-grid").length > 0) sections.types = { ...meta, cards: parseTypeCards($) };
    else if ($s.find(".trip-grid").length > 0)
      sections.packages = {
        ...meta,
        gridColumns: cols("trip-grid", 3),
        cards: $s
          .find(".trip-grid > .package-card")
          .toArray()
          .map((c) => parseCard($, $(c))),
      };
    else if ($s.find(".package-grid").length > 0)
      sections.packages = {
        ...meta,
        gridColumns: cols("package-grid", 3),
        cards: $s
          .find(".package-grid > .package-card")
          .toArray()
          .map((c) => parseCard($, $(c))),
      };
    else if ($s.find(".benefit-grid").length > 0)
      sections.benefits = { ...meta, cards: parseBenefits($) };
    else if ($s.find(".testimonial-grid").length > 0)
      sections.testimonials = { ...meta, cards: parseTestimonials($) };
    else if ($s.find(".itin-grid").length > 0)
      sections.itinerary = { ...meta, gridColumns: cols("itin-grid", 1), days: parseItinerary($) };
    else if ($s.find(".fasilitas-grid").length > 0)
      sections.facilities = { ...meta, groups: parseFacilities($) };
    else if ($s.find(".price-table-wrap, .price-item").length > 0) {
      const pricing = parsePricing($);
      if (pricing) sections.pricing = { ...meta, ...pricing };
    }
    else if ($s.find(".gallery-grid").length > 0)
      sections.gallery = { ...meta, gridColumns: cols("gallery-grid", 3), images: parseGallery($) };
  });

  return sections;
}

/* ------------------------------------------------------------------ */
/* Ekstraksi per berkas                                               */
/* ------------------------------------------------------------------ */

type DetailOut = {
  relPath: string;
  name: string;
  hero: Hero;
  cta: CtaBanner | null;
  note: Note | null;
  itinerary: Sections["itinerary"];
  facilities: Sections["facilities"];
  pricing: Sections["pricing"];
  gallery: Sections["gallery"];
  cardImages: string[];
};

function extractDetail(relPath: string): DetailOut {
  const $ = loadHtml(relPath);
  const sections = parseSections($, relPath);
  const hero = parseHero($);
  const t = splitAccent($, $(".hero h1").first());
  return {
    relPath,
    name: norm([t.before, t.accent, t.after].filter(Boolean).join(" ")),
    hero,
    cta: parseCtaBanner($),
    note: parseNote($),
    itinerary: sections.itinerary ?? null,
    facilities: sections.facilities ?? null,
    pricing: sections.pricing ?? null,
    gallery: sections.gallery ?? null,
    cardImages: (sections.gallery?.images ?? []).map((g) => g.url),
  };
}

function extractListing(relPath: string): ListingOut {
  const $ = loadHtml(relPath);
  const sections = parseSections($, relPath);
  const cta = parseCtaBanner($);

  return {
    relPath,
    hero: parseHero($),
    cta,
    note: parseNote($),
    packagesSection: sections.packages ?? null,
    benefitsSection: sections.benefits ?? null,
    typesSection: sections.types ?? null,
    stats: parseStats($),
    testimonialsSection: sections.testimonials ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* Main                                                               */
/* ------------------------------------------------------------------ */

/** "Djawatan, Baluran" -> "djawatan-baluran" */
function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

function uniqueSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

function listDetailFiles(key: CategoryKey): string[] {
  const dir = join(HTML_ROOT, "detail page", CATEGORY_META[key].detailDir);
  try {
    return readdirSync(dir)
      .filter((f) => f.toLowerCase().endsWith(".html"))
      .sort()
      .map((f) => join("detail page", CATEGORY_META[key].detailDir, f));
  } catch {
    return [];
  }
}

/**
 * Melengkapi field yang masih kosong pada `target` dengan nilai dari `source`.
 * Dipakai untuk menggabungkan kartu yang sama dari dua sumber: listing
 * kategori (lengkap untuk harga/fasilitas) dan beranda (lengkap untuk
 * `highlight`). Nilai yang sudah ada tidak ditimpa.
 */
function fillMissing(target: Card, source: Card): void {
  const empty = (v: unknown) => v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);

  for (const key of Object.keys(target) as (keyof Card)[]) {
    if (empty(target[key]) && !empty(source[key])) {
      (target[key] as unknown) = source[key];
    }
  }

  // `loc` sengaja tidak ikut fillMissing: kartu listing dan kartu beranda
  // memang memakai label berbeda untuk paket yang sama (mis. "Green Island"
  // di kategori vs "Rute Kombinasi" di beranda).
  if (!empty(source.homeLoc)) target.homeLoc = source.homeLoc;
  if (!target.isPromoted) target.isPromoted = source.isPromoted;
}

function main() {
  const home = extractListing(HOMEPAGE_FILE);

  const typeCards = home.typesSection?.cards ?? [];
  const typeCardBySlug = new Map<string | null, TypeCard>(
    typeCards.map((c) => [c.slug, c]),
  );

  // Kartu beranda yang slug-nya sudah diganti (lihat HOME_CARD_REPLACEMENT)
  // dibuang, supaya tidak menyumbangkan highlight ke paket yang salah.
  const homeFavorites = (home.packagesSection?.cards ?? []).filter(
    (card) => !card.slug || HOME_CARD_REPLACEMENT[card.slug] === undefined,
  );

  // Paket yang harus muncul di beranda: kartu beranda yang valid, ditambah
  // paket pengganti dari kartu yang dibuang.
  const homeFavoriteNames = new Set<string>();
  for (const card of homeFavorites) if (card.name) homeFavoriteNames.add(card.name);
  for (const replacement of Object.values(HOME_CARD_REPLACEMENT)) {
    homeFavoriteNames.add(replacement);
  }

  const categories: CategoryOut[] = [];
  const packages: PackageOut[] = [];
  const warnings: string[] = [];

  for (const key of Object.keys(CATEGORY_META) as CategoryKey[]) {
    const meta = CATEGORY_META[key];
    const listing = extractListing(LISTING_FILE[key]);
    const cardByName = new Map<string, Card>();

    // Kartu dari halaman listing kategori (lebih lengkap, jadi menang)
    for (const card of listing.packagesSection?.cards ?? []) {
      if (card.name) cardByName.set(card.name, card);
    }
    // Kartu dari beranda dipakai untuk melengkapi field yang tidak ada di
    // listing — misalnya `highlight`, yang hanya tampil di homepage — dan
    // sekaligus menambah kartu baru (mis. kategori 4D3N yang tidak punya
    // halaman listing).
    for (const card of homeFavorites) {
      if (!card.name) continue;
      const existing = cardByName.get(card.name);
      if (!existing) cardByName.set(card.name, card);
      else fillMissing(existing, card);
    }

    const typeCard = typeCardBySlug.get(meta.slug);

    categories.push({
      key,
      slug: meta.slug,
      sourceFile: manifestKey(LISTING_FILE[key]),
      navLabel: typeCard?.title ?? listing.hero.title,
      order: meta.order,
      kind: key === "openTrip" ? "OPEN_TRIP" : "PRIVATE",
      duration: (typeCard?.title ?? "").replace(/^Private\s+/i, "").trim(),
      cardIcon: typeCard?.icon ?? "",
      cardDescription: typeCard?.description ?? "",
      cardPrice: typeCard?.price ?? "",
      cardLinkLabel: typeCard?.linkLabel ?? "",
      hero: listing.hero,
      cta: listing.cta,
      listing: listing.packagesSection
        ? {
            tag: listing.packagesSection.tag,
            title: listing.packagesSection.title,
            accent: listing.packagesSection.accent,
            suffix: listing.packagesSection.suffix,
            description: listing.packagesSection.description,
            anchor: listing.packagesSection.anchor || "paket",
            gridColumns: listing.packagesSection.gridColumns ?? 3,
            cardVariant: key === "openTrip" ? "opentrip" : "default",
          }
        : null,
      note: listing.note,
      benefits: listing.benefitsSection
        ? {
            tag: listing.benefitsSection.tag,
            title: listing.benefitsSection.title,
            accent: listing.benefitsSection.accent,
            suffix: listing.benefitsSection.suffix,
            description: listing.benefitsSection.description,
            anchor: listing.benefitsSection.anchor,
            items: listing.benefitsSection.cards,
          }
        : null,
    });

    // Halaman detail milik kategori ini
    const detailFiles =
      key === "4d3n" ? [LISTING_FILE[key]] : listDetailFiles(key);

    // Rute open trip hanya punya kartu (belum ada halaman detail).
    // Tetap dibuat sebagai Package agar bisa dikelola dari panel admin.
    const detailNames = new Set<string>();
    const cardless: Card[] = [];
    for (const relPath of detailFiles) {
      detailNames.add(extractDetail(relPath).name);
    }
    for (const card of listing.packagesSection?.cards ?? []) {
      if (!card.name || detailNames.has(card.name)) continue;
      cardless.push(card);
    }

    for (const card of cardless) {
      const slug = uniqueSlug(
        `open-trip-${slugify(card.name)}`,
        new Set(packages.map((p) => p.slug)),
      );
      packages.push({
        slug,
        categorySlug: meta.slug,
        sourceFile: manifestKey(LISTING_FILE[key]),
        kind: "OPEN_TRIP",
        name: card.name,
        cardVariant: "opentrip",
        card,
        hasDetailPage: false,
        isFeatured: card.isPromoted,
        showOnHome: false,
        hero: null,
        cta: null,
        note: null,
        itinerary: null,
        facilities: null,
        pricing: null,
        gallery: null,
        waMessage: card.waMessage ?? "",
      });
    }

    for (const relPath of detailFiles) {
      const detail = extractDetail(relPath);
      const card = cardByName.get(detail.name);

      const slug = IMPLICIT_SLUG[relPath] ?? card?.slug;

      if (!slug) {
        warnings.push(`[slug] ${relPath} — nama "${detail.name}" tidak ketemu kartu listing`);
        continue;
      }
      if (!card) {
        warnings.push(`[kartu] ${relPath} — tidak ada kartu untuk "${detail.name}"`);
      }

      // Paket pengganti kartu beranda yang rusak tetap butuh `.package-highlight`,
      // karena kartu di beranda selalu punya baris ringkasan itu.
      const homeHighlight = HOME_CARD_HIGHLIGHT[detail.name];
      const mergedCard =
        card && (homeHighlight || HOME_CARD_HIGHLIGHT_LOC[detail.name])
          ? {
              ...card,
              highlight: card.highlight || (homeHighlight ?? ""),
              homeLoc: card.homeLoc || (HOME_CARD_HIGHLIGHT_LOC[detail.name] ?? ""),
            }
          : card;

      packages.push({
        slug,
        categorySlug: meta.slug,
        sourceFile: manifestKey(relPath),
        kind: card?.isWhatsappLink || key === "openTrip" ? "OPEN_TRIP" : "PRIVATE",
        name: detail.name,
        cardVariant: key === "openTrip" ? "opentrip" : "default",
        card: mergedCard ?? null,
        hasDetailPage: true,
        isFeatured: Boolean(card?.isPromoted),
        showOnHome: homeFavoriteNames.has(detail.name),
        hero: detail.hero,
        cta: detail.cta,
        note: detail.note,
        itinerary: detail.itinerary,
        facilities: detail.facilities,
        pricing: detail.pricing,
        gallery: detail.gallery,
        waMessage:
          card?.waMessage ??
          waMessageFromHref(detail.hero.ctaPrimaryHref) ??
          waMessageFromHref(detail.cta?.href) ??
          "",
      });
    }
  }

  const settings = {
    siteName: "Holiday Banyuwangi",
    siteUrl: SITE,
    logoVariant: "svg",
    waNumber: "628133111543",
    email: "banyuwangiholliday@gmail.com",
    instagram: "https://www.instagram.com/holiday.banyuwangi/",
    tiktok: "https://www.tiktok.com/@holiday.banyuwangi_",
    footerText:
      "Follow & DM kami buat info trip terbaru, promo seru, dan keseruan lainnya seputar Banyuwangi.",
    footerHeading: "Yuk, Mulai Petualanganmu! 🌴",
    copyrightText: "© 2026 Holiday Banyuwangi. All Rights Reserved.",
    footerMadeWith: "Made with",
    footerLocation: "in Banyuwangi",
    footerHeart: "🌴",
    homeHeroBadges: home.hero.badges,
    homeHeroTitle: home.hero.title,
    homeHeroAccent: home.hero.accent,
    homeHeroSuffix: home.hero.suffix,
    homeHeroText: home.hero.description,
    homeHeroDecos: home.hero.decos,
    homeHeroPrimaryLabel: home.hero.ctaPrimaryLabel,
    homeHeroSecondaryLabel: home.hero.ctaSecondaryLabel,
    homeHeroSecondaryAnchor: "#tipe-trip",
    homeTypesTag: home.typesSection?.tag ?? "",
    homeTypesTitle: home.typesSection?.title ?? "",
    homeTypesAccent: home.typesSection?.accent ?? "",
    homeTypesSuffix: home.typesSection?.suffix ?? "",
    homeTypesDesc: home.typesSection?.description ?? "",
    homeTypesAnchor: "tipe-trip",
    homeGridColumns: gridColumnsOf(HOMEPAGE_FILE, "package-grid", 3),
    homeFavTag: home.packagesSection?.tag ?? "",
    homeFavTitle: home.packagesSection?.title ?? "",
    homeFavAccent: home.packagesSection?.accent ?? "",
    homeFavSuffix: home.packagesSection?.suffix ?? "",
    homeFavDesc: home.packagesSection?.description ?? "",
    homeBenefitsTag: home.benefitsSection?.tag ?? "",
    homeBenefitsTitle: home.benefitsSection?.title ?? "",
    homeBenefitsAccent: home.benefitsSection?.accent ?? "",
    homeBenefitsDesc: home.benefitsSection?.description ?? "",
    homeBenefitsSuffix: home.benefitsSection?.suffix ?? "",
    homeTestiTag: home.testimonialsSection?.tag ?? "",
    homeTestiTitle: home.testimonialsSection?.title ?? "",
    homeTestiAccent: home.testimonialsSection?.accent ?? "",
    homeTestiSuffix: home.testimonialsSection?.suffix ?? "",
    homeTestiDesc: home.testimonialsSection?.description ?? "",
    ctaTitle: home.cta?.title ?? "",
    ctaText: home.cta?.text ?? "",
    ctaLabel: home.cta?.label ?? "",
    ctaMessage: waMessageFromHref(home.cta?.href) ?? "",
  };

  const output = {
    settings,
    homeStats: home.stats,
    homeBenefits: home.benefitsSection?.cards ?? [],
    testimonials: home.testimonialsSection?.cards ?? [],
    categories,
    packages,
    warnings,
  };

  mkdirSync(resolve(process.cwd(), "content"), { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(output, null, 2), "utf8");

  console.log(`Kategori : ${categories.length}`);
  console.log(`Paket    : ${packages.length}`);
  console.log(`Peringatan: ${warnings.length}`);
  for (const w of warnings) console.log("  ! " + w);
  console.log(`\nDitulis  -> ${OUT_FILE}`);
}

main();

