/**
 * Akses data untuk halaman publik.
 *
 * Semua halaman publik hanya perlu membaca; penulisan nanti dilakukan dari
 * panel admin. Query di sini memakai `select` supaya tidak menarik kolom yang
 * tidak dipakai dan tidak meledakkan ukuran payload.
 */
import "server-only";
import { prisma } from "./db";
import { getInstagramFeed, IG_BATCH } from "./instagram-feed";
import { syncDetailLinks } from "./admin/package-detail-links";

/* ------------------------------------------------------------------ */
/* Select                                                              */
/* ------------------------------------------------------------------ */

const navSelect = {
  slug: true,
  navLabel: true,
  order: true,
} as const;

const cardSelect = {
  slug: true,
  name: true,
  isFeatured: true,
  hasDetailPage: true,
  /** Dibaca aturan tombol kartu; lihat `applyCardLinks()` di bawah. */
  kind: true,
  cardVariant: true,
  cardLinkMode: true,
  cardImage: true,
  cardImageAlt: true,
  cardLoc: true,
  cardHomeLoc: true,
  cardTag: true,
  cardRating: true,
  cardHighlight: true,
  cardPriceLabel: true,
  cardPriceValue: true,
  cardPriceUnit: true,
  cardButtonLabel: true,
  cardWaLink: true,
  waMessage: true,
  cardDays: { select: { label: true, title: true, order: true }, orderBy: { order: "asc" } },
  cardPrices: { select: { label: true, value: true, unit: true, order: true }, orderBy: { order: "asc" } },
  cardFacilities: { select: { label: true, order: true }, orderBy: { order: "asc" } },
} as const;

const categoryCardSelect = {
  slug: true,
  navLabel: true,
  cardIcon: true,
  cardDescription: true,
  cardPrice: true,
  cardLinkLabel: true,
  // Opsional: NULL untuk kategori bawaan impor. Ditambahkan ke select supaya
  // renderer bisa menampilkannya hanya saat admin mengisinya.
  cardImage: true,
  cardImageAlt: true,
} as const;

const pageCardSelect = {
  slug: true,
  title: true,
  cardTag: true,
  cardTitle: true,
  cardDesc: true,
  cardButtonLabel: true,
  cardImage: true,
} as const;

const heroSelect = {
  heroBadges: true,
  heroTitle: true,
  heroAccent: true,
  heroSuffix: true,
  heroDescription: true,
  heroDecos: true,
  ctaPrimaryLabel: true,
  ctaSecondaryLabel: true,
  ctaSecondaryAnchor: true,
  heroWaLink: true,
  ctaTitle: true,
  ctaText: true,
  ctaLabel: true,
  ctaMessage: true,
  ctaWaNumber: true,
  ctaWaGreeting: true,
  ctaWaLink: true,
} as const;

const benefitSelect = {
  id: true,
  icon: true,
  title: true,
  description: true,
  order: true,
} as const;

const settingsSelect = {
  siteName: true,
  siteUrl: true,
  logoVariant: true,
  waNumber: true,
  waMessage: true,
  waGreeting: true,
  stickyWaLabel: true,
  stickyWaLink: true,
  email: true,
  instagram: true,
  tiktok: true,
  footerText: true,
  footerHeading: true,
  copyrightText: true,
  footerMadeWith: true,
  footerLocation: true,
  footerHeart: true,
  homeHeroBadges: true,
  homeHeroTitle: true,
  homeHeroAccent: true,
  homeHeroSuffix: true,
  homeHeroText: true,
  homeHeroDecos: true,
  homeHeroImage: true,
  homeHeroImageAlt: true,
  homeHeroPrimaryLabel: true,
  homeHeroWaLink: true,
  homeHeroSecondaryLabel: true,
  homeHeroSecondaryAnchor: true,
  homeTypesTag: true,
  homeTypesTitle: true,
  homeTypesAccent: true,
  homeTypesSuffix: true,
  homeTypesDesc: true,
  homeTypesAnchor: true,
  homeTypesEnabled: true,
  homePgTag: true,
  homePgTitle: true,
  homePgAccent: true,
  homePgSuffix: true,
  homePgDesc: true,
  homePgAnchor: true,
  homePgEnabled: true,
  homeGridColumns: true,
  homeFavTag: true,
  homeFavTitle: true,
  homeFavAccent: true,
  homeFavSuffix: true,
  homeFavDesc: true,
  homeFavEnabled: true,
  homeBenefitsTag: true,
  homeBenefitsTitle: true,
  homeBenefitsAccent: true,
  homeBenefitsSuffix: true,
  homeBenefitsDesc: true,
  homeBenefitsEnabled: true,
  homeTestiTag: true,
  homeTestiTitle: true,
  homeTestiAccent: true,
  homeTestiSuffix: true,
  homeTestiDesc: true,
  homeTestiEnabled: true,
  homeIgTag: true,
  homeIgTitle: true,
  homeIgAccent: true,
  homeIgSuffix: true,
  homeIgDesc: true,
  homeIgEnabled: true,
  homeGalleryTag: true,
  homeGalleryTitle: true,
  homeGalleryAccent: true,
  homeGallerySuffix: true,
  homeGalleryDesc: true,
  homeGalleryAnchor: true,
  homeGalleryColumns: true,
  homeGalleryEnabled: true,
  ctaTitle: true,
  ctaText: true,
  ctaLabel: true,
  ctaMessage: true,
  ctaWaNumber: true,
  ctaWaGreeting: true,
  ctaWaLink: true,
  ctaBackground: true,
} as const;

