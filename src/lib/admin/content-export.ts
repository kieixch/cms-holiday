/**
 * Export isi database kembali ke `content/content.json`.
 *
 * Alur konten:
 *   - `scripts/extract-content.ts`  : HTML legacy  -> content.json
 *   - `scripts/import-content.ts`   : content.json -> database
 *   - `content-export.ts` (ini)     : database     -> content.json
 *
 * Tujuannya supaya editan yang dilakukan lewat editor admin (mis. mengganti
 * emoji hari itinerary) tidak hilang saat `pnpm db:seed` dijalankan ulang, dan
 * supaya file konten tetap menjadi satu-satunya sumber yang ikut di-commit.
 *
 * Beberapa metadata yang tidak tersimpan di database (mis. `sourceFile`,
 * `key`, `cardVariant`, anchor seksi tanpa kolom) dipertahankan dari file yang
 * sudah ada supaya audit markup legacy tetap punya acuan.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { prisma } from "@/lib/db";
import type {
  Benefit,
  CategoryKey,
  CategoryOut,
  ContentFile,
  CtaBanner,
  Hero,
  HtmlPageOut,
  PackageOut,
  Sections,
  SiteSettingsOut,
} from "../../../scripts/content-types";

export const CONTENT_FILE = resolve(process.cwd(), "content", "content.json");

/** "paket" -> "#paket"; "" / null -> "". */
function anchorHref(anchor: string | null | undefined): string {
  const value = (anchor ?? "").trim().replace(/^#/, "");
  return value ? `#${value}` : "";
}

/** Bikin URL WhatsApp dari pesan; importer hanya mengambil ulang `text`-nya. */
function waHref(message: string | null | undefined, waNumber: string): string {
  const text = (message ?? "").trim();
  if (!text) return "";
  return `https://wa.me/${waNumber}?text=${encodeURIComponent(text)}`;
}

function readExisting(): ContentFile | null {
  if (!existsSync(CONTENT_FILE)) return null;
  try {
    return JSON.parse(readFileSync(CONTENT_FILE, "utf8")) as ContentFile;
  } catch {
    return null;
  }
}

type HeroRow = {
  heroBadges: string[];
  heroTitle: string;
  heroAccent: string;
  heroSuffix: string;
  heroDescription: string;
  heroDecos: string[];
  heroImage: string | null;
  heroImageAlt: string | null;
  heroWaLink: string;
  ctaPrimaryLabel: string;
  ctaSecondaryLabel: string;
  ctaSecondaryAnchor: string;
};

/**
 * Susun blok hero. Kunci `image` hanya ditulis kalau admin memang mengisi
 * gambar — kalau tidak, kuncinya dibiarkan absen supaya importer tetap memakai
 * fallback lama (foto paket pertama untuk kategori, foto galeri pertama untuk
 * paket) dan tidak ada halaman yang berubah tanpa sengaja.
 */
function buildHero(row: HeroRow): Hero {
  const hero: Hero = {
    badges: row.heroBadges,
    title: row.heroTitle,
    accent: row.heroAccent,
    suffix: row.heroSuffix,
    description: row.heroDescription,
    decos: row.heroDecos,
    ctaPrimaryLabel: row.ctaPrimaryLabel,
    // Link primer dibentuk ulang oleh renderer dari nomor & pesan WhatsApp,
    // jadi file export tidak perlu menyimpan href-nya.
    ctaPrimaryHref: "",
    ctaSecondaryLabel: row.ctaSecondaryLabel,
    ctaSecondaryHref: anchorHref(row.ctaSecondaryAnchor),
  };
  if (row.heroImage) {
    hero.image = row.heroImage;
    hero.imageAlt = row.heroImageAlt ?? null;
  }
  if (row.heroWaLink) hero.primaryLink = row.heroWaLink;
  return hero;
}

type CtaRow = {
  ctaTitle: string;
  ctaText: string;
  ctaLabel: string;
  ctaMessage: string;
  ctaWaLink: string;
  ctaBackground: string | null;
};

function buildCta(row: CtaRow, waNumber: string): CtaBanner | null {
  if (
    !row.ctaTitle &&
    !row.ctaText &&
    !row.ctaLabel &&
    !row.ctaMessage &&
    !row.ctaWaLink &&
    !row.ctaBackground
  ) {
    return null;
  }
  const banner: CtaBanner = {
    title: row.ctaTitle,
    text: row.ctaText,
    label: row.ctaLabel,
    href: waHref(row.ctaMessage, waNumber),
  };
  // Kunci `background` hanya ditulis kalau admin memang mengisi gambar, supaya
  // file konten yang belum pernah disetel tidak ikut berubah.
  if (row.ctaBackground) banner.background = row.ctaBackground;
  // Kunci `link` (link rotator) juga hanya ditulis kalau terisi.
  if (row.ctaWaLink) banner.link = row.ctaWaLink;
  return banner;
}

function buildPricing(
  pricing: {
    kind: string;
    note: string | null;
    rowHeaderLabel: string | null;
    columns: { id: string; label: string; cssClass: string | null; order: number }[];
    rows: {
      id: string;
      label: string;
      order: number;
      values: { columnId: string; value: string }[];
    }[];
    items: { label: string; value: string; unit: string | null; order: number }[];
  } | null,
  meta: { tag: string; title: string; accent: string; suffix: string; description: string; anchor: string; gridColumns: number },
): Sections["pricing"] {
  if (!pricing) return null;
  const common = {
    tag: meta.tag,
    title: meta.title,
    accent: meta.accent,
    suffix: meta.suffix,
    description: meta.description,
    anchor: meta.anchor,
    gridColumns: meta.gridColumns,
    note: pricing.note ?? "",
    firstHeader: pricing.rowHeaderLabel ?? "",
  };

  if (pricing.kind === "TABLE") {
    const block: NonNullable<Sections["pricing"]> = {
      ...common,
      kind: "TABLE",
      columns: pricing.columns.map((c) => ({ label: c.label, cssClass: c.cssClass })),
      rows: pricing.rows.map((row) => ({
        label: row.label,
        cells: pricing.columns.map((col) => {
          const value = row.values.find((v) => v.columnId === col.id);
          // CSS kolom sudah disimpan di PriceColumn; CSS sel legacy tidak punya
          // padanan kolomnya sendiri.
          return { value: value?.value ?? "", cssClass: null };
        }),
      })),
    };
    return block;
  }

  const block: NonNullable<Sections["pricing"]> = {
    ...common,
    kind: "ITEMS",
    columns: [],
    rows: [],
    items: pricing.items.map((it) => ({
      label: it.label,
      value: it.value,
      unit: it.unit ?? "",
    })),
  };
  return block;
}

/**
 * Bangun isi content.json lengkap dari database, mempertahankan metadata yang
 * tidak punya kolom database dari file yang sudah ada.
 */
export async function buildContentFile(): Promise<ContentFile> {
  const existing = readExisting();
  const existingCategories = new Map(
    (existing?.categories ?? []).map((c) => [c.slug, c]),
  );
  const existingPackages = new Map(
    (existing?.packages ?? []).map((p) => [p.slug, p]),
  );

  const [
    settingsRow,
    homeStats,
    testimonials,
    homeBenefits,
    homeGallery,
    categories,
    packages,
    htmlPages,
  ] = await Promise.all([
      prisma.siteSettings.findUnique({ where: { id: "singleton" } }),
      prisma.homeStat.findMany({ orderBy: { order: "asc" } }),
      prisma.testimonial.findMany({ orderBy: { order: "asc" } }),
      prisma.benefit.findMany({
        where: { isHomepage: true },
        orderBy: { order: "asc" },
      }),
      prisma.homeGalleryImage.findMany({ orderBy: { order: "asc" } }),
      prisma.category.findMany({
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        include: { benefits: { orderBy: { order: "asc" } } },
      }),
      prisma.package.findMany({
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        include: {
          category: { select: { slug: true } },
          cardFacilities: { orderBy: { order: "asc" } },
          cardDays: { orderBy: { order: "asc" } },
          cardPrices: { orderBy: { order: "asc" } },
          schedule: { orderBy: { order: "asc" } },
          itinerary: {
            orderBy: { order: "asc" },
            include: { items: { orderBy: { order: "asc" } } },
          },
          facilities: {
            orderBy: { order: "asc" },
            include: { items: { orderBy: { order: "asc" } } },
          },
          pricing: {
            include: {
              columns: { orderBy: { order: "asc" } },
              rows: {
                orderBy: { order: "asc" },
                include: { values: true },
              },
              items: { orderBy: { order: "asc" } },
            },
          },
          gallery: { orderBy: { order: "asc" } },
          notes: { orderBy: { order: "asc" } },
        },
      }),
      prisma.htmlPage.findMany({
        orderBy: [{ order: "asc" }, { title: "asc" }],
      }),
    ]);

  if (!settingsRow) {
    throw new Error(
      "SiteSettings belum di-seed. Jalankan `pnpm db:seed` dulu sebelum export.",
    );
  }

  const waNumber = settingsRow.waNumber;

  const settings: SiteSettingsOut = {
    siteName: settingsRow.siteName,
    siteUrl: settingsRow.siteUrl,
    logoVariant: settingsRow.logoVariant,
    waNumber: settingsRow.waNumber,
    ...(settingsRow.waMessage ? { waMessage: settingsRow.waMessage } : {}),
    ...(settingsRow.waGreeting ? { waGreeting: settingsRow.waGreeting } : {}),
    ...(settingsRow.stickyWaLabel && settingsRow.stickyWaLabel !== "Chat Sekarang"
      ? { stickyWaLabel: settingsRow.stickyWaLabel }
      : {}),
    ...(settingsRow.stickyWaLink ? { stickyWaLink: settingsRow.stickyWaLink } : {}),
    email: settingsRow.email,
    instagram: settingsRow.instagram,
    tiktok: settingsRow.tiktok,
    footerText: settingsRow.footerText,
    footerHeading: settingsRow.footerHeading,
    copyrightText: settingsRow.copyrightText,
    footerMadeWith: settingsRow.footerMadeWith,
    footerLocation: settingsRow.footerLocation,
    footerHeart: settingsRow.footerHeart,
    homeHeroBadges: settingsRow.homeHeroBadges,
    homeHeroTitle: settingsRow.homeHeroTitle,
    homeHeroAccent: settingsRow.homeHeroAccent,
    homeHeroSuffix: settingsRow.homeHeroSuffix,
    homeHeroText: settingsRow.homeHeroText,
    homeHeroDecos: settingsRow.homeHeroDecos,
    homeHeroPrimaryLabel: settingsRow.homeHeroPrimaryLabel,
    ...(settingsRow.    homeHeroWaLink ? { homeHeroWaLink: settingsRow.homeHeroWaLink } : {}),
    ...(settingsRow.homeHeroImage ? { homeHeroImage: settingsRow.homeHeroImage } : {}),
    ...(settingsRow.homeHeroImageAlt ? { homeHeroImageAlt: settingsRow.homeHeroImageAlt } : {}),
    homeHeroSecondaryLabel: settingsRow.homeHeroSecondaryLabel,
    homeHeroSecondaryAnchor: settingsRow.homeHeroSecondaryAnchor,
    homeTypesTag: settingsRow.homeTypesTag,
    homeTypesTitle: settingsRow.homeTypesTitle,
    homeTypesAccent: settingsRow.homeTypesAccent,
    homeTypesSuffix: settingsRow.homeTypesSuffix,
    homeTypesDesc: settingsRow.homeTypesDesc,
    homeTypesAnchor: settingsRow.homeTypesAnchor,
    homeTypesEnabled: settingsRow.homeTypesEnabled,
    homeGridColumns: settingsRow.homeGridColumns,
    homeFavTag: settingsRow.homeFavTag,
    homeFavTitle: settingsRow.homeFavTitle,
    homeFavAccent: settingsRow.homeFavAccent,
    homeFavSuffix: settingsRow.homeFavSuffix,
    homeFavDesc: settingsRow.homeFavDesc,
    homeFavEnabled: settingsRow.homeFavEnabled,
    homePgTag: settingsRow.homePgTag,
    homePgTitle: settingsRow.homePgTitle,
    homePgAccent: settingsRow.homePgAccent,
    homePgSuffix: settingsRow.homePgSuffix,
    homePgDesc: settingsRow.homePgDesc,
    homePgAnchor: settingsRow.homePgAnchor,
    homePgEnabled: settingsRow.homePgEnabled,
    homeBenefitsTag: settingsRow.homeBenefitsTag,
    homeBenefitsTitle: settingsRow.homeBenefitsTitle,
    homeBenefitsAccent: settingsRow.homeBenefitsAccent,
    homeBenefitsSuffix: settingsRow.homeBenefitsSuffix,
    homeBenefitsDesc: settingsRow.homeBenefitsDesc,
    homeBenefitsEnabled: settingsRow.homeBenefitsEnabled,
    homeTestiTag: settingsRow.homeTestiTag,
    homeTestiTitle: settingsRow.homeTestiTitle,
    homeTestiAccent: settingsRow.homeTestiAccent,
    homeTestiSuffix: settingsRow.homeTestiSuffix,
    homeTestiDesc: settingsRow.homeTestiDesc,
    homeTestiEnabled: settingsRow.homeTestiEnabled,
    homeIgTag: settingsRow.homeIgTag,
    homeIgTitle: settingsRow.homeIgTitle,
    homeIgAccent: settingsRow.homeIgAccent,
    homeIgSuffix: settingsRow.homeIgSuffix,
    homeIgDesc: settingsRow.homeIgDesc,
    homeIgEnabled: settingsRow.homeIgEnabled,
    homeGalleryTag: settingsRow.homeGalleryTag,
    homeGalleryTitle: settingsRow.homeGalleryTitle,
    homeGalleryAccent: settingsRow.homeGalleryAccent,
    homeGallerySuffix: settingsRow.homeGallerySuffix,
    homeGalleryDesc: settingsRow.homeGalleryDesc,
    homeGalleryAnchor: settingsRow.homeGalleryAnchor,
    homeGalleryColumns: settingsRow.homeGalleryColumns,
    homeGalleryEnabled: settingsRow.homeGalleryEnabled,
    ctaTitle: settingsRow.ctaTitle,
    ctaText: settingsRow.ctaText,
    ctaLabel: settingsRow.ctaLabel,
    ctaMessage: settingsRow.ctaMessage,
    ...(settingsRow.ctaWaNumber ? { ctaWaNumber: settingsRow.ctaWaNumber } : {}),
    ...(settingsRow.ctaWaGreeting ? { ctaWaGreeting: settingsRow.ctaWaGreeting } : {}),
    ...(settingsRow.ctaWaLink ? { ctaWaLink: settingsRow.ctaWaLink } : {}),
    ...(settingsRow.ctaBackground ? { ctaBackground: settingsRow.ctaBackground } : {}),
  };

  const categoriesOut: CategoryOut[] = categories.map((row) => {
    const prev = existingCategories.get(row.slug);
    const hero = buildHero(row);
    const cta = buildCta(row, waNumber);

    const listing = {
      tag: row.listingTag,
      title: row.listingTitle,
      accent: row.listingAccent,
      suffix: row.listingSuffix,
      description: row.listingDescription,
      anchor: row.listingAnchor,
      gridColumns: row.gridColumns,
      // Tidak ada kolomnya di database; hanya metadata legacy.
      cardVariant: (prev?.listing?.cardVariant ?? "default") as
        | "opentrip"
        | "default",
    };

    const benefits: CategoryOut["benefits"] = row.benefits.length
      ? {
          tag: row.benefitsTag,
          title: row.benefitsTitle,
          accent: row.benefitsAccent,
          suffix: row.benefitsSuffix,
          description: row.benefitsDescription,
          anchor: prev?.benefits?.anchor ?? "keunggulan",
          items: row.benefits.map(
            (b): Benefit => ({
              icon: b.icon,
              title: b.title,
              description: b.description,
            }),
          ),
        }
      : null;

    const pagesHead: CategoryOut["pages"] =
      row.pgTag || row.pgTitle || row.pgAccent || row.pgSuffix || row.pgDesc
        ? {
            tag: row.pgTag,
            title: row.pgTitle,
            accent: row.pgAccent,
            suffix: row.pgSuffix,
            description: row.pgDesc,
            anchor: row.pgAnchor || "halaman",
          }
        : null;

    const whatsapp =
      row.waNumber || row.waGreeting || row.waMessage || row.ctaWaNumber || row.ctaWaGreeting
        ? {
            number: row.waNumber,
            greeting: row.waGreeting,
            message: row.waMessage,
            ...(row.ctaWaNumber ? { ctaNumber: row.ctaWaNumber } : {}),
            ...(row.ctaWaGreeting ? { ctaGreeting: row.ctaWaGreeting } : {}),
          }
        : null;

    const out: CategoryOut = {
      key: (prev?.key ?? "openTrip") as CategoryKey,
      slug: row.slug,
      sourceFile: prev?.sourceFile ?? "",
      navLabel: row.navLabel,
      order: row.order,
      kind: row.kind,
      duration: row.duration,
      isPublished: row.isPublished,
      showInNav: row.showInNav,
      cardIcon: row.cardIcon,
      cardDescription: row.cardDescription,
      cardPrice: row.cardPrice,
      cardLinkLabel: row.cardLinkLabel,
      hero,
      cta,
      listing,
      note:
        row.listingNoteText || row.listingNoteIcon
          ? { icon: row.listingNoteIcon ?? "", text: row.listingNoteText ?? "" }
          : null,
      benefits,
      ...(pagesHead ? { pages: pagesHead } : {}),
      ...(whatsapp ? { whatsapp } : {}),
    };
    if (row.cardImage) {
      out.cardImage = row.cardImage;
      out.cardImageAlt = row.cardImageAlt ?? null;
    }
    return out;
  });

  const packagesOut: PackageOut[] = packages.map((row) => {
    const prev = existingPackages.get(row.slug);

    const pills = row.cardFacilities.map((p) => p.label);
    const days = row.cardDays.map((d) => ({ label: d.label, title: d.title }));
    const prices = row.cardPrices.map((p) => ({
      label: p.label,
      value: p.value,
      unit: p.unit ?? "",
    }));
    const hasCardContent = Boolean(
      row.cardImage ||
        row.cardLoc ||
        row.cardHomeLoc ||
        row.cardTag ||
        row.cardRating ||
        row.cardHighlight ||
        row.cardPriceLabel ||
        row.cardPriceValue ||
        row.cardPriceUnit ||
        row.cardButtonLabel ||
        row.cardWaLink ||
        pills.length ||
        days.length ||
        prices.length,
    );

    const facilities: Sections["facilities"] = {
      tag: row.facilityTag,
      title: row.facilityTitle,
      accent: row.facilityAccent,
      suffix: row.facilitySuffix,
      description: row.facilityDescription,
      anchor: prev?.facilities?.anchor ?? "fasilitas",
      gridColumns: prev?.facilities?.gridColumns ?? 3,
      groups: row.facilities.map((g) => ({
        variant: g.variant as "INCLUDE" | "EXCLUDE",
        title: g.title,
        items: g.items.map((it) => ({ icon: it.icon, text: it.text })),
      })),
    };

    const pricing = buildPricing(row.pricing, {
      tag: row.pricingTag,
      title: row.pricingTitle,
      accent: row.pricingAccent,
      suffix: row.pricingSuffix,
      description: row.pricingDescription,
      anchor: prev?.pricing?.anchor ?? "harga",
      gridColumns: prev?.pricing?.gridColumns ?? 3,
    });

    const gallery: Sections["gallery"] = {
      tag: row.galleryTag,
      title: row.galleryTitle,
      accent: row.galleryAccent,
      suffix: row.gallerySuffix,
      description: row.galleryDescription,
      anchor: prev?.gallery?.anchor ?? "galeri",
      gridColumns: row.galleryColumns,
      images: row.gallery.map((g) => ({ url: g.url, alt: g.alt })),
    };

    const out: PackageOut = {
      slug: row.slug,
      categorySlug: row.category.slug,
      sourceFile: prev?.sourceFile ?? "",
      kind: row.kind,
      name: row.name,
      cardVariant: row.cardVariant === "opentrip" ? "opentrip" : "default",
      card: hasCardContent
        ? {
            name: row.name,
            image: row.cardImage,
            imageAlt: row.cardImageAlt ?? "",
            loc: row.cardLoc ?? "",
            homeLoc: row.cardHomeLoc ?? "",
            tag: row.cardTag ?? "",
            rating: row.cardRating ?? "",
            highlight: row.cardHighlight ?? "",
            facilityPills: pills,
            days,
            priceLabel: row.cardPriceLabel ?? "",
            priceValue: row.cardPriceValue ?? "",
            priceUnit: row.cardPriceUnit ?? "",
            prices,
            buttonLabel: row.cardButtonLabel ?? "",
            ...(row.cardWaLink ? { waLink: row.cardWaLink } : {}),
            slug: null,
            waMessage: null,
            isWhatsappLink: row.cardLinkMode === "whatsapp",
            isPromoted: false,
          }
        : null,
      hasDetailPage: row.hasDetailPage,
      isFeatured: row.isFeatured,
      showOnHome: row.showOnHome,
      order: row.order,
      isPublished: row.isPublished,
      galleryHasMore: row.galleryHasMore,
      galleryMoreLabel: row.galleryMoreLabel,
      hero: buildHero(row),
      cta: buildCta(row, waNumber),
      note: row.notes[0]
        ? { icon: row.notes[0].icon, text: row.notes[0].text }
        : null,
      schedule:
        row.schedule.length > 0
          ? {
              tag: row.jadwalTag,
              title: row.jadwalTitle,
              accent: row.jadwalAccent,
              suffix: row.jadwalSuffix,
              description: row.jadwalDescription,
              anchor: row.jadwalAnchor,
              items: row.schedule.map((s) => ({
                day: s.day,
                month: s.month,
                year: s.year,
                description: s.description,
              })),
            }
          : null,
      itinerary: {
        tag: row.itineraryTag,
        title: row.itineraryTitle,
        accent: row.itineraryAccent,
        suffix: row.itinerarySuffix,
        description: row.itineraryDescription,
        anchor: row.itineraryAnchor,
        gridColumns: row.itineraryColumns,
        days: row.itinerary.map((d) => ({
          emoji: d.emoji,
          label: d.label,
          title: d.title,
          items: d.items.map((it) => ({ time: it.time, text: it.text })),
        })),
      },
      facilities,
      pricing,
      gallery,
      waMessage: row.waMessage,
      ...(row.waNumber || row.waGreeting || row.ctaWaNumber || row.ctaWaGreeting
        ? {
            whatsapp: {
              number: row.waNumber,
              greeting: row.waGreeting,
              ...(row.ctaWaNumber ? { ctaNumber: row.ctaWaNumber } : {}),
              ...(row.ctaWaGreeting ? { ctaGreeting: row.ctaWaGreeting } : {}),
            },
          }
        : {}),
    };
    return out;
  });

  const pagesOut: HtmlPageOut[] = htmlPages.map((row) => ({
    slug: row.slug,
    title: row.title,
    html: row.html,
    scope: row.scope === "sosmed" ? "sosmed" : "page",
    ...(row.bio ? { bio: row.bio as unknown as HtmlPageOut["bio"] } : {}),
    showOnHome: row.showOnHome,
    categorySlugs: row.categorySlugs,
    cardImage: row.cardImage,
    cardTag: row.cardTag,
    cardTitle: row.cardTitle,
    cardDesc: row.cardDesc,
    cardButtonLabel: row.cardButtonLabel,
    isPublished: row.isPublished,
    order: row.order,
  }));

  return {
    settings,
    homeStats: homeStats.map((s) => ({ num: s.num, label: s.label })),
    homeBenefits: homeBenefits.map((b) => ({
      icon: b.icon,
      title: b.title,
      description: b.description,
    })),
    testimonials: testimonials.map((t) => ({
      stars: t.stars,
      quote: t.quote,
      author: t.author,
      location: t.location,
    })),
    homeGallery: homeGallery.map((g) => ({ url: g.url, alt: g.alt })),
    categories: categoriesOut,
    packages: packagesOut,
    pages: pagesOut,
    warnings: existing?.warnings ?? [],
  };
}

/** Bangun lalu tulis content.json. Mengembalikan ringkasan jumlah entitas. */
export async function syncContentFile(): Promise<{
  categories: number;
  packages: number;
  pages: number;
}> {
  const content = await buildContentFile();
  mkdirSync(dirname(CONTENT_FILE), { recursive: true });
  writeFileSync(CONTENT_FILE, `${JSON.stringify(content, null, 2)}\n`, "utf8");
  return {
    categories: content.categories.length,
    packages: content.packages.length,
    pages: content.pages?.length ?? 0,
  };
}

/**
 * Sinkronkan content.json tanpa membuat aksi simpan ikut gagal.
 *
 * Dipanggil dari server action setelah data tersimpan (dan sebelum redirect).
 * Kalau penulisan file bermasalah, perubahan database tetap sah dan admin tetap
 * bisa lanjut — kegagalannya cukup dicatat di log server.
 */
export async function trySyncContentFile(): Promise<void> {
  // Di lingkungan serverless filesystem bersifat read-only dan hilang tiap
  // deploy, jadi penulisan content.json tidak ada gunanya (dan bikin log
  // penuh). Lewati saja; sumber kebenaran tetap database.
  if (process.env.CONTENT_SYNC === "off" || process.env.VERCEL) return;
  try {
    await syncContentFile();
  } catch (error) {
    console.error(
      "[content-export] gagal menyinkronkan content.json:",
      error,
    );
  }
}