import "server-only";

import type { CategoryBodyData, HomeBodyProps, ShellData } from "@/components/site/views";
import type { PageCardData } from "@/components/site/page-cards";

import { emptyBio, normalizeBio, type BioLinkPageData } from "@/lib/bio";
import { prisma } from "@/lib/db";
import { getPageCards } from "@/lib/site";
import { getInstagramFeed, IG_BATCH } from "@/lib/instagram-feed";

import type { Option } from "./fields";
import type { PackagePreviewData } from "./package-detail-links";

/**
 * Data awal untuk live preview panel admin.
 *
 * Berbeda dengan `getCategoryPage()` / `getPackagePage()` di `@/lib/site`,
 * query di sini tidak memfilter `isPublished` atau `hasDetailPage`. Editor
 * harus bisa menampilkan draft yang belum dipublikasikan — termasuk paket Open
 * Trip yang memang tidak punya halaman detail, justru paket itulah yang paling
 * perlu disunting dari panel.
 */

/**
 * Hasil satu pemanggilan preview-base: data tubuh halaman + kerangkanya.
 *
 * Kerangka (`ShellData`) di sini adalah props `PublicShell` apa adanya, karena
 * preview merender komponen yang sama dengan route publik. Wajib ada: seluruh
 * `legacy.css` di-scope di bawah `.hb2d1n`, dan modifier `--home` /
 * `--category` / `--opentrip` / `--package` yang mengatur perbedaan tata letak
 * antar halaman. Tanpa wrapper itu, preview memakai komponen yang benar tetapi
 * tampil tanpa desain — bukan pratinjau yang bisa dipakai menilai hasil edit.
 *
 * `waNumber` / `waMessage` tidak diulang di sini karena sudah ada di `shell` —
 * keduanya dibaca dari `SiteSettings` yang sama, jadi menyalinnya ke dua tempat
 * hanya membuka pintu bagi nilai yang tidak sengaja berbeda.
 */
export type PreviewBase<TBody> = {
  base: TBody;
  shell: ShellData;
  /**
   * Foto latar banner CTA global (SiteSettings) untuk preview kategori/paket.
   *
   * Route publik menggunakannya sebagai fallback saat halaman tidak punya
   * latar sendiri; tanpa nilai ini preview menampilkan gradasi padahal situs
   * aslinya sudah berfoto.
   */
  ctaBackgroundFallback?: string | null;
  /**
   * Kartu halaman HTML yang tampil di halaman ini (konteks preview).
   *
   * Pratinjau beranda/kategori ikut menampilkan kartu `/adm-cms-hb/halaman` yang
   * sudah tayang supaya admin bisa menilai urutan dan kepadatan seksi kartu
   * tanpa membuka halaman publik. Sumbernya query yang sama dengan route
   * publik, jadi preview tidak menampilkan kartu yang di situs asli absen.
   */
  pages?: PageCardData[];
};

/** Foto latar banner CTA global, dipakai sebagai fallback preview. */
export async function globalCtaBackground(): Promise<string | null> {
  const row = await prisma.siteSettings.findFirst({ select: { ctaBackground: true } });
  return row?.ctaBackground ?? null;
}

/**
 * Muat header, footer, dan tombol WhatsApp untuk preview.
 *
 * Nav memakai kategori yang benar-benar tampil di menu (`showInNav` +
 * `isPublished`) supaya preview tidak menautkan halaman yang di situs asli
 * juga tidak ada di menu.
 */
export async function previewShell(variant: ShellData["variant"]): Promise<ShellData> {
  const [settings, nav] = await Promise.all([
    prisma.siteSettings.findFirst(),
    prisma.category.findMany({
      where: { showInNav: true, isPublished: true },
      select: { slug: true, navLabel: true },
      orderBy: { order: "asc" },
    }),
  ]);

  return {
    variant,
    waNumber: settings?.waNumber ?? "",
    waMessage: settings?.waMessage ?? "",
    waGreeting: settings?.waGreeting ?? "",
    stickyWaLabel: settings?.stickyWaLabel ?? "",
    stickyWaLink: settings?.stickyWaLink ?? "",
    nav: nav.map((c) => ({ slug: c.slug, label: c.navLabel })),
    footer: {
      siteUrl: settings?.siteUrl ?? "",
      email: settings?.email ?? "",
      instagram: settings?.instagram ?? "",
      tiktok: settings?.tiktok ?? "",
      footerText: settings?.footerText ?? "",
      footerHeading: settings?.footerHeading ?? "",
      copyrightText: settings?.copyrightText ?? "",
      footerMadeWith: settings?.footerMadeWith ?? "",
      footerLocation: settings?.footerLocation ?? "",
      footerHeart: settings?.footerHeart ?? "",
    },
  };
}

