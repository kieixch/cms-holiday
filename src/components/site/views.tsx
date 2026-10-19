import type { ReactNode } from "react";

import { PublicShell } from "./public-shell";
import { Hero, SectionHead, resolveSecondaryAnchor } from "./hero";
import { PackageCard, type CardContext, type PackageCardData } from "./package-card";
import { BenefitGrid, TestimonialGrid, TypeCardGrid, type BenefitData, type TestimonialData, type TypeCardData } from "./home-blocks";
import { InstagramFeed } from "./instagram-feed";
import { InstagramGlyph } from "./instagram-glyph";
import type { InstagramPostData } from "@/lib/instagram-feed";
import { PageCardGrid, type PageCardData } from "./page-cards";
import { NoteBox, CtaBanner } from "./cta-banner";
import { composeWaMessage, safeHref } from "@/lib/wa";
import { FacilitiesGrid, ItineraryGrid, ScheduleGrid, type FacilityGroupData, type ItineraryDayData, type ScheduleItemData } from "./package-sections";
import { GalleryGrid, Pricing, type GalleryImageData, type PricingData } from "./pricing-gallery";

/**
 * Tampilan halaman publik yang dipakai dua tempat: route publik dan live
 * preview di panel admin.
 *
 * Dipisah dari `page.tsx` supaya keduanya benar-benar merender komponen yang
 * sama. Kalau view-nya hanya ada di route publik, preview akan menyimpang
 * sendiri begitu markup publik berubah — dan perubahan kecil seperti
 * `object-cover` tidak akan terlihat sampai audit gagal.
 *
 * Modul ini sengaja tidak memakai `import "server-only"` dan tidak menyentuh
 * Prisma. Semua prop-nya data biasa, jadi bisa di-render di server (halaman
 * publik) maupun di client (live preview admin) tanpa perbedaan hasil.
 */

/**
 * Cara membungkus satu section halaman.
 *
 * Route publik tidak mengoper apa pun, jadi `children` dirender polos dan
 * markup tetap sama persis dengan sebelumnya. Live preview di panel admin
 * mengoper fungsi yang membungkus tiap section dengan penanda `data-section`,
 * sehingga klik pada preview bisa dipetakan balik ke field di panel kiri.
 *
 * Nama section di sini harus sama dengan nilai `section` pada spec field.
 */
export type SectionWrap = (section: string, node: ReactNode) => ReactNode;

/** Bungkus tanpa mengubah apa pun — perilaku default route publik. */
export const identityWrap: SectionWrap = (_section, node) => node;

export type FooterData = Parameters<typeof PublicShell>[0]["footer"];
export type NavItem = { slug: string; label: string };

/**
 * Data kerangka halaman publik, tanpa `children`.
 *
 * Dipakai live preview panel admin untuk merender `<PublicShell>` sungguhan,
 * bukan potongan markup yang mirip. Karena bentuknya sama persis dengan props
 * `PublicShell`, perubahan di sana (mis. tambahan kolom di footer) otomatis
 * ikut terbawa dan preview tidak bisa diam-diam tertinggal.
 */
export type ShellData = Omit<Parameters<typeof PublicShell>[0], "children">;

/* ------------------------------------------------------------------ */
/* Beranda                                                             */
/* ------------------------------------------------------------------ */