/* ------------------------------------------------------------------ */
/* Query                                                               */
/* ------------------------------------------------------------------ */

export type NavItem = { slug: string; label: string };

/**
 * Samakan tombol kartu dengan aturan halaman detail.
 *
 * `savePackageAction` sudah menjalankan aturan yang sama saat menyimpan, tapi
 * paket Open Trip yang halamannya diaktifkan sebelum aturan ini ada masih
 * menyimpan label WhatsApp di database. Tanpa menerapkan di sini, menyunting satu
 * file tidak memperbaiki apa yang sudah tersimpan — dan user harus membuka
 * setiap paket lalu menekan Simpan hanya untuk memperbarui label.
 */
function applyCardLinks<T extends {
  kind: string;
  hasDetailPage: boolean;
  cardLinkMode: string | null;
  cardButtonLabel: string | null;
}>(row: T): T {
  const links = syncDetailLinks({
    kind: row.kind,
    hasDetailPage: row.hasDetailPage,
    cardLinkMode: row.cardLinkMode ?? "",
    cardButtonLabel: row.cardButtonLabel ?? "",
    // Kartu tidak pernah memakai tombol hero, tapi aturan ini adalah satu
    // sumber, jadi nilainya ikut diteruskan agar tidak melenceng.
    ctaPrimaryLabel: "",
  });

  return { ...row, cardLinkMode: links.cardLinkMode, cardButtonLabel: links.cardButtonLabel };
}

export async function getSettings() {
  return prisma.siteSettings.findUnique({
    where: { id: "singleton" },
    select: settingsSelect,
  });
}

/** Item menu utama, sesuai urutan di halaman aslinya. */
export async function getNavItems(): Promise<NavItem[]> {
  const rows = await prisma.category.findMany({
    where: { showInNav: true, isPublished: true },
    select: navSelect,
    orderBy: { order: "asc" },
  });
  return rows.map((c) => ({ slug: c.slug, label: c.navLabel }));
}

export async function getCategorySlugs(): Promise<string[]> {
  const rows = await prisma.category.findMany({
    where: { isPublished: true },
    select: { slug: true },
    orderBy: { order: "asc" },
  });
  return rows.map((c) => c.slug);
}

/**
 * Kartu halaman HTML mandiri untuk satu penempatan.
 *
 * `home`     → kartu yang ditandai "tampilkan di beranda".
 * `category` → kartu yang memilih `categorySlug` di daftar kategorinya
 *              (satu kartu bisa tampil di beberapa kategori).
 */
export async function getPageCards(place: "home" | "category", categorySlug = "") {
  return prisma.htmlPage.findMany({
    where: {
      isPublished: true,
      scope: "page",
      ...(place === "home"
        ? { showOnHome: true }
        : { categorySlugs: { has: categorySlug } }),
    },
    select: pageCardSelect,
    orderBy: [{ order: "asc" }, { title: "asc" }],
  });
}

/** Paket yang punya halaman detail, untuk generateStaticParams. */
export async function getPackageSlugs(): Promise<string[]> {
  const rows = await prisma.package.findMany({
    where: { isPublished: true, hasDetailPage: true },
    select: { slug: true },
  });
  return rows.map((p) => p.slug);
}

