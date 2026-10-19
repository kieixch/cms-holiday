/**
 * Bentuk data halaman link-bio (`/bio/<slug>`) yang disimpan terstruktur,
 * bukan sebagai dokumen HTML utuh.
 *
 * Modul murni: tidak mengimpor Prisma, React, maupun `server-only`, jadi bisa
 * dipakai di server (route publik, server action), di client (komponen
 * `<BioLinkPage>` dan live preview), dan di skrip seed.
 *
 * Nama kunci di sini SENGAJA sama persis dengan `name` field di
 * `@/lib/admin/sosmed-fields`, supaya nilai draft form bisa dipetakan langsung
 * ke `BioLinkPageData` tanpa lapisan penerjemah tambahan.
 */

export type BioSchedule = "everyday" | "weekend" | "weekday";

export type BioOpenTrip = {
  name: string;
  schedule: BioSchedule;
  price: number;
};

export type BioItineraryStep = { time: string; text: string };
export type BioItineraryDay = { day: string; steps: BioItineraryStep[] };

export type BioPriceColumn = { key: string; label: string };
export type BioPriceRow = { pax: number; values: Record<string, string> };

export type BioPackage = {
  emoji: string;
  /** Ikon gambar opsional; bila terisi menggantikan emoji di kartu. */
  image: string | null;
  badge: string;
  /** Badge hijau kalau true, oranye kalau false. */
  badgeAlt: boolean;
  name: string;
  desc: string;
  meta: string[];
  itinerary: BioItineraryDay[];
  priceColumns: BioPriceColumn[];
  prices: BioPriceRow[];
  includes: string[];
  excludes: string[];
  note: string;
};

export type BioGalleryImage = { url: string; alt: string };

export type BioLinkPageData = {
  // Hero
  logo: string | null;
  logoAlt: string;
  brand: string;
  tag: string;
  subtitle: string;
  chips: string[];
  waNumber: string;
  /** Sapaan pembuka untuk pesan dinamis Open Trip / Private Trip. */
  waGreeting: string;
  /** Link rotator (mis. Bitly) yang menggantikan wa.me tombol hero. Kosong = wa.me. */
  waLink: string;
  waLabel: string;
  waHint: string;
  waMessageTop: string;

  // Open Trip
  openTripLabel: string;
  openTrips: BioOpenTrip[];
  openTripNote: string;

  // Private Trip
  privateTripLabel: string;
  packages: BioPackage[];

  // Galeri
  galleryLabel: string;
  gallery: BioGalleryImage[];

  // CTA
  ctaTitle: string;
  ctaText: string;
  ctaLabel: string;
  ctaMessage: string;

  // Footer
  footerText: string;
  footerLegal: string;
};

export const SCHEDULE_OPTIONS: { value: BioSchedule; label: string }[] = [
  { value: "everyday", label: "Setiap hari" },
  { value: "weekend", label: "Weekend" },
  { value: "weekday", label: "Weekday" },
];

/** Nilai awal halaman link-bio (juga dipakai pratinjau "halaman baru"). */
export function emptyBio(): BioLinkPageData {
  return {
    logo: null,
    logoAlt: "",
    brand: "",
    tag: "",
    subtitle: "",
    chips: [],
    waNumber: "",
    waGreeting: "",
    waLink: "",
    waLabel: "",
    waHint: "",
    waMessageTop: "",
    openTripLabel: "",
    openTrips: [],
    openTripNote: "",
    privateTripLabel: "",
    packages: [],
    galleryLabel: "",
    gallery: [],
    ctaTitle: "",
    ctaText: "",
    ctaLabel: "",
    ctaMessage: "",
    footerText: "",
    footerLegal: "",
  };
}

/* ------------------------------------------------------------------ */
/* Baca nilai JSON tersimpan dengan aman                              */
/* ------------------------------------------------------------------ */

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return fallback;
}

function asBool(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value.replace(/[^\d.-]/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asString(item)).filter((item) => item !== "");
}

function asSchedule(value: unknown): BioSchedule {
  return value === "weekend" || value === "weekday" ? value : "everyday";
}

function toOpenTrip(value: unknown): BioOpenTrip {
  const o = isObject(value) ? value : {};
  return {
    name: asString(o.name),
    schedule: asSchedule(o.schedule),
    price: asNumber(o.price),
  };
}

function toItineraryStep(value: unknown): BioItineraryStep {
  const o = isObject(value) ? value : {};
  return { time: asString(o.time), text: asString(o.text) };
}

function toItineraryDay(value: unknown): BioItineraryDay {
  const o = isObject(value) ? value : {};
  return {
    day: asString(o.day),
    steps: Array.isArray(o.steps) ? o.steps.map(toItineraryStep) : [],
  };
}