export type HomeSettings = {
  waNumber: string;
  waMessage: string;
  /** Sapaan otomatis yang ditempel di depan pesan WhatsApp. */
  waGreeting: string;
  homeHeroBadges: string[];
  homeHeroTitle: string;
  homeHeroAccent: string;
  homeHeroSuffix: string;
  homeHeroText: string;
  homeHeroDecos: string[];
  /** Foto latar hero beranda. Kosong = foto paket favorit pertama. */
  homeHeroImage: string | null;
  homeHeroImageAlt: string | null;
  homeHeroPrimaryLabel: string;
  /** Link rotator tombol WhatsApp utama hero beranda. Kosong = wa.me. */
  homeHeroWaLink: string;
  homeHeroSecondaryLabel: string;
  homeHeroSecondaryAnchor: string;
  homeTypesAnchor: string;
  homeTypesTag: string;
  homeTypesTitle: string;
  homeTypesAccent: string;
  homeTypesSuffix: string;
  homeTypesDesc: string;
  /** Tampilkan seksi pilihan tipe trip. Hero & CTA selalu tampil. */
  homeTypesEnabled: boolean;
  homeFavTag: string;
  homeFavTitle: string;
  homeFavAccent: string;
  homeFavSuffix: string;
  homeFavDesc: string;
  /** Tampilkan seksi paket favorit. */
  homeFavEnabled: boolean;
  /** Kepala seksi kartu tautan halaman HTML (`/admin/halaman`, `scope: page`). */
  homePgTag: string;
  homePgTitle: string;
  homePgAccent: string;
  homePgSuffix: string;
  homePgDesc: string;
  homePgAnchor: string;
  /** Tampilkan seksi kartu halaman HTML. */
  homePgEnabled: boolean;
  homeGridColumns: number;
  homeBenefitsTag: string;
  homeBenefitsTitle: string;
  homeBenefitsAccent: string;
  homeBenefitsSuffix: string;
  homeBenefitsDesc: string;
  /** Tampilkan seksi keunggulan. */
  homeBenefitsEnabled: boolean;
  homeTestiTag: string;
  homeTestiTitle: string;
  homeTestiAccent: string;
  homeTestiSuffix: string;
  homeTestiDesc: string;
  /** Tampilkan seksi testimoni. */
  homeTestiEnabled: boolean;
  /** Tag seksi feed Instagram. */
  homeIgTag: string;
  homeIgTitle: string;
  homeIgAccent: string;
  homeIgSuffix: string;
  /** Teks di samping logo pada baris brand seksi Instagram. */
  homeIgDesc: string;
  /** Tampilkan seksi feed Instagram. */
  homeIgEnabled: boolean;
  /** Kepala seksi galeri pengunjung (dikelola dari editor Beranda). */
  homeGalleryTag: string;
  homeGalleryTitle: string;
  homeGalleryAccent: string;
  homeGallerySuffix: string;
  homeGalleryDesc: string;
  homeGalleryAnchor: string;
  /** Kolom grid galeri pengunjung di desktop. */
  homeGalleryColumns: number;
  /** Tampilkan seksi galeri pengunjung. */
  homeGalleryEnabled: boolean;
  /** URL profil Instagram — tujuan logo dan baris deskripsi. */
  instagram: string;
  ctaTitle: string;
  ctaText: string;
  ctaLabel: string;
  ctaMessage: string;
  /** Nomor WhatsApp khusus banner CTA global. Kosong = waNumber. */
  ctaWaNumber: string;
  /** Sapaan otomatis khusus banner CTA global. Kosong = waGreeting. */
  ctaWaGreeting: string;
  /** Link rotator tombol banner CTA global. Kosong = wa.me. */
  ctaWaLink: string;
  /** Foto latar banner CTA. Kosong = gradasi hijau seperti semula. */
  ctaBackground: string | null;
};

export type HomeTypeCardData = TypeCardData & { name: string };

export type HomeBodyProps = {
  settings: HomeSettings;
  stats: { num: string; label: string }[];
  benefits: BenefitData[];
  testimonials: TestimonialData[];
  favorites: PackageCardData[];
  types: HomeTypeCardData[];
  /**
   * Batch pertama feed Instagram (8 postingan terbaru) untuk seksi di bawah
   * testimoni. Kosong kalau `IG_USER_ID`/`IG_ACCESS_TOKEN` belum disetel —
   * seksi tetap tampil (kepala + baris brand), hanya grid-nya yang absen.
   */
  igPosts: InstagramPostData[];
  /** Masih ada postingan setelah batch pertama? Menggerakkan tombol load-more. */
  igHasMore: boolean;
  /**
   * Kartu halaman HTML mandiri yang dipilih admin tampil di beranda
   * (`/admin/halaman`). Opsional; kosong = seksi kartu tidak dirender.
   */
  pages?: PageCardData[];
  /**
   * Foto seksi "Galeri Pengunjung", dikelola dari editor Beranda. Kepala seksi
   * mengikuti `homeGalleryEnabled`; grid-nya kosong sampai foto ditambahkan.
   */
  gallery?: GalleryImageData[];
  wrap?: SectionWrap;
};

