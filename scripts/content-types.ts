/**
 * Bentuk data `content/content.json` — hasil `scripts/extract-content.ts`.
 * Dipakai bersama oleh extractor dan importer agar tidak berbeda jauh.
 */

import type { BioLinkPageData } from "@/lib/bio";

export type CategoryKey =
  | "openTrip"
  | "halfDay"
  | "fullDay"
  | "2d1n"
  | "3d2n"
  | "4d3n";

export type TripKind = "OPEN_TRIP" | "PRIVATE";

export type Hero = {
  badges: string[];
  title: string;
  accent: string;
  suffix: string;
  description: string;
  decos: string[];
  /**
   * Latar hero opsional. Tidak berasal dari HTML legacy (dulu hero memakai foto
   * paket/galeri pertama), tapi bisa disetel dari editor admin. Ikut disimpan
   * supaya `pnpm content:export` tidak menghilangkan background pilihan admin.
   */
  image?: string | null;
  imageAlt?: string | null;
  ctaPrimaryLabel: string;
  ctaPrimaryHref: string;
  /**
   * Link rotator tombol WhatsApp hero (mis. link Bitly). Opsional seperti
   * `image`: hanya ditulis kalau admin mengisinya, dan `ctaPrimaryHref` tetap
   * kosong — href sebenarnya dibentuk renderer dari link ini atau dari nomor
   * WhatsApp situs.
   */
  primaryLink?: string;
  ctaSecondaryLabel: string;
  ctaSecondaryHref: string;
};

export type CtaBanner = {
  title: string;
  text: string;
  label: string;
  href: string;
  /**
   * Latar banner opsional. Tidak berasal dari HTML legacy (dulu CTA memakai
   * gradasi hijau), tapi bisa disetel dari editor admin. Ditulis hanya kalau
   * terisi supaya file konten hasil extract lama tidak ikut berubah.
   */
  background?: string | null;
  /**
   * Link rotator tombol banner CTA. Ditulis hanya kalau terisi; kosong berarti
   * tombol tetap memakai nomor WhatsApp situs seperti sebelumnya.
   */
  link?: string | null;
};

export type Note = { icon: string; text: string };

/** Satu baris harga pada kartu paket. Kartu Open Trip bisa punya >1 baris. */
export type CardPrice = { label: string; value: string; unit: string };

export type Card = {
  name: string;
  image: string | null;
  imageAlt: string;
  loc: string;
  /** Label lokasi versi beranda; legacy memakai label lebih umum di sini. */
  homeLoc: string;
  tag: string;
  rating: string;
  highlight: string;
  facilityPills: string[];
  days: { label: string; title: string }[];
  priceLabel: string;
  priceValue: string;
  priceUnit: string;
  /** Semua baris harga, urut sesuai markup asli. */
  prices: CardPrice[];
  buttonLabel: string;
  /** Link rotator tombol WhatsApp kartu; ditulis hanya kalau terisi. */
  waLink?: string | null;
  slug: string | null;
  waMessage: string | null;
  isWhatsappLink: boolean;
  isPromoted: boolean;
};

export type Benefit = { icon: string; title: string; description: string };

export type Testimonial = {
  stars: number;
  quote: string;
  author: string;
  location: string;
};

export type TypeCard = {
  slug: string | null;
  icon: string;
  title: string;
  description: string;
  price: string;
  linkLabel: string;
};

export type ItineraryDayOut = {
  emoji: string;
  label: string;
  title: string;
  items: { time: string; text: string }[];
};

export type FacilityGroupOut = {
  variant: "INCLUDE" | "EXCLUDE";
  title: string;
  items: { icon: string; text: string }[];
};

export type PriceItemOut = { label: string; value: string; unit: string };

export type PricingBlock =
  | {
      kind: "TABLE";
      note: string;
      firstHeader: string;
      columns: { label: string; cssClass: string | null }[];
      rows: {
        label: string;
        cells: { value: string; cssClass: string | null }[];
      }[];
    }
  | {
      kind: "ITEMS";
      note: string;
      firstHeader: string;
      columns: never[];
      rows: never[];
      items: PriceItemOut[];
    };

export type GalleryImageOut = { url: string; alt: string };

export type ScheduleItemOut = {
  day: number;
  month: string;
  year: number;
  description: string;
};

export type SectionMeta = {
  tag: string;
  title: string;
  accent: string;
  suffix: string;
  description: string;
  anchor: string;
  /** Jumlah kolom versi desktop, diambil dari CSS asli halaman. */
  gridColumns?: number;
};

export type Sections = {
  types?: (SectionMeta & { cards: TypeCard[] }) | null;
  packages?: (SectionMeta & { cards: Card[] }) | null;
  benefits?: (SectionMeta & { cards: Benefit[] }) | null;
  testimonials?: (SectionMeta & { cards: Testimonial[] }) | null;
  itinerary?: (SectionMeta & { days: ItineraryDayOut[] }) | null;
  facilities?: (SectionMeta & { groups: FacilityGroupOut[] }) | null;
  pricing?: (SectionMeta & PricingBlock) | null;
  gallery?: (SectionMeta & { images: GalleryImageOut[] }) | null;
};