/** Semua slug yang boleh ditangani rute /[slug]. */
export async function getPublicSlugs(): Promise<string[]> {
  const [cats, pkgs] = await Promise.all([getCategorySlugs(), getPackageSlugs()]);
  return [...cats, ...pkgs];
}

export async function getHomePage() {
  const [settings, stats, benefits, testimonials, favorites, types, igFeed, pages, gallery] =
    await Promise.all([
      getSettings(),
      prisma.homeStat.findMany({
        select: { num: true, label: true, order: true },
        orderBy: { order: "asc" },
      }),
      prisma.benefit.findMany({
        where: { isHomepage: true },
        select: benefitSelect,
        orderBy: { order: "asc" },
      }),
      prisma.testimonial.findMany({
        select: { stars: true, quote: true, author: true, location: true, order: true },
        orderBy: { order: "asc" },
      }),
      prisma.package.findMany({
        where: { isPublished: true, showOnHome: true },
        select: cardSelect,
        orderBy: [{ order: "asc" }, { name: "asc" }],
      }),
      prisma.category.findMany({
        where: { isPublished: true },
        select: categoryCardSelect,
        orderBy: { order: "asc" },
      }),
      // Batch pertama feed Instagram (di bawah testimoni). Sinkronisasi ke
      // Graph API berjalan di dalamnya dengan TTL, jadi halaman tetap cepat.
      getInstagramFeed(0, IG_BATCH),
      // Kartu halaman HTML mandiri yang dipilih admin tampil di beranda.
      getPageCards("home"),
      // Foto seksi "Galeri Pengunjung" yang dikelola dari editor Beranda.
      prisma.homeGalleryImage.findMany({
        select: { id: true, url: true, alt: true },
        orderBy: { order: "asc" },
      }),
    ]);

  if (!settings) throw new Error("SiteSettings belum diisi. Jalankan `pnpm db:seed`.");

  return {
    settings,
    stats,
    benefits,
    testimonials,
    types,
    favorites: favorites.map(applyCardLinks),
    igPosts: igFeed.posts,
    igHasMore: igFeed.total > igFeed.posts.length,
    pages,
    gallery,
  };
}

export async function getCategoryPage(slug: string) {
  const [category, pages] = await Promise.all([
    prisma.category.findFirst({
      where: { slug, isPublished: true },
      select: {
        ...heroSelect,
        slug: true,
        name: true,
        navLabel: true,
        kind: true,
        gridColumns: true,
        heroImage: true,
        heroImageAlt: true,
        listingTag: true,
        listingTitle: true,
        listingAccent: true,
        listingSuffix: true,
        listingDescription: true,
        listingAnchor: true,
        listingNoteIcon: true,
        listingNoteText: true,
        ctaBackground: true,
        waNumber: true,
        waGreeting: true,
        waMessage: true,
        pgAnchor: true,
        pgTag: true,
        pgTitle: true,
        pgAccent: true,
        pgSuffix: true,
        pgDesc: true,
        benefitsTag: true,
        benefitsTitle: true,
        benefitsAccent: true,
        benefitsSuffix: true,
        benefitsDescription: true,
        benefits: { select: benefitSelect, orderBy: { order: "asc" } },
        packages: {
          where: { isPublished: true },
          select: cardSelect,
          orderBy: [{ order: "asc" }, { name: "asc" }],
        },
      },
    }),
    // Kartu halaman HTML mandiri yang memilih kategori ini.
    getPageCards("category", slug),
  ]);

  if (!category) return null;

  return {
    ...category,
    packages: category.packages.map(applyCardLinks),
    pages,
  };
}

/** `getCategoryPage()` + tombol kartu yang sudah disamakan aturannya. */
export async function getCategoryPageWithCards(slug: string) {
  const page = await getCategoryPage(slug);
  if (!page) return null;
  return { ...page, packages: page.packages.map(applyCardLinks) };
}

