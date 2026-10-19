import type {
  CategoryBodyData,
  HomeBodyProps,
  PackageBodyData,
} from "@/components/site/views";
import type { PageCardData } from "@/components/site/page-cards";

import { normalizeBio, type BioLinkPageData } from "@/lib/bio";

import type { HtmlPagePreviewBase } from "./preview-base";
import { syncDetailLinks, type PackagePreviewData } from "./package-detail-links";

/**
 * Ubah nilai draft form menjadi data untuk `<HomeBody>` / `<CategoryBody>` /
 * `<PackageBody>`.
 *
 * Live preview tidak boleh memanggil `getPackagePage()` — nilainya harus
 * berasal dari yang diketik user, belum tersimpan. Jadi bentuk datanya
 * dibangun dari `values`, sementara bagian yang tidak ada di form (mis.
 * daftar paket lain di kategori) diambil dari `base` hasil query server.
 *
 * Semua pembacaan values_write defensif: draft bisa setengah jadi — teks yang
 * dikosongkan, repeater yang baru ditambah tapi belum diisi, `undefined` dari
 * field yang belum pernah disentuh. Preview tidak boleh melempar error hanya
 * karena user sedang mengetik.
 */

type Values = Record<string, unknown>;

function str(values: Values, key: string, fallback: string): string {
  const value = values[key];
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function strOrNull(values: Values, key: string): string | null {
  const value = values[key];
  if (value === null || value === undefined) return null;
  return String(value);
}

function bool(values: Values, key: string, fallback: boolean): boolean {
  const value = values[key];
  return typeof value === "boolean" ? value : fallback;
}

function num(values: Values, key: string, fallback: number): number {
  const value = values[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function list(values: Values, key: string): string[] {
  const value = values[key];
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "")).filter((item) => item !== "");
}

function rows(values: Values, key: string): Values[] {
  const value = values[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Values => typeof item === "object" && item !== null);
}

/* ------------------------------------------------------------------ */
/* Kategori                                                           */
/* ------------------------------------------------------------------ */

export function categoryPreview(base: CategoryBodyData, values: Values): CategoryBodyData {
  return {
    ...base,
    gridColumns: num(values, "gridColumns", base.gridColumns),
    heroBadges: list(values, "heroBadges"),
    heroTitle: str(values, "heroTitle", base.heroTitle),
    heroAccent: str(values, "heroAccent", base.heroAccent),
    heroSuffix: str(values, "heroSuffix", base.heroSuffix),
    heroDescription: str(values, "heroDescription", base.heroDescription),
    heroDecos: list(values, "heroDecos"),
    heroImage: strOrNull(values, "heroImage"),
    heroImageAlt: strOrNull(values, "heroImageAlt"),
    heroWaLink: str(values, "heroWaLink", base.heroWaLink),
    ctaPrimaryLabel: str(values, "ctaPrimaryLabel", base.ctaPrimaryLabel),
    ctaSecondaryLabel: str(values, "ctaSecondaryLabel", base.ctaSecondaryLabel),
    ctaSecondaryAnchor: str(values, "ctaSecondaryAnchor", base.ctaSecondaryAnchor),
    ctaMessage: str(values, "ctaMessage", base.ctaMessage),
    ctaWaNumber: str(values, "ctaWaNumber", base.ctaWaNumber),
    ctaWaGreeting: str(values, "ctaWaGreeting", base.ctaWaGreeting),
    ctaTitle: str(values, "ctaTitle", base.ctaTitle),
    ctaText: str(values, "ctaText", base.ctaText),
    ctaLabel: str(values, "ctaLabel", base.ctaLabel),
    ctaWaLink: str(values, "ctaWaLink", base.ctaWaLink),
    ctaBackground: strOrNull(values, "ctaBackground"),
    waNumber: str(values, "waNumber", base.waNumber),
    waGreeting: str(values, "waGreeting", base.waGreeting),
    waMessage: str(values, "waMessage", base.waMessage),
    listingTag: str(values, "listingTag", base.listingTag),
    listingTitle: str(values, "listingTitle", base.listingTitle),
    listingAccent: str(values, "listingAccent", base.listingAccent),
    listingSuffix: str(values, "listingSuffix", base.listingSuffix),
    listingDescription: str(values, "listingDescription", base.listingDescription),
    listingAnchor: str(values, "listingAnchor", base.listingAnchor),
    listingNoteIcon: strOrNull(values, "listingNoteIcon"),
    listingNoteText: strOrNull(values, "listingNoteText"),
    pgAnchor: str(values, "pgAnchor", base.pgAnchor),
    pgTag: str(values, "pgTag", base.pgTag),
    pgTitle: str(values, "pgTitle", base.pgTitle),
    pgAccent: str(values, "pgAccent", base.pgAccent),
    pgSuffix: str(values, "pgSuffix", base.pgSuffix),
    pgDesc: str(values, "pgDesc", base.pgDesc),
    benefitsTag: str(values, "benefitsTag", base.benefitsTag),
    benefitsTitle: str(values, "benefitsTitle", base.benefitsTitle),
    benefitsAccent: str(values, "benefitsAccent", base.benefitsAccent),
    benefitsSuffix: str(values, "benefitsSuffix", base.benefitsSuffix),
    benefitsDescription: str(values, "benefitsDescription", base.benefitsDescription),
    benefits: rows(values, "benefits").map((item, index) => ({
      id: `draft-${index}`,
      icon: str(item, "icon", ""),
      title: str(item, "title", ""),
      description: str(item, "description", ""),
    })),
  };
}

/** Kartu kategori di beranda — field yang sama, tapi tanpa daftar paket. */
export function categoryTypeCard(base: CategoryBodyData, values: Values) {
  return {
    slug: base.slug,
    name: str(values, "navLabel", base.slug),
    icon: str(values, "cardIcon", ""),
    description: str(values, "cardDescription", ""),
    price: str(values, "cardPrice", ""),
    linkLabel: str(values, "cardLinkLabel", ""),
    image: strOrNull(values, "cardImage"),
    imageAlt: strOrNull(values, "cardImageAlt"),
  };
}

/* ------------------------------------------------------------------ */
/* Paket                                                              */
/* ------------------------------------------------------------------ */

export function packagePreview(base: PackagePreviewData, values: Values): PackageBodyData {
  // Tombol kartu dan tombol hero ikut aturan halaman detail, jadi preview
  // memakai helper yang sama dengan `savePackageAction`. Tanpa ini, mengetuk
  // "Punya halaman detail" tidak mengubah apa pun sampai form disimpan.
  const links = syncDetailLinks({
    kind: base.kind,
    hasDetailPage: bool(values, "hasDetailPage", base.hasDetailPage),
    cardLinkMode: str(values, "cardLinkMode", base.cardLinkMode ?? ""),
    cardButtonLabel: str(values, "cardButtonLabel", base.cardButtonLabel ?? ""),
    ctaPrimaryLabel: str(values, "ctaPrimaryLabel", base.ctaPrimaryLabel),
  });

  return {
    ...base,
    slug: str(values, "slug", base.slug),
    waMessage: str(values, "waMessage", base.waMessage),
    waNumber: str(values, "waNumber", base.waNumber),
    waGreeting: str(values, "waGreeting", base.waGreeting),
    // Badan halaman hanya merender hero, jadi `cardLinkMode` / `cardButtonLabel`
    // tidak ikut di sini — kartu disusun terpisah oleh `packageCardPreview()`.
    ctaPrimaryLabel: links.ctaPrimaryLabel,
    heroBadges: list(values, "heroBadges"),
    heroTitle: str(values, "heroTitle", base.heroTitle),
    heroAccent: str(values, "heroAccent", base.heroAccent),
    heroSuffix: str(values, "heroSuffix", base.heroSuffix),
    heroDescription: str(values, "heroDescription", base.heroDescription),
    heroDecos: list(values, "heroDecos"),
    heroImage: strOrNull(values, "heroImage"),
    heroImageAlt: strOrNull(values, "heroImageAlt"),
    heroWaLink: str(values, "heroWaLink", base.heroWaLink),
    ctaSecondaryLabel: str(values, "ctaSecondaryLabel", base.ctaSecondaryLabel),
    ctaSecondaryAnchor: str(values, "ctaSecondaryAnchor", base.ctaSecondaryAnchor),
    ctaMessage: str(values, "ctaMessage", base.ctaMessage),
    ctaWaNumber: str(values, "ctaWaNumber", base.ctaWaNumber),
    ctaWaGreeting: str(values, "ctaWaGreeting", base.ctaWaGreeting),
    ctaTitle: str(values, "ctaTitle", base.ctaTitle),
    ctaText: str(values, "ctaText", base.ctaText),
    ctaLabel: str(values, "ctaLabel", base.ctaLabel),
    ctaWaLink: str(values, "ctaWaLink", base.ctaWaLink),
    ctaBackground: strOrNull(values, "ctaBackground"),

    jadwalTag: str(values, "jadwalTag", base.jadwalTag),
    jadwalTitle: str(values, "jadwalTitle", base.jadwalTitle),
    jadwalAccent: str(values, "jadwalAccent", base.jadwalAccent),
    jadwalSuffix: str(values, "jadwalSuffix", base.jadwalSuffix),
    jadwalDescription: str(values, "jadwalDescription", base.jadwalDescription),
    jadwalAnchor: str(values, "jadwalAnchor", base.jadwalAnchor),
    schedule: rows(values, "schedule").map((item, index) => ({
      id: `draft-${index}`,
      day: num(item, "day", 1),
      month: str(item, "month", ""),
      year: num(item, "year", new Date().getFullYear()),
      description: str(item, "description", ""),
    })),

    itineraryTag: str(values, "itineraryTag", base.itineraryTag),
    itineraryTitle: str(values, "itineraryTitle", base.itineraryTitle),
    itineraryAccent: str(values, "itineraryAccent", base.itineraryAccent),
    itinerarySuffix: str(values, "itinerarySuffix", base.itinerarySuffix),
    itineraryDescription: str(values, "itineraryDescription", base.itineraryDescription),
    itineraryAnchor: str(values, "itineraryAnchor", base.itineraryAnchor),
    itineraryColumns: num(values, "itineraryColumns", base.itineraryColumns),
    itinerary: rows(values, "itinerary").map((item, index) => ({
      id: `draft-${index}`,
      emoji: str(item, "emoji", ""),
      label: str(item, "label", ""),
      title: str(item, "title", ""),
      items: rows(item, "items").map((child) => ({
        time: str(child, "time", ""),
        text: str(child, "text", ""),
      })),
    })),

    facilityTag: str(values, "facilityTag", base.facilityTag),
    facilityTitle: str(values, "facilityTitle", base.facilityTitle),
    facilityAccent: str(values, "facilityAccent", base.facilityAccent),
    facilitySuffix: str(values, "facilitySuffix", base.facilitySuffix),
    facilityDescription: str(values, "facilityDescription", base.facilityDescription),
    facilities: rows(values, "facilities").map((item, index) => ({
      id: `draft-${index}`,
      variant: str(item, "variant", "INCLUDE"),
      title: str(item, "title", ""),
      items: rows(item, "items").map((child) => ({
        icon: str(child, "icon", ""),
        text: str(child, "text", ""),
      })),
    })),

    notes: rows(values, "notes").map((item, index) => ({
      id: `draft-${index}`,
      icon: str(item, "icon", "ℹ️"),
      text: str(item, "text", ""),
    })),

    pricingTag: str(values, "pricingTag", base.pricingTag),
    pricingTitle: str(values, "pricingTitle", base.pricingTitle),
    pricingAccent: str(values, "pricingAccent", base.pricingAccent),
    pricingSuffix: str(values, "pricingSuffix", base.pricingSuffix),
    pricingDescription: str(values, "pricingDescription", base.pricingDescription),
    pricing: pricingPreview(values),

    galleryTag: str(values, "galleryTag", base.galleryTag),
    galleryTitle: str(values, "galleryTitle", base.galleryTitle),
    galleryAccent: str(values, "galleryAccent", base.galleryAccent),
    gallerySuffix: str(values, "gallerySuffix", base.gallerySuffix),
    galleryDescription: str(values, "galleryDescription", base.galleryDescription),
    galleryColumns: num(values, "galleryColumns", base.galleryColumns),
    gallery: rows(values, "gallery")
      .map((item, index) => ({ id: `draft-${index}`, url: str(item, "url", ""), alt: str(item, "alt", "") }))
      .filter((item) => item.url !== ""),
  };
}

/**
 * Tabel harga pada draft.
 *
 * Nilai sel dikunci ke `key` kolom, bukan ke id database — kolom dibuat ulang
 * setiap kali disimpan, jadi id lama tidak bisa jadi rujukan yang stabil
 * selama editing. `key` dipakai sebagai `id` untuk kolom maupun sel, supaya
 * `<Pricing>` bisa mencocokkan keduanya seperti data aslinya.
 */
function pricingPreview(values: Values) {
  const columns = rows(values, "pricingColumns")
    .map((item, index) => ({
      id: str(item, "key", "") || `col-${index}`,
      label: str(item, "label", ""),
      cssClass: str(item, "cssClass", ""),
    }))
    .filter((column) => column.label !== "");

  return {
    kind: str(values, "pricingKind", "TABLE"),
    note: strOrNull(values, "pricingNote"),
    rowHeaderLabel: strOrNull(values, "pricingRowHeaderLabel"),
    columns: columns.map((column) => ({
      id: column.id,
      label: column.label,
      cssClass: column.cssClass === "" ? null : column.cssClass,
    })),
    rows: rows(values, "pricingRows").map((item, index) => {
      const raw = item.values;
      const cells = typeof raw === "object" && raw !== null && !Array.isArray(raw) ? (raw as Values) : {};
      return {
        id: `row-${index}`,
        label: str(item, "label", ""),
        values: columns
          .map((column) => ({ columnId: column.id, value: str(cells, column.id, "") }))
          .filter((cell) => cell.value !== ""),
      };
    }),
    items: rows(values, "pricingItems").map((item) => ({
      label: str(item, "label", ""),
      value: str(item, "value", ""),
      unit: strOrNull(item, "unit"),
    })),
  };
}

/** Kartu paket di listing, untuk melihat efek field kartu di preview. */
export function packageCardPreview(base: PackagePreviewData, values: Values) {
  // Sama seperti `packagePreview()`: kartu ikut aturan halaman detail, supaya
  // tombolnya ikut berubah di preview begitu checkbox-nya dicentang.
  const links = syncDetailLinks({
    kind: base.kind,
    hasDetailPage: bool(values, "hasDetailPage", base.hasDetailPage),
    cardLinkMode: str(values, "cardLinkMode", base.cardLinkMode ?? ""),
    cardButtonLabel: strOrNull(values, "cardButtonLabel") ?? base.cardButtonLabel ?? "",
    ctaPrimaryLabel: strOrNull(values, "ctaPrimaryLabel") ?? base.ctaPrimaryLabel,
  });

  return {
    slug: str(values, "slug", base.slug),
    /**
     * Judul kartu = "Nama paket" (bagian Identitas), bukan judul hero.
     * Dulu kolom ini mengikuti `heroTitle`, sehingga mengedit judul hero
     * diam-diam mengubah judul kartu — padahal di halaman publik keduanya
     * memang dua kolom terpisah.
     */
    name: str(values, "name", base.name),
    isFeatured: bool(values, "isFeatured", base.isFeatured),
    cardVariant: str(values, "cardVariant", "default"),
    cardLinkMode: links.cardLinkMode,
    cardImage: strOrNull(values, "cardImage"),
    cardImageAlt: strOrNull(values, "cardImageAlt"),
    cardLoc: strOrNull(values, "cardLoc"),
    cardHomeLoc: strOrNull(values, "cardHomeLoc"),
    cardTag: strOrNull(values, "cardTag"),
    cardRating: strOrNull(values, "cardRating"),
    cardHighlight: strOrNull(values, "cardHighlight"),
    cardButtonLabel: links.cardButtonLabel,
    cardWaLink: strOrNull(values, "cardWaLink"),
    waMessage: str(values, "waMessage", ""),
    cardDays: rows(values, "cardDays").map((item) => ({
      label: str(item, "label", ""),
      title: str(item, "title", ""),
    })),
    cardPrices: rows(values, "cardPrices").map((item) => ({
      label: str(item, "label", ""),
      value: str(item, "value", ""),
      unit: strOrNull(item, "unit"),
    })),
    cardFacilities: rows(values, "cardFacilities").map((item) => ({ label: str(item, "label", "") })),
  };
}

/* ------------------------------------------------------------------ */
/* Beranda                                                            */
/* ------------------------------------------------------------------ */

export function homePreview(base: HomeBodyProps, values: Values): HomeBodyProps {
  return {
    settings: { ...base.settings },
    stats: rows(values, "stats").map((item) => ({
      num: str(item, "num", ""),
      label: str(item, "label", ""),
    })),
    benefits: rows(values, "benefits").map((item, index) => ({
      id: `draft-${index}`,
      icon: str(item, "icon", ""),
      title: str(item, "title", ""),
      description: str(item, "description", ""),
    })),
    testimonials: rows(values, "testimonials").map((item) => ({
      stars: num(item, "stars", 5),
      quote: str(item, "quote", ""),
      author: str(item, "author", ""),
      location: str(item, "location", ""),
    })),
    favorites: base.favorites,
    types: base.types,
    // Feed Instagram tidak punya field di form; isinya selalu data tersimpan
    // (atau kosong di preview beranda yang belum pernah terhubung Graph API).
    igPosts: base.igPosts,
    igHasMore: base.igHasMore,
    // Foto galeri pengunjung ikut draft form supaya penambahan/pengurangan
    // foto langsung tampak di preview.
    gallery: rows(values, "gallery")
      .map((item, index) => ({
        id: `draft-${index}`,
        url: str(item, "url", ""),
        alt: str(item, "alt", ""),
      }))
      .filter((item) => item.url !== ""),
  };
}

export function homeSettingsPreview(base: HomeBodyProps, values: Values): HomeBodyProps["settings"] {
  const settings = { ...base.settings };
  const textKeys = [
    "waNumber",
    "waGreeting",
    "waMessage",
    "homeHeroTitle",
    "homeHeroAccent",
    "homeHeroSuffix",
    "homeHeroText",
    "homeHeroPrimaryLabel",
    "homeHeroWaLink",
    "homeHeroSecondaryLabel",
    "homeHeroSecondaryAnchor",
    "homeTypesAnchor",
    "homeTypesTag",
    "homeTypesTitle",
    "homeTypesAccent",
    "homeTypesSuffix",
    "homeTypesDesc",
    "homePgAnchor",
    "homePgTag",
    "homePgTitle",
    "homePgAccent",
    "homePgSuffix",
    "homePgDesc",
    "homeFavTag",
    "homeFavTitle",
    "homeFavAccent",
    "homeFavSuffix",
    "homeFavDesc",
    "homeBenefitsTag",
    "homeBenefitsTitle",
    "homeBenefitsAccent",
    "homeBenefitsSuffix",
    "homeBenefitsDesc",
    "homeTestiTag",
    "homeTestiTitle",
    "homeTestiAccent",
    "homeTestiSuffix",
    "homeTestiDesc",
    "homeIgTag",
    "homeIgTitle",
    "homeIgAccent",
    "homeIgSuffix",
    "homeIgDesc",
    "homeGalleryTag",
    "homeGalleryTitle",
    "homeGalleryAccent",
    "homeGallerySuffix",
    "homeGalleryDesc",
    "homeGalleryAnchor",
    "ctaTitle",
    "ctaText",
    "ctaLabel",
    "ctaMessage",
    "ctaWaNumber",
    "ctaWaGreeting",
    "ctaWaLink",
  ] as const;

  for (const key of textKeys) {
    settings[key] = str(values, key, settings[key]);
  }
  settings.homeHeroBadges = list(values, "homeHeroBadges");
  settings.homeHeroDecos = list(values, "homeHeroDecos");
  settings.homeHeroImage = strOrNull(values, "homeHeroImage");
  settings.homeHeroImageAlt = strOrNull(values, "homeHeroImageAlt");
  settings.homeGridColumns = num(values, "homeGridColumns", settings.homeGridColumns);
  settings.homeGalleryColumns = num(values, "homeGalleryColumns", settings.homeGalleryColumns);
  settings.ctaBackground = strOrNull(values, "ctaBackground");

  const toggleKeys = [
    "homeTypesEnabled",
    "homePgEnabled",
    "homeFavEnabled",
    "homeBenefitsEnabled",
    "homeTestiEnabled",
    "homeIgEnabled",
    "homeGalleryEnabled",
  ] as const;

  for (const key of toggleKeys) {
    settings[key] = bool(values, key, settings[key]);
  }

  return settings;
}

/* ------------------------------------------------------------------ */
/* Halaman HTML mandiri                                                */
/* ------------------------------------------------------------------ */

/**
 * Draft halaman HTML untuk pratinjau editor `/admin/halaman`.
 *
 * `cardVisible` meniru filter query route publik (`isPublished` DAN salah
 * satu penempatan dicentang): kalau false, kartu memang tidak pernah tampil
 * di situs asli, jadi pratinjau menampilkan keterangan alih-alih kartu.
 */
export function htmlPagePreview(base: HtmlPagePreviewBase, values: Values) {
  const isPublished = bool(values, "isPublished", base.isPublished);
  const showOnHome = bool(values, "showOnHome", base.showOnHome);
  // Field kategori berupa multi-select: nilainya `string[]` di state form.
  // Selama field belum pernah disentuh (nilai bukan array), pakai nilai base.
  const rawSlugs = values["categorySlugs"];
  const categorySlugs = Array.isArray(rawSlugs)
    ? rawSlugs.map((v) => String(v ?? "")).filter((v) => v !== "")
    : base.categorySlugs;

  const card: PageCardData = {
    slug: str(values, "slug", base.slug),
    title: str(values, "title", base.title),
    cardTag: str(values, "cardTag", base.cardTag),
    cardTitle: str(values, "cardTitle", base.cardTitle),
    cardDesc: str(values, "cardDesc", base.cardDesc),
    cardButtonLabel: str(values, "cardButtonLabel", base.cardButtonLabel),
    cardImage: strOrNull(values, "cardImage"),
  };

  return {
    html: str(values, "html", base.html),
    slug: str(values, "slug", base.slug),
    card,
    isPublished,
    showOnHome,
    categorySlugs,
    cardVisible: isPublished && (showOnHome || categorySlugs.length > 0),
  };
}

/* ------------------------------------------------------------------ */
/* Halaman link-bio                                                    */
/* ------------------------------------------------------------------ */

/**
 * Draft halaman link-bio untuk pratinjau editor `/admin/sosmed`.
 *
 * Nilai form sudah memakai nama field yang sama dengan `BioLinkPageData`
 * (lihat `sosmedSections`), jadi `normalizeBio` cukup membacanya dengan aman —
 * termasuk saat ada repeater yang baru ditambah tapi belum diisi.
 */
export function bioPreview(values: Values): BioLinkPageData {
  return normalizeBio(values);
}