export type ListingOut = {
  relPath: string;
  hero: Hero;
  cta: CtaBanner | null;
  note: Note | null;
  packagesSection: Sections["packages"];
  benefitsSection: Sections["benefits"];
  typesSection: Sections["types"];
  stats: { num: string; label: string }[];
  testimonialsSection: Sections["testimonials"];
};

export type CategoryOut = {
  key: CategoryKey;
  slug: string;
  /** Path relatif file HTML legacy, untuk audit kemiripan markup. */
  sourceFile: string;
  navLabel: string;
  order: number;
  kind: TripKind;
  duration: string;
  cardIcon: string;
  cardDescription: string;
  cardPrice: string;
  cardLinkLabel: string;
  /** Status tayang; opsional supaya hasil export admin bisa dipulihkan. */
  isPublished?: boolean;
  /** Tampil di navigasi; opsional supaya hasil export admin bisa dipulihkan. */
  showInNav?: boolean;
  /** Gambar kartu kategori, diisi dari galeri lewat editor admin. */
  cardImage?: string | null;
  cardImageAlt?: string | null;
  hero: Hero;
  cta: CtaBanner | null;
  listing: (SectionMeta & { cardVariant: "opentrip" | "default" }) | null;
  note: Note | null;
  benefits: (SectionMeta & { items: Benefit[] }) | null;
  /** Kepala seksi kartu tautan halaman HTML di halaman kategori. */
  pages?: SectionMeta | null;
  /** Isian WhatsApp khusus kategori; kosong = pakai pengaturan global. */
  whatsapp?: {
    number: string;
    greeting: string;
    message: string;
    /** Nomor khusus banner CTA; kosong = nomor tombol hero/global. */
    ctaNumber?: string;
    /** Sapaan khusus banner CTA; kosong = sapaan tombol hero/global. */
    ctaGreeting?: string;
  } | null;
};

export type PackageOut = {
  slug: string;
  categorySlug: string;
  /** Path relatif file HTML legacy. Kosong untuk paket baru dari editor. */
  sourceFile: string;
  kind: TripKind;
  name: string;
  cardVariant: "opentrip" | "default";
  card: Card | null;
  hasDetailPage: boolean;
  isFeatured: boolean;
  showOnHome: boolean;
  /** Urutan & status tayang; opsional supaya hasil export admin bisa dipulihkan. */
  order?: number;
  isPublished?: boolean;
  /** Tombol "lihat selengkapnya" di galeri (legacy: hanya halaman Djawatan). */
  galleryHasMore?: boolean;
  galleryMoreLabel?: string;
  hero: Hero | null;
  cta: CtaBanner | null;
  note: Note | null;
  /** Seksi jadwal keberangkatan; opsional karena hanya paket open trip. */
  schedule?: (SectionMeta & { items: ScheduleItemOut[] }) | null;
  itinerary: Sections["itinerary"];
  facilities: Sections["facilities"];
  pricing: Sections["pricing"];
  gallery: Sections["gallery"];
  waMessage: string;
  /** Isian WhatsApp khusus paket; kosong = pakai pengaturan global. */
  whatsapp?: {
    number: string;
    greeting: string;
    /** Nomor khusus banner CTA; kosong = nomor tombol hero/global. */
    ctaNumber?: string;
    /** Sapaan khusus banner CTA; kosong = sapaan tombol hero/global. */
    ctaGreeting?: string;
  } | null;
};