/** Isi halaman beranda, tanpa header/footer. */
export function HomeBody({
  settings,
  stats,
  benefits,
  testimonials,
  favorites,
  types,
  igPosts,
  igHasMore,
  pages = [],
  gallery = [],
  wrap = identityWrap,
}: HomeBodyProps) {
  const gridCols = Math.max(1, Math.min(4, settings.homeGridColumns || 3));

  return (
    <>
      {wrap(
        "hero",
        <Hero
          badges={settings.homeHeroBadges}
          title={settings.homeHeroTitle}
          accent={settings.homeHeroAccent}
          suffix={settings.homeHeroSuffix}
          description={settings.homeHeroText}
          decos={settings.homeHeroDecos}
          primaryLabel={settings.homeHeroPrimaryLabel}
          secondaryLabel={settings.homeHeroSecondaryLabel}
          secondaryAnchor={safeHref(settings.homeHeroSecondaryAnchor)}
          waNumber={settings.waNumber}
          waMessage={composeWaMessage(settings.waGreeting, settings.waMessage)}
          primaryLink={settings.homeHeroWaLink}
          stats={stats}
          media={
            settings.homeHeroImage
              ? {
                  src: settings.homeHeroImage,
                  alt: settings.homeHeroImageAlt ?? "",
                }
              : favorites[0]?.cardImage
                ? { src: favorites[0].cardImage, alt: favorites[0].cardImageAlt ?? "" }
                : undefined
          }
        />,
      )}

      {settings.homeTypesEnabled
        ? wrap(
            "types",
            <section data-reveal className="section container" id={settings.homeTypesAnchor}>
              <SectionHead
                tag={settings.homeTypesTag}
                title={settings.homeTypesTitle}
                accent={settings.homeTypesAccent}
                suffix={settings.homeTypesSuffix}
                desc={settings.homeTypesDesc}
              />
              <TypeCardGrid items={types} />
            </section>,
          )
        : null}

      {/*
        Kartu halaman HTML mandiri: tepat di bawah seksi types. Kepala
        seksi-nya (`homePg*`) disunting di editor Beranda; kartunya sendiri
        dari `/admin/halaman`. Section dibungkus `wrap` supaya kliknya di live
        preview melompat ke field `homePg*`.
      */}
      {pages.length > 0 && settings.homePgEnabled
        ? wrap(
            "pages",
            <section
              data-reveal
              className="section container hbgl-band"
              id={settings.homePgAnchor || "halaman"}
            >
              <span className="hbgl-band__wave hbgl-band__wave--bottom" aria-hidden="true">
                <svg viewBox="0 0 1440 100" preserveAspectRatio="none" focusable="false">
                  <path d="M0,0 H1440 V48 Q1260,4 1080,48 Q900,92 720,48 Q540,4 360,48 Q180,92 0,48 Z" />
                </svg>
              </span>
              <SectionHead
                tag={settings.homePgTag}
                title={settings.homePgTitle}
                accent={settings.homePgAccent}
                suffix={settings.homePgSuffix}
                desc={settings.homePgDesc}
              />
              <PageCardGrid pages={pages} />
            </section>,
          )
        : null}

      {settings.homeFavEnabled
        ? wrap(
            "favorites",
            <section data-reveal className="section container">
              <SectionHead
                tag={settings.homeFavTag}
                title={settings.homeFavTitle}
                accent={settings.homeFavAccent}
                suffix={settings.homeFavSuffix}
                desc={settings.homeFavDesc}
              />
              <div className={`package-grid cols-${gridCols}`}>
                {favorites.map((p) => (
                  <PackageCard key={p.slug} pkg={p} waNumber={settings.waNumber} context="home" />
                ))}
              </div>
            </section>,
          )
        : null}

      {settings.homeBenefitsEnabled
        ? wrap(
            "benefits",
            <section data-reveal className="section container">
              <SectionHead
                tag={settings.homeBenefitsTag}
                title={settings.homeBenefitsTitle}
                accent={settings.homeBenefitsAccent}
                suffix={settings.homeBenefitsSuffix}
                desc={settings.homeBenefitsDesc}
              />
              <BenefitGrid items={benefits} />
            </section>,
          )
        : null}

      {settings.homeTestiEnabled
        ? wrap(
            "testimonials",
            <section data-reveal className="section container">
              <SectionHead
                tag={settings.homeTestiTag}
                title={settings.homeTestiTitle}
                accent={settings.homeTestiAccent}
                suffix={settings.homeTestiSuffix}
                desc={settings.homeTestiDesc}
              />
              <TestimonialGrid items={testimonials} />
            </section>,
          )
        : null}

      {settings.homeIgEnabled
        ? wrap(
            "instagram",
            <section data-reveal className="section container" id="instagram">
              <SectionHead
                tag={settings.homeIgTag}
                title={settings.homeIgTitle}
                accent={settings.homeIgAccent}
                suffix={settings.homeIgSuffix}
              />
              {/*
                Baris brand: satu tautan yang memuat logo + deskripsi. Mengarahkan
                keduanya ke profil Instagram, dan hover di mana pun pada baris
                menyalakan efek yang sama untuk logo maupun deskripsi (lihat CSS
                `hbgl-ig-brand`) — persis permintaan "hover deskripsi ikut
                meng-hover logo dan berubah jadi tombol".
              */}
              <a
                className="hbgl-ig-brand"
                href={safeHref(settings.instagram)}
                target="_blank"
                rel="noopener"
              >
                <span className="hbgl-ig-brand__logo">
                  {/* Mark logo Holiday (bagian kotak LogoSvg) supaya pas di lingkaran. */}
                  <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">
                    <rect x="0" y="0" width="120" height="120" rx="26" fill="#DDE8E1" />
                    <circle cx="60" cy="48" r="24" fill="#245447" />
                    <circle cx="42" cy="64" r="18" fill="#245447" />
                    <circle cx="78" cy="64" r="18" fill="#245447" />
                    <circle cx="50" cy="40" r="12" fill="#3F705D" opacity="0.5" />
                    <rect x="56" y="80" width="8" height="24" rx="4" fill="#7B4A2D" />
                    <ellipse cx="60" cy="103" rx="16" ry="5" fill="#6B3A1F" opacity="0.2" />
                  </svg>
                  <span className="hbgl-ig-brand__icon">
                    <InstagramGlyph size={22} />
                  </span>
                </span>
                <span className="hbgl-ig-brand__desc">{settings.homeIgDesc}</span>
              </a>
              <InstagramFeed initialPosts={igPosts} initialHasMore={igHasMore} />
            </section>,
          )
        : null}

      {settings.homeGalleryEnabled
        ? wrap(
            "gallery",
            <section
              data-reveal
              className="section container"
              id={settings.homeGalleryAnchor || "galeri"}
            >
              <SectionHead
                tag={settings.homeGalleryTag}
                title={settings.homeGalleryTitle}
                accent={settings.homeGalleryAccent}
                suffix={settings.homeGallerySuffix}
                desc={settings.homeGalleryDesc}
              />
              <GalleryGrid images={gallery} columns={settings.homeGalleryColumns} />
            </section>,
          )
        : null}

      {wrap(
        "cta",
        <CtaBanner
          title={settings.ctaTitle}
          text={settings.ctaText}
          label={settings.ctaLabel}
          background={settings.ctaBackground}
          waNumber={settings.ctaWaNumber || settings.waNumber}
          waMessage={composeWaMessage(
            settings.ctaWaGreeting || settings.waGreeting,
            settings.ctaMessage || settings.waMessage,
          )}
          link={settings.ctaWaLink}
        />,
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Kategori / listing                                                  */
/* ------------------------------------------------------------------ */

export type CategoryBodyData = {
  slug: string;
  kind: string;
  gridColumns: number;
  heroBadges: string[];
  heroTitle: string;
  heroAccent: string;
  heroSuffix: string;
  heroDescription: string;
  heroDecos: string[];
  /// Foto latar cinematic kategori. Kosong berarti pakai foto paket pertama.
  heroImage: string | null;
  heroImageAlt: string | null;
  /** Link rotator tombol WhatsApp utama hero. Kosong = wa.me. */
  heroWaLink: string;
  ctaPrimaryLabel: string;
  ctaSecondaryLabel: string;
  ctaSecondaryAnchor: string;
  ctaMessage: string;
  /** Nomor WhatsApp khusus banner CTA halaman ini. Kosong = waNumber halaman/global. */
  ctaWaNumber: string;
  /** Sapaan otomatis khusus banner CTA halaman ini. Kosong = waGreeting halaman/global. */
  ctaWaGreeting: string;
  ctaTitle: string;
  ctaText: string;
  ctaLabel: string;
  /** Link rotator tombol banner CTA halaman ini. Kosong = wa.me. */
  ctaWaLink: string;
  /// Foto latar banner CTA halaman ini. Kosong = foto global (SiteSettings).
  ctaBackground: string | null;
  /** Nomor WhatsApp khusus kategori. Kosong = pakai nomor situs. */
  waNumber: string;
  /** Sapaan pesan otomatis khusus kategori. Kosong = pakai sapaan situs. */
  waGreeting: string;
  /** Pesan WhatsApp khusus kategori. Kosong = pakai pesan situs. */
  waMessage: string;
  listingTag: string;
  listingTitle: string;
  listingAccent: string;
  listingSuffix: string;
  listingDescription: string;
  listingAnchor: string;
  listingNoteIcon: string | null;
  listingNoteText: string | null;
  pgAnchor: string;
  pgTag: string;
  pgTitle: string;
  pgAccent: string;
  pgSuffix: string;
  pgDesc: string;
  benefitsTag: string;
  benefitsTitle: string;
  benefitsAccent: string;
  benefitsSuffix: string;
  benefitsDescription: string;
  benefits: BenefitData[];
  packages: PackageCardData[];
};

export type CategoryBodyProps = {
  category: CategoryBodyData;
  waNumber: string;
  waMessage: string;
  /** Sapaan otomatis global (SiteSettings); kategori bisa menimpanya. */
  waGreeting?: string;
  /**
   * Foto latar banner CTA dari pengaturan global (SiteSettings) — dipakai
   * sebagai fallback saat kategori tidak punya latar sendiri.
   */
  ctaBackground?: string | null;
  /**
   * Kartu halaman HTML mandiri yang dipilih admin tampil di semua halaman
   * kategori (`/admin/halaman`). Opsional; kosong = seksi tidak dirender.
   */
  pages?: PageCardData[];
  wrap?: SectionWrap;
};

export function CategoryBody({
  category,
  waNumber,
  waMessage,
  waGreeting = "",
  ctaBackground,
  pages = [],
  wrap = identityWrap,
}: CategoryBodyProps) {
  const isOpenTrip = category.kind === "OPEN_TRIP";
  const cols = Math.max(1, Math.min(4, category.gridColumns || 3));
  // Nomor/sapaan/pesan: isian kategori menimpa pengaturan global. Pesan CTA
  // banner lama tetap dipakai sebagai fallback supaya halaman lama tidak
  // berubah sebelum admin mengisi kolom WhatsApp kategori yang baru.
  const waTo = category.waNumber || waNumber;
  const waGreetingFinal = category.waGreeting || waGreeting;
  const heroWa = composeWaMessage(
    waGreetingFinal,
    category.waMessage || category.ctaMessage || waMessage,
  );
  // Banner CTA punya nomor & sapaan sendiri; kosong = ikut tombol hero.
  const ctaWaTo = category.ctaWaNumber || waTo;
  const ctaWa = composeWaMessage(
    category.ctaWaGreeting || waGreetingFinal,
    category.ctaMessage || category.waMessage || waMessage,
  );
  const listingAnchor = category.listingAnchor || "paket";
  const secondaryAnchor = resolveSecondaryAnchor(
    category.ctaSecondaryLabel,
    {
      listing: listingAnchor,
      ...(category.benefits.length > 0 ? { benefits: "keunggulan" } : {}),
    },
    category.ctaSecondaryAnchor,
    "listing",
  );

  return (
    <>
      {wrap(
        "hero",
        <Hero
          badges={category.heroBadges}
          title={category.heroTitle}
          accent={category.heroAccent}
          suffix={category.heroSuffix}
          description={category.heroDescription}
          decos={category.heroDecos}
          primaryLabel={category.ctaPrimaryLabel}
          secondaryLabel={category.ctaSecondaryLabel}
          secondaryAnchor={secondaryAnchor}
          waNumber={waTo}
          waMessage={heroWa}
          primaryLink={category.heroWaLink}
          media={
            // Latar kategori Preferred. Kalau belum diisi, foto paket pertama
            // yang dipakai — sama seperti perilaku sebelum field ini ada.
            category.heroImage
              ? { src: category.heroImage, alt: category.heroImageAlt ?? "" }
              : category.packages[0]?.cardImage
                ? {
                    src: category.packages[0].cardImage,
                    alt: category.packages[0].cardImageAlt ?? "",
                  }
                : undefined
          }
        />,
      )}

      {wrap(
        "listing",
        <section data-reveal className="section container" id={listingAnchor}>
          <SectionHead
            tag={category.listingTag}
            title={category.listingTitle}
            accent={category.listingAccent}
            suffix={category.listingSuffix}
            desc={category.listingDescription}
          />
          <NoteBox icon={category.listingNoteIcon} text={category.listingNoteText} />
          <div
            className={`${isOpenTrip ? "trip-grid" : "package-grid"} cols-${cols}${
              !isOpenTrip && category.packages.length === 2 ? " is-pair" : ""
            }`}
          >
            {category.packages.map((p) => (
              <PackageCard
                key={p.slug}
                pkg={p}
                waNumber={waTo}
                context={isOpenTrip ? "opentrip" : "listing"}
                featured={p.isFeatured}
                sizes={isOpenTrip ? "(max-width: 768px) 100vw, 33vw" : undefined}
              />
            ))}
          </div>
        </section>,
      )}

      {/* Kartu halaman HTML mandiri: tepat di bawah listing paket. Kepala
          seksi-nya (`pg*`) disunting per kategori; kartunya dari
          `/admin/halaman`. */}
      {pages.length > 0
        ? wrap(
            "pages",
            <section
              data-reveal
              className="section container"
              id={category.pgAnchor || "halaman"}
            >
              <SectionHead
                tag={category.pgTag}
                title={category.pgTitle}
                accent={category.pgAccent}
                suffix={category.pgSuffix}
                desc={category.pgDesc}
              />
              <PageCardGrid pages={pages} />
            </section>,
          )
        : null}

      {category.benefits.length > 0
        ? wrap(
            "benefits",
            <section data-reveal className="section container" id="keunggulan">
              <SectionHead
                tag={category.benefitsTag}
                title={category.benefitsTitle}
                accent={category.benefitsAccent}
                suffix={category.benefitsSuffix}
                desc={category.benefitsDescription}
              />
              <BenefitGrid items={category.benefits} />
            </section>,
          )
        : null}

      {wrap(
        "cta",
        category.ctaTitle || category.ctaText || category.ctaLabel || category.ctaBackground ? (
          <CtaBanner
            title={category.ctaTitle}
            text={category.ctaText}
            label={category.ctaLabel}
            background={category.ctaBackground ?? ctaBackground}
            waNumber={ctaWaTo}
            waMessage={ctaWa}
            link={category.ctaWaLink}
          />
        ) : null,
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Detail paket                                                        */
/* ------------------------------------------------------------------ */

export type PackageBodyData = {
  slug: string;
  waMessage: string;
  /** Nomor WhatsApp khusus paket. Kosong = pakai nomor situs. */
  waNumber: string;
  /** Sapaan pesan otomatis khusus paket. Kosong = pakai sapaan situs. */
  waGreeting: string;
  heroBadges: string[];
  heroTitle: string;
  heroAccent: string;
  heroSuffix: string;
  heroDescription: string;
  heroDecos: string[];
  /// Foto latar cinematic paket. Kosong berarti pakai foto galeri pertama.
  heroImage: string | null;
  heroImageAlt: string | null;
  /** Link rotator tombol WhatsApp utama hero. Kosong = wa.me. */
  heroWaLink: string;
  ctaPrimaryLabel: string;
  ctaSecondaryLabel: string;
  ctaSecondaryAnchor: string;
  ctaMessage: string;
  /** Nomor WhatsApp khusus banner CTA paket ini. Kosong = waNumber paket/global. */
  ctaWaNumber: string;
  /** Sapaan otomatis khusus banner CTA paket ini. Kosong = waGreeting paket/global. */
  ctaWaGreeting: string;
  ctaTitle: string;
  ctaText: string;
  ctaLabel: string;
  /** Link rotator tombol banner CTA paket ini. Kosong = wa.me. */
  ctaWaLink: string;
  /// Foto latar banner CTA halaman ini. Kosong = foto global (SiteSettings).
  ctaBackground: string | null;
  jadwalTag: string;
  jadwalTitle: string;
  jadwalAccent: string;
  jadwalSuffix: string;
  jadwalDescription: string;
  jadwalAnchor: string;
  /** Jadwal keberangkatan; dirender di atas itinerary kalau tidak kosong. */
  schedule: ScheduleItemData[];
  itineraryTag: string;
  itineraryTitle: string;
  itineraryAccent: string;
  itinerarySuffix: string;
  itineraryDescription: string;
  itineraryAnchor: string;
  itineraryColumns: number;
  itinerary: ItineraryDayData[];
  facilityTag: string;
  facilityTitle: string;
  facilityAccent: string;
  facilitySuffix: string;
  facilityDescription: string;
  facilities: FacilityGroupData[];
  /**
   * Catatan paket (mis. syarat, Policies, hal yang perlu dibawa).
   *
   * Datanya sudah diambil `getPackagePage()`, tapi belum pernah dirender —
   * semua paket hasil impor punya `notes` kosong, jadi tidak ada yang terlihat.
   * Fieldnya tetap dipertahankan supaya editor admin bisa mengisinya, dan
   * sekarang catatan itu benar-benar muncul di halaman publik.
   */
  notes: { id: string; icon: string; text: string }[];
  pricingTag: string;
  pricingTitle: string;
  pricingAccent: string;
  pricingSuffix: string;
  pricingDescription: string;
  pricing: PricingData | null;
  galleryTag: string;
  galleryTitle: string;
  galleryAccent: string;
  gallerySuffix: string;
  galleryDescription: string;
  galleryColumns: number;
  gallery: { id: string; url: string; alt: string }[];
};

export type PackageBodyProps = {
  pkg: PackageBodyData;
  waNumber: string;
  waMessage: string;
  /** Sapaan otomatis global (SiteSettings); paket bisa menimpanya. */
  waGreeting?: string;
  /** Foto latar banner CTA dari pengaturan global (SiteSettings). */
  ctaBackground?: string | null;
  wrap?: SectionWrap;
};

export function PackageBody({
  pkg,
  waNumber,
  waMessage,
  waGreeting = "",
  ctaBackground,
  wrap = identityWrap,
}: PackageBodyProps) {
  // Nomor/sapaan/pesan: isian paket menimpa pengaturan global.
  const waTo = pkg.waNumber || waNumber;
  const wa = composeWaMessage(pkg.waGreeting || waGreeting, pkg.waMessage || waMessage);
  // Banner CTA punya nomor & sapaan sendiri; kosong = ikut tombol hero.
  const ctaWaTo = pkg.ctaWaNumber || waTo;
  const ctaWaMsg = composeWaMessage(
    pkg.ctaWaGreeting || pkg.waGreeting || waGreeting,
    pkg.ctaMessage || pkg.waMessage || waMessage,
  );
  const itineraryAnchor = pkg.itineraryAnchor || "itinerary";
  const secondaryAnchor = resolveSecondaryAnchor(
    pkg.ctaSecondaryLabel,
    {
      ...(pkg.itinerary.length > 0 ? { itinerary: itineraryAnchor } : {}),
      ...(pkg.facilities.length > 0 ? { facilities: "fasilitas" } : {}),
      ...(pkg.pricing ? { pricing: "harga" } : {}),
      ...(pkg.gallery.length > 0 ? { gallery: "galeri" } : {}),
    },
    pkg.ctaSecondaryAnchor,
    "itinerary",
  );

  return (
    <>
      {wrap(
        "hero",
        <Hero
          badges={pkg.heroBadges}
          title={pkg.heroTitle}
          accent={pkg.heroAccent}
          suffix={pkg.heroSuffix}
          description={pkg.heroDescription}
          decos={pkg.heroDecos}
          primaryLabel={pkg.ctaPrimaryLabel}
          secondaryLabel={pkg.ctaSecondaryLabel}
          secondaryAnchor={secondaryAnchor}
          waNumber={waTo}
          waMessage={wa}
          primaryLink={pkg.heroWaLink}
          media={
            // Latar paket. Kalau belum diisi, foto galeri pertama yang dipakai
            // — sama seperti perilaku sebelum field ini ada.
            pkg.heroImage
              ? { src: pkg.heroImage, alt: pkg.heroImageAlt ?? "" }
              : pkg.gallery[0]?.url
                ? { src: pkg.gallery[0].url, alt: pkg.gallery[0].alt ?? "" }
                : undefined
          }
        />,
      )}

      {pkg.schedule.length > 0
        ? wrap(
            "jadwal",
            <section data-reveal className="section container" id={pkg.jadwalAnchor || "jadwal"}>
              <SectionHead
                tag={pkg.jadwalTag}
                title={pkg.jadwalTitle}
                accent={pkg.jadwalAccent}
                suffix={pkg.jadwalSuffix}
                desc={pkg.jadwalDescription}
              />
              <ScheduleGrid items={pkg.schedule} />
            </section>,
          )
        : null}

      {pkg.itinerary.length > 0
        ? wrap(
            "itinerary",
            <section data-reveal className="section container" id={itineraryAnchor}>
              <SectionHead
                tag={pkg.itineraryTag}
                title={pkg.itineraryTitle}
                accent={pkg.itineraryAccent}
                suffix={pkg.itinerarySuffix}
                desc={pkg.itineraryDescription}
              />
              <ItineraryGrid days={pkg.itinerary} columns={pkg.itineraryColumns} />
            </section>,
          )
        : null}

      {pkg.facilities.length > 0
        ? wrap(
            "facilities",
            <section data-reveal className="section container" id="fasilitas">
              <SectionHead
                tag={pkg.facilityTag}
                title={pkg.facilityTitle}
                accent={pkg.facilityAccent}
                suffix={pkg.facilitySuffix}
                desc={pkg.facilityDescription}
              />
              <FacilitiesGrid groups={pkg.facilities} />
            </section>,
          )
        : null}

      {pkg.notes.length > 0
        ? wrap(
            "facilities",
            <section data-reveal className="section container">
              {pkg.notes.map((note) => (
                <NoteBox key={note.id} icon={note.icon} text={note.text} />
              ))}
            </section>,
          )
        : null}

      {pkg.pricing
        ? wrap(
            "pricing",
            <section data-reveal className="section container" id="harga">
              <SectionHead
                tag={pkg.pricingTag}
                title={pkg.pricingTitle}
                accent={pkg.pricingAccent}
                suffix={pkg.pricingSuffix}
                desc={pkg.pricingDescription}
              />
              <Pricing pricing={pkg.pricing} />
            </section>,
          )
        : null}

      {pkg.gallery.length > 0
        ? wrap(
            "gallery",
            <section data-reveal className="section container" id="galeri">
              <SectionHead
                tag={pkg.galleryTag}
                title={pkg.galleryTitle}
                accent={pkg.galleryAccent}
                suffix={pkg.gallerySuffix}
                desc={pkg.galleryDescription}
              />
              <GalleryGrid images={pkg.gallery} columns={pkg.galleryColumns} />
            </section>,
          )
        : null}

      {wrap(
        "cta",
        pkg.ctaTitle || pkg.ctaText || pkg.ctaLabel || pkg.ctaBackground ? (
          <CtaBanner
            title={pkg.ctaTitle}
            text={pkg.ctaText}
            label={pkg.ctaLabel}
            background={pkg.ctaBackground ?? ctaBackground}
            waNumber={ctaWaTo}
            waMessage={ctaWaMsg}
            link={pkg.ctaWaLink}
          />
        ) : null,
      )}
    </>
  );
}

export type { PackageCardData, BenefitData, TestimonialData, TypeCardData, PricingData, ItineraryDayData, FacilityGroupData, ScheduleItemData, CardContext };