function toPriceColumn(value: unknown): BioPriceColumn {
  const o = isObject(value) ? value : {};
  return { key: asString(o.key), label: asString(o.label) };
}

function toPriceRow(value: unknown): BioPriceRow {
  const o = isObject(value) ? value : {};
  const raw = isObject(o.values) ? o.values : {};
  const values: Record<string, string> = {};
  for (const [key, cell] of Object.entries(raw)) {
    const text = asString(cell);
    if (text !== "") values[key] = text;
  }
  return { pax: asNumber(o.pax), values };
}

function toPackage(value: unknown): BioPackage {
  const o = isObject(value) ? value : {};
  return {
    emoji: asString(o.emoji),
    image: typeof o.image === "string" && o.image !== "" ? o.image : null,
    badge: asString(o.badge),
    badgeAlt: asBool(o.badgeAlt),
    name: asString(o.name),
    desc: asString(o.desc),
    meta: asStringArray(o.meta),
    itinerary: Array.isArray(o.itinerary) ? o.itinerary.map(toItineraryDay) : [],
    priceColumns: Array.isArray(o.priceColumns) ? o.priceColumns.map(toPriceColumn) : [],
    prices: Array.isArray(o.prices) ? o.prices.map(toPriceRow) : [],
    includes: asStringArray(o.includes),
    excludes: asStringArray(o.excludes),
    note: asString(o.note),
  };
}

function toGalleryImage(value: unknown): BioGalleryImage {
  const o = isObject(value) ? value : {};
  return { url: asString(o.url), alt: asString(o.alt) };
}

/** Ubah kolom `HtmlPage.bio` (JSON apa pun) jadi data siap render. */
export function normalizeBio(value: unknown): BioLinkPageData {
  const base = emptyBio();
  if (!isObject(value)) return base;
  return {
    logo: typeof value.logo === "string" && value.logo !== "" ? value.logo : null,
    logoAlt: asString(value.logoAlt),
    brand: asString(value.brand),
    tag: asString(value.tag),
    subtitle: asString(value.subtitle),
    chips: asStringArray(value.chips),
    waNumber: asString(value.waNumber),
    waGreeting: asString(value.waGreeting),
    waLink: asString(value.waLink),
    waLabel: asString(value.waLabel),
    waHint: asString(value.waHint),
    waMessageTop: asString(value.waMessageTop),
    openTripLabel: asString(value.openTripLabel),
    openTrips: Array.isArray(value.openTrips) ? value.openTrips.map(toOpenTrip) : [],
    openTripNote: asString(value.openTripNote),
    privateTripLabel: asString(value.privateTripLabel),
    packages: Array.isArray(value.packages) ? value.packages.map(toPackage) : [],
    galleryLabel: asString(value.galleryLabel),
    gallery: Array.isArray(value.gallery) ? value.gallery.map(toGalleryImage) : [],
    ctaTitle: asString(value.ctaTitle),
    ctaText: asString(value.ctaText),
    ctaLabel: asString(value.ctaLabel),
    ctaMessage: asString(value.ctaMessage),
    footerText: asString(value.footerText),
    footerLegal: asString(value.footerLegal),
  };
}

/* ------------------------------------------------------------------ */
/* Helper tampilan                                                    */
/* ------------------------------------------------------------------ */

/** Angka rupiah dari teks apa pun: "235000" / "Rp235.000" -> "Rp235.000". */
export function formatRupiah(input: string | number): string {
  const digits = String(input).replace(/[^\d]/g, "");
  if (digits === "") return "";
  return `Rp${Number(digits).toLocaleString("id-ID")}`;
}

/**
 * Harga terendah sebuah paket private — memakai kolom pertama seperti situs
 * asli, jatuh ke semua kolom kalau kolom pertama kosong.
 */
export function packageMinPrice(pkg: BioPackage): number {
  const first = pkg.priceColumns[0]?.key;
  const candidates: number[] = [];
  for (const row of pkg.prices) {
    const source = first && row.values[first] ? [row.values[first]] : Object.values(row.values);
    for (const cell of source) {
      const n = Number(cell.replace(/[^\d]/g, ""));
      if (Number.isFinite(n) && n > 0) candidates.push(n);
    }
  }
  return candidates.length ? Math.min(...candidates) : 0;
}

/** Nomor WhatsApp jadi digit saja, tanpa `+` / spasi / tanda hubung. */
export function waDigits(number: string): string {
  return number.replace(/[^\d]/g, "");
}

/** Bangun tautan `wa.me` dari nomor dan pesan. */
export function waHref(number: string, message: string): string {
  const digits = waDigits(number);
  const text = encodeURIComponent(message);
  return `https://wa.me/${digits}?text=${text}`;
}