/**
 * Opsi kategori untuk dropdown penempatan kartu halaman HTML.
 *
 * Urutannya sama dengan urutan tampil kategori di situs; label memakai
 * `navLabel` (nama yang tampil di menu) supaya admin memilih dengan nama yang
 * dia kenali dari navigasi.
 */
export async function categoryOptions(): Promise<Option[]> {
  const rows = await prisma.category.findMany({
    select: { slug: true, navLabel: true, name: true },
    orderBy: { order: "asc" },
  });
  return rows.map((c) => ({ value: c.slug, label: c.navLabel || c.name }));
}

/**
 * Data awal live preview editor `/adm-cms-hb/halaman`.
 *
 * Hanya bagian yang punya padanan visual di pratinjau: dokumen yang ditempel
 * dan kartu tautannya. `slug`/`order` ikut disimpan supaya pratinjau alamat
 * `/halaman/<slug>` bisa menampilkan URL yang benar saat mode ubah.
 */
export type HtmlPagePreviewBase = {
  title: string;
  slug: string;
  html: string;
  cardTag: string;
  cardTitle: string;
  cardDesc: string;
  cardButtonLabel: string;
  cardImage: string | null;
  showOnHome: boolean;
  categorySlugs: string[];
  isPublished: boolean;
};

/**
 * Preview untuk editor halaman HTML.
 *
 * `page` diisi saat mode ubah (dari baris database); saat membuat baru semua
 * nilai default kosong dan nilai draft dari form menimpanya lewat
 * `htmlPagePreview()` — sama seperti editor kategori/paket.
 */
export async function halamanPreviewBase(
  page?: Partial<HtmlPagePreviewBase>,
): Promise<PreviewBase<HtmlPagePreviewBase>> {
  return {
    base: {
      title: page?.title ?? "",
      slug: page?.slug ?? "",
      html: page?.html ?? "",
      cardTag: page?.cardTag ?? "",
      cardTitle: page?.cardTitle ?? "",
      cardDesc: page?.cardDesc ?? "",
      cardButtonLabel: page?.cardButtonLabel ?? "",
      cardImage: page?.cardImage ?? null,
      showOnHome: page?.showOnHome ?? false,
      categorySlugs: page?.categorySlugs ?? [],
      isPublished: page?.isPublished ?? true,
    },
    shell: await previewShell("home"),
  };
}

/**
 * Data awal live preview editor `/adm-cms-hb/sosmed`.
 *
 * Halaman link-bio dirender di luar layout situs (`<BioLinkPage>` mandiri),
 * jadi preview tidak butuh `PublicShell` — cukup isi `BioLinkPageData`.
 */
export type BioPreviewBase = {
  base: BioLinkPageData;
};

export async function bioPreviewBase(page?: {
  bio?: unknown;
}): Promise<BioPreviewBase> {
  return {
    base: page?.bio ? normalizeBio(page.bio) : emptyBio(),
  };
}