export async function getPackagePage(slug: string) {
  const pkg = await prisma.package.findFirst({
    where: { slug, isPublished: true, hasDetailPage: true },
    select: {
      ...heroSelect,
      slug: true,
      name: true,
      kind: true,
      waMessage: true,
      waNumber: true,
      waGreeting: true,
      cardImage: true,
      heroImage: true,
      heroImageAlt: true,
      itineraryTag: true,
      itineraryTitle: true,
      itineraryAccent: true,
      itinerarySuffix: true,
      itineraryDescription: true,
      itineraryAnchor: true,
      itineraryColumns: true,
      facilityTag: true,
      facilityTitle: true,
      facilityAccent: true,
      facilitySuffix: true,
      facilityDescription: true,
      pricingTag: true,
      pricingTitle: true,
      pricingAccent: true,
      pricingSuffix: true,
      pricingDescription: true,
      galleryTag: true,
      galleryTitle: true,
      galleryAccent: true,
      gallerySuffix: true,
      galleryDescription: true,
      galleryColumns: true,
      ctaBackground: true,
      jadwalTag: true,
      jadwalTitle: true,
      jadwalAccent: true,
      jadwalSuffix: true,
      jadwalDescription: true,
      jadwalAnchor: true,
      schedule: {
        select: { id: true, day: true, month: true, year: true, description: true, order: true },
        orderBy: { order: "asc" },
      },
      category: { select: { slug: true, navLabel: true } },
      notes: {
        select: { id: true, icon: true, text: true, order: true },
        orderBy: { order: "asc" },
      },
      itinerary: {
        select: {
          id: true,
          emoji: true,
          label: true,
          title: true,
          order: true,
          items: {
            select: { time: true, text: true, order: true },
            orderBy: { order: "asc" },
          },
        },
        orderBy: { order: "asc" },
      },
      facilities: {
        select: {
          id: true,
          variant: true,
          title: true,
          order: true,
          items: {
            select: { icon: true, text: true, order: true },
            orderBy: { order: "asc" },
          },
        },
        orderBy: { order: "asc" },
      },
      pricing: {
        select: {
          kind: true,
          note: true,
          rowHeaderLabel: true,
          columns: {
            select: { id: true, label: true, cssClass: true, order: true },
            orderBy: { order: "asc" },
          },
          rows: {
            select: {
              id: true,
              label: true,
              order: true,
              values: { select: { columnId: true, value: true } },
            },
            orderBy: { order: "asc" },
          },
          items: {
            select: { label: true, value: true, unit: true, order: true },
            orderBy: { order: "asc" },
          },
        },
      },
      gallery: {
        select: { id: true, url: true, alt: true, order: true },
        orderBy: { order: "asc" },
      },
    },
  });

  if (!pkg) return null;

  // Halaman detail hanya bisa muncul kalau `hasDetailPage` aktif, jadi di
  // sinilah tombol WhatsApp harus muncul untuk Open Trip yang baru saja
  // mendapatkan halamannya. Tanpa ini, paket yang disimpan sebelum aturan ini
  // ada akan tampil dengan hero tanpa tombol booking sama sekali.
  const links = syncDetailLinks({
    kind: pkg.kind,
    hasDetailPage: true,
    cardLinkMode: "",
    cardButtonLabel: "",
    ctaPrimaryLabel: pkg.ctaPrimaryLabel,
  });

  return { ...pkg, ctaPrimaryLabel: links.ctaPrimaryLabel };
}

export type InactivePackage = {
  slug: string;
  name: string;
  isPublished: boolean;
  hasDetailPage: boolean;
};

/**
 * Paket yang slug-nya ada tapi belum punya halaman publik.
 *
 * Dipakai rute `/[slug]` untuk membedakan dua macam 404: slug yang memang tidak
 * pernah ada, dan paket yang sudah dibuat di panel tapi belum (atau tidak lagi)
 * diterbitkan. Yang kedua boleh diberi keterangan + tombol kembali ke panel,
 * bukan not-found polos.
 */
export async function getInactivePackage(slug: string): Promise<InactivePackage | null> {
  return prisma.package.findFirst({
    where: {
      slug,
      OR: [{ isPublished: false }, { hasDetailPage: false }],
    },
    select: { slug: true, name: true, isPublished: true, hasDetailPage: true },
  });
}

/** Paket lain di kategori yang sama, untuk tombol navigasi bawah halaman detail. */
export async function getRelatedPackages(categorySlug: string, excludeSlug: string) {
  return prisma.package.findMany({
    where: {
      category: { slug: categorySlug },
      slug: { not: excludeSlug },
      isPublished: true,
      hasDetailPage: true,
    },
    select: { slug: true, name: true, cardPriceValue: true },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    take: 6,
  });
}