export type SiteSettingsOut = {
  siteName: string;
  siteUrl: string;
  logoVariant: string;
  waNumber: string;
  /** Pesan WhatsApp otomatis global. Opsional di file lama. */
  waMessage?: string;
  /** Sapaan otomatis global; kosong = tanpa sapaan. */
  waGreeting?: string;
  email: string;
  instagram: string;
  tiktok: string;
  footerText: string;
  footerHeading: string;
  copyrightText: string;
  footerMadeWith: string;
  footerLocation: string;
  footerHeart: string;
  homeHeroBadges: string[];
  homeHeroTitle: string;
  homeHeroAccent: string;
  homeHeroSuffix: string;
  homeHeroText: string;
  homeHeroDecos: string[];
  homeHeroPrimaryLabel: string;
  homeHeroSecondaryLabel: string;
  homeHeroSecondaryAnchor: string;
  homeTypesTag: string;
  homeTypesTitle: string;
  homeTypesAccent: string;
  homeTypesSuffix: string;
  homeTypesDesc: string;
  homeTypesAnchor: string;
  /** Tampilkan seksi pilihan tipe trip; hero & CTA selalu tampil. */
  homeTypesEnabled?: boolean;
  homeGridColumns: number;
  homeFavTag: string;
  homeFavTitle: string;
  homeFavAccent: string;
  homeFavSuffix: string;
  homeFavDesc: string;
  /** Tampilkan seksi paket favorit. */
  homeFavEnabled?: boolean;
  /** Seksi kartu tautan halaman HTML di beranda (di bawah pilihan tipe trip). */
  homePgTag: string;
  homePgTitle: string;
  homePgAccent: string;
  homePgSuffix: string;
  homePgDesc: string;
  homePgAnchor: string;
  /** Tampilkan seksi kartu halaman HTML. */
  homePgEnabled?: boolean;
  homeBenefitsTag: string;
  homeBenefitsTitle: string;
  homeBenefitsAccent: string;
  homeBenefitsSuffix: string;
  homeBenefitsDesc: string;
  /** Tampilkan seksi keunggulan. */
  homeBenefitsEnabled?: boolean;
  homeTestiTag: string;
  homeTestiTitle: string;
  homeTestiAccent: string;
  homeTestiSuffix: string;
  homeTestiDesc: string;
  /** Tampilkan seksi testimoni. */
  homeTestiEnabled?: boolean;
  /** Seksi feed Instagram di beranda (tepat di bawah testimoni). */
  homeIgTag: string;
  homeIgTitle: string;
  homeIgAccent: string;
  homeIgSuffix: string;
  /** Teks di samping logo pada baris brand seksi Instagram. */
  homeIgDesc: string;
  /** Tampilkan seksi feed Instagram. */
  homeIgEnabled?: boolean;
  /** Seksi galeri pengunjung di beranda (fotonya di `ContentFile.homeGallery`). */
  homeGalleryTag?: string;
  homeGalleryTitle?: string;
  homeGalleryAccent?: string;
  homeGallerySuffix?: string;
  homeGalleryDesc?: string;
  homeGalleryAnchor?: string;
  homeGalleryColumns?: number;
  /** Tampilkan seksi galeri pengunjung. */
  homeGalleryEnabled?: boolean;
  ctaTitle: string;
  ctaText: string;
  ctaLabel: string;
  ctaMessage: string;
  /** Nomor WhatsApp khusus banner CTA global; kosong = waNumber. */
  ctaWaNumber?: string;
  /** Sapaan otomatis khusus banner CTA global; kosong = waGreeting. */
  ctaWaGreeting?: string;
  /** Link rotator tombol banner CTA global; ditulis hanya kalau terisi. */
  ctaWaLink?: string;
  /** Latar banner CTA global; opsional, sama seperti `CtaBanner.background`. */
  ctaBackground?: string | null;
  /** Link rotator tombol melayang; ditulis hanya kalau terisi. */
  stickyWaLink?: string;
  /** Label tombol melayang; ditulis hanya kalau berbeda dari bawaan. */
  stickyWaLabel?: string;
  /** Link rotator tombol hero beranda; ditulis hanya kalau terisi. */
  homeHeroWaLink?: string;
  /** Foto latar hero beranda; ditulis hanya kalau terisi. */
  homeHeroImage?: string | null;
  /** Alt foto latar hero beranda; ditulis hanya kalau terisi. */
  homeHeroImageAlt?: string | null;
};

/** Isi file `content/content.json`. */
export type ContentFile = {
  settings: SiteSettingsOut;
  homeStats: { num: string; label: string }[];
  homeBenefits: Benefit[];
  testimonials: Testimonial[];
  /**
   * Foto seksi "Galeri Pengunjung" di beranda. Opsional supaya file konten
   * lama — yang dibuat sebelum fitur ini — tetap valid untuk diimpor.
   */
  homeGallery?: { url: string; alt: string }[];
  categories: CategoryOut[];
  packages: PackageOut[];
  /**
   * Halaman HTML mandiri (`/admin/halaman`). Opsional supaya file konten
   * lama — yang dibuat sebelum fitur ini — tetap valid untuk diimpor.
   */
  pages?: HtmlPageOut[];
  warnings: string[];
};

/** Satu halaman HTML mandiri, dirender apa adanya di `/halaman/<slug>`. */
export type HtmlPageOut = {
  slug: string;
  title: string;
  /** Dokumen HTML apa adanya. */
  html: string;
  /**
   * Isi terstruktur halaman link-bio (scope "sosmed") — lihat `@/lib/bio`.
   * Absen untuk halaman HTML biasa (`scope: "page"`).
   */
  bio?: BioLinkPageData;
  /** Kelompok halaman: "page" (menu Halaman) atau "sosmed" (menu Sosmed). */
  scope?: "page" | "sosmed";
  showOnHome?: boolean;
  /** Slug kategori tempat kartu tampil. Kosong = tidak di kategori mana pun. */
  categorySlugs?: string[];
  cardImage?: string | null;
  /** Label kecil di atas judul kartu. */
  cardTag?: string;
  cardTitle?: string;
  cardDesc?: string;
  /** Teks tombol kartu; kosong = tombol tidak dirender. */
  cardButtonLabel?: string;
  isPublished?: boolean;
  order?: number;
};