const cardSelect = {
  slug: true,
  name: true,
  isFeatured: true,
  cardVariant: true,
  cardLinkMode: true,
  cardImage: true,
  cardImageAlt: true,
  cardLoc: true,
  cardHomeLoc: true,
  cardTag: true,
  cardRating: true,
  cardHighlight: true,
  cardButtonLabel: true,
  cardWaLink: true,
  waMessage: true,
  cardDays: { select: { label: true, title: true }, orderBy: { order: "asc" } },
  cardPrices: { select: { label: true, value: true, unit: true }, orderBy: { order: "asc" } },
  cardFacilities: { select: { label: true }, orderBy: { order: "asc" } },
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

export async function categoryPreviewBase(slug: string): Promise<PreviewBase<CategoryBodyData> | null> {
  const category = await prisma.category.findUnique({
    where: { slug },
    select: {
      slug: true,
      kind: true,
      gridColumns: true,
      ...heroSelect,
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
      benefits: {
        select: { id: true, icon: true, title: true, description: true },
        orderBy: { order: "asc" },
      },
      packages: { select: cardSelect, orderBy: [{ order: "asc" }, { name: "asc" }] },
    },
  });

  if (!category) return null;

  const base: CategoryBodyData = {
    ...category,
    listingNoteIcon: category.listingNoteIcon,
    listingNoteText: category.listingNoteText,
    benefits: category.benefits.map((b) => ({
      id: b.id,
      icon: b.icon,
      title: b.title,
      description: b.description,
    })),
    packages: category.packages.map((p) => ({
      slug: p.slug,
      name: p.name,
      isFeatured: p.isFeatured,
      cardVariant: p.cardVariant,
      cardLinkMode: p.cardLinkMode,
      cardImage: p.cardImage,
      cardImageAlt: p.cardImageAlt,
      cardLoc: p.cardLoc,
      cardHomeLoc: p.cardHomeLoc,
      cardTag: p.cardTag,
      cardRating: p.cardRating,
      cardHighlight: p.cardHighlight,
      cardButtonLabel: p.cardButtonLabel,
      cardWaLink: p.cardWaLink,
      waMessage: p.waMessage,
      cardDays: p.cardDays,
      cardPrices: p.cardPrices,
      cardFacilities: p.cardFacilities,
    })),
  };

  const [shell, ctaBackgroundFallback, pages] = await Promise.all([
    previewShell(category.kind === "OPEN_TRIP" ? "opentrip" : "category"),
    globalCtaBackground(),
    getPageCards("category", category.slug),
  ]);

  return {
    base,
    shell,
    ctaBackgroundFallback,
    pages,
  };
}

/**
 * Preview untuk kategori yang BELUM disimpan (halaman "Kategori baru").
 *
 * Tidak ada baris database untuk di-query, jadi semua field kategori diisi
 * kosong dan daftar paket dibiarkan kosong. Nilai yang diketik user menimpa
 * `base` lewat `categoryPreview()`; `base` hanya jadi fallback sebelum field
 * pernah disentuh. Varian CSS mengikuti `kind` awal (Open Trip) dan diperbarui
 * lagi secara live saat user mengubah pilihan tipe di form.
 */
export async function newCategoryPreviewBase(
  kind: "OPEN_TRIP" | "PRIVATE" = "OPEN_TRIP",
): Promise<PreviewBase<CategoryBodyData>> {
  const [shell, ctaBackgroundFallback, pages] = await Promise.all([
    previewShell(kind === "OPEN_TRIP" ? "opentrip" : "category"),
    globalCtaBackground(),
    // Kategori baru belum punya slug, jadi belum ada kartu yang bisa
    // ditempatkan di sini sampai disimpan.
    getPageCards("category", ""),
  ]);

  const base: CategoryBodyData = {
    slug: "",
    kind,
    gridColumns: kind === "OPEN_TRIP" ? 3 : 2,
    heroBadges: [],
    heroTitle: "",
    heroAccent: "",
    heroSuffix: "",
    heroDescription: "",
    heroDecos: [],
    heroImage: null,
    heroImageAlt: null,
    heroWaLink: "",
    ctaPrimaryLabel: "",
    ctaSecondaryLabel: "",
    ctaSecondaryAnchor: "",
    ctaMessage: "",
    ctaWaNumber: "",
    ctaWaGreeting: "",
    ctaTitle: "",
    ctaText: "",
    ctaLabel: "",
    ctaWaLink: "",
    ctaBackground: null,
    // Kategori baru belum punya isian WhatsApp sendiri, jadi field-nya
    // diisikan nilai global supaya pesan yang sudah ada langsung tampil dan
    // bisa disunting admin.
    waNumber: shell.waNumber,
    waGreeting: shell.waGreeting ?? "",
    waMessage: shell.waMessage,
    listingTag: "",
    listingTitle: "",
    listingAccent: "",
    listingSuffix: "",
    listingDescription: "",
    listingAnchor: "",
    listingNoteIcon: null,
    listingNoteText: null,
    pgAnchor: "halaman",
    pgTag: "",
    pgTitle: "",
    pgAccent: "",
    pgSuffix: "",
    pgDesc: "",
    benefitsTag: "",
    benefitsTitle: "",
    benefitsAccent: "",
    benefitsSuffix: "",
    benefitsDescription: "",
    benefits: [],
    packages: [],
  };

  return {
    base,
    shell,
    ctaBackgroundFallback,
    pages,
  };
}

export async function packagePreviewBase(slug: string): Promise<PreviewBase<PackagePreviewData> | null> {
  const pkg = await prisma.package.findUnique({
    where: { slug },
    select: {
      slug: true,
      name: true,
      isFeatured: true,
      waMessage: true,
      waNumber: true,
      waGreeting: true,
      kind: true,
      hasDetailPage: true,
      cardVariant: true,
      cardLinkMode: true,
      cardButtonLabel: true,
      cardWaLink: true,
      ...heroSelect,
      heroImage: true,
      heroImageAlt: true,
      itineraryTag: true,
      itineraryTitle: true,
      itineraryAccent: true,
      itinerarySuffix: true,
      itineraryDescription: true,
      itineraryAnchor: true,
      itineraryColumns: true,
      itinerary: {
        select: {
          id: true,
          emoji: true,
          label: true,
          title: true,
          items: { select: { time: true, text: true }, orderBy: { order: "asc" } },
        },
        orderBy: { order: "asc" },
      },
      facilityTag: true,
      facilityTitle: true,
      facilityAccent: true,
      facilitySuffix: true,
      facilityDescription: true,
      facilities: {
        select: {
          id: true,
          variant: true,
          title: true,
          items: { select: { icon: true, text: true }, orderBy: { order: "asc" } },
        },
        orderBy: { order: "asc" },
      },
      notes: { select: { id: true, icon: true, text: true }, orderBy: { order: "asc" } },
      pricingTag: true,
      pricingTitle: true,
      pricingAccent: true,
      pricingSuffix: true,
      pricingDescription: true,
      pricing: {
        select: {
          kind: true,
          note: true,
          rowHeaderLabel: true,
          columns: { select: { id: true, label: true, cssClass: true }, orderBy: { order: "asc" } },
          rows: {
            select: {
              id: true,
              label: true,
              values: { select: { columnId: true, value: true } },
            },
            orderBy: { order: "asc" },
          },
          items: { select: { label: true, value: true, unit: true }, orderBy: { order: "asc" } },
        },
      },
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
        select: { id: true, day: true, month: true, year: true, description: true },
        orderBy: { order: "asc" },
      },
      gallery: { select: { id: true, url: true, alt: true }, orderBy: { order: "asc" } },
    },
  });

  if (!pkg) return null;

  const base: PackagePreviewData = {
    ...pkg,
    pricing: pkg.pricing
      ? {
          kind: pkg.pricing.kind,
          note: pkg.pricing.note,
          rowHeaderLabel: pkg.pricing.rowHeaderLabel,
          columns: pkg.pricing.columns,
          rows: pkg.pricing.rows,
          items: pkg.pricing.items,
        }
      : null,
  };

  const [shell, ctaBackgroundFallback] = await Promise.all([
    previewShell("package"),
    globalCtaBackground(),
  ]);

  return {
    base,
    shell,
    ctaBackgroundFallback,
  };
}

export async function homePreviewBase(): Promise<PreviewBase<HomeBodyProps> | null> {
  const [settings, stats, benefits, testimonials, favorites, types, pages, gallery, igFeed] = await Promise.all([
    prisma.siteSettings.findFirst(),
    prisma.homeStat.findMany({ select: { num: true, label: true }, orderBy: { order: "asc" } }),
    prisma.benefit.findMany({
      where: { isHomepage: true },
      select: { id: true, icon: true, title: true, description: true },
      orderBy: { order: "asc" },
    }),
    prisma.testimonial.findMany({
      select: { stars: true, quote: true, author: true, location: true },
      orderBy: { order: "asc" },
    }),
    prisma.package.findMany({
      where: { showOnHome: true },
      select: cardSelect,
      orderBy: [{ order: "asc" }, { name: "asc" }],
    }),
    prisma.category.findMany({
      select: {
        slug: true,
        navLabel: true,
        cardIcon: true,
        cardDescription: true,
        cardPrice: true,
        cardLinkLabel: true,
        cardImage: true,
        cardImageAlt: true,
      },
      orderBy: { order: "asc" },
    }),
    getPageCards("home"),
    prisma.homeGalleryImage.findMany({
      select: { id: true, url: true, alt: true },
      orderBy: { order: "asc" },
    }),
    getInstagramFeed(0, IG_BATCH),
  ]);

  if (!settings) return null;

  return {
    base: {
      settings: {
        waNumber: settings.waNumber,
        waMessage: settings.waMessage,
        waGreeting: settings.waGreeting,
        homeHeroBadges: settings.homeHeroBadges,
        homeHeroTitle: settings.homeHeroTitle,
        homeHeroAccent: settings.homeHeroAccent,
        homeHeroSuffix: settings.homeHeroSuffix,
        homeHeroText: settings.homeHeroText,
        homeHeroDecos: settings.homeHeroDecos,
        homeHeroImage: settings.homeHeroImage,
        homeHeroImageAlt: settings.homeHeroImageAlt,
        homeHeroPrimaryLabel: settings.homeHeroPrimaryLabel,
        homeHeroWaLink: settings.homeHeroWaLink,
        homeHeroSecondaryLabel: settings.homeHeroSecondaryLabel,
        homeHeroSecondaryAnchor: settings.homeHeroSecondaryAnchor,
        homeTypesAnchor: settings.homeTypesAnchor,
        homeTypesTag: settings.homeTypesTag,
        homeTypesTitle: settings.homeTypesTitle,
        homeTypesAccent: settings.homeTypesAccent,
        homeTypesSuffix: settings.homeTypesSuffix,
        homeTypesDesc: settings.homeTypesDesc,
        homeTypesEnabled: settings.homeTypesEnabled,
        homePgAnchor: settings.homePgAnchor,
        homePgTag: settings.homePgTag,
        homePgTitle: settings.homePgTitle,
        homePgAccent: settings.homePgAccent,
        homePgSuffix: settings.homePgSuffix,
        homePgDesc: settings.homePgDesc,
        homePgEnabled: settings.homePgEnabled,
        homeFavTag: settings.homeFavTag,
        homeFavTitle: settings.homeFavTitle,
        homeFavAccent: settings.homeFavAccent,
        homeFavSuffix: settings.homeFavSuffix,
        homeFavDesc: settings.homeFavDesc,
        homeFavEnabled: settings.homeFavEnabled,
        homeGridColumns: settings.homeGridColumns,
        homeBenefitsTag: settings.homeBenefitsTag,
        homeBenefitsTitle: settings.homeBenefitsTitle,
        homeBenefitsAccent: settings.homeBenefitsAccent,
        homeBenefitsSuffix: settings.homeBenefitsSuffix,
        homeBenefitsDesc: settings.homeBenefitsDesc,
        homeBenefitsEnabled: settings.homeBenefitsEnabled,
        homeTestiTag: settings.homeTestiTag,
        homeTestiTitle: settings.homeTestiTitle,
        homeTestiAccent: settings.homeTestiAccent,
        homeTestiSuffix: settings.homeTestiSuffix,
        homeTestiDesc: settings.homeTestiDesc,
        homeTestiEnabled: settings.homeTestiEnabled,
        homeIgTag: settings.homeIgTag,
        homeIgTitle: settings.homeIgTitle,
        homeIgAccent: settings.homeIgAccent,
        homeIgSuffix: settings.homeIgSuffix,
        homeIgDesc: settings.homeIgDesc,
        homeIgEnabled: settings.homeIgEnabled,
        homeGalleryTag: settings.homeGalleryTag,
        homeGalleryTitle: settings.homeGalleryTitle,
        homeGalleryAccent: settings.homeGalleryAccent,
        homeGallerySuffix: settings.homeGallerySuffix,
        homeGalleryDesc: settings.homeGalleryDesc,
        homeGalleryAnchor: settings.homeGalleryAnchor,
        homeGalleryColumns: settings.homeGalleryColumns,
        homeGalleryEnabled: settings.homeGalleryEnabled,
        instagram: settings.instagram,
        ctaTitle: settings.ctaTitle,
        ctaText: settings.ctaText,
        ctaLabel: settings.ctaLabel,
        ctaMessage: settings.ctaMessage,
        ctaWaNumber: settings.ctaWaNumber,
        ctaWaGreeting: settings.ctaWaGreeting,
        ctaWaLink: settings.ctaWaLink,
        ctaBackground: settings.ctaBackground,
      },
      stats,
      benefits,
      testimonials,
      favorites: favorites.map((p) => ({
        slug: p.slug,
        name: p.name,
        isFeatured: p.isFeatured,
        cardVariant: p.cardVariant,
        cardLinkMode: p.cardLinkMode,
        cardImage: p.cardImage,
        cardImageAlt: p.cardImageAlt,
        cardLoc: p.cardLoc,
        cardHomeLoc: p.cardHomeLoc,
        cardTag: p.cardTag,
        cardRating: p.cardRating,
        cardHighlight: p.cardHighlight,
        cardButtonLabel: p.cardButtonLabel,
        cardWaLink: p.cardWaLink,
        waMessage: p.waMessage,
        cardDays: p.cardDays,
        cardPrices: p.cardPrices,
        cardFacilities: p.cardFacilities,
      })),
      types: types.map((t) => ({
        slug: t.slug,
        name: t.navLabel,
        icon: t.cardIcon,
        description: t.cardDescription,
        price: t.cardPrice,
        linkLabel: t.cardLinkLabel,
        image: t.cardImage,
        imageAlt: t.cardImageAlt,
      })),
      igPosts: igFeed.posts,
      igHasMore: igFeed.total > igFeed.posts.length,
      gallery,
    },
    shell: await previewShell("home"),
    pages,
  };
}
