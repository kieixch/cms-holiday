/**
 * Bentuk data paket yang boleh ditulis form admin.
 *
 * Modul ini sengaja terpisah dari `actions.ts` supaya bisa diuji tanpa
 * menjalankan server action. `parseFields()` mengembalikan tepat nama-nama di
 * spec, jadi daftar di bawah adalah satu-satunya penjaga antara
 * `package-fields.ts` dan Prisma — kalau keduanya tidak sinkron, akibatnya
 * "Unknown argument" dari Prisma atau, lebih buruk, kolom yang diam-diam
 * dibuang.
 *
 * Kolom yang masuk daftar belum tentu tampil di halaman publik. Lihat catatan
 * di `package-fields.ts` untuk kolom yang sengaja dibiarkan di luar form.
 */

/** Relasi Package yang ditulis ulang penuh oleh action, bukan lewat spread. */
export const PACKAGE_RELATIONS = [
  "cardDays",
  "cardPrices",
  "cardFacilities",
  "schedule",
  "itinerary",
  "facilities",
  "notes",
  "gallery",
] as const;

/**
 * Kolom skalar `Package` yang boleh masuk form paket.
 *
 * Disalin dari `prisma/schema.prisma` model `Package`. Tidak termasuk `id`,
 * `slug`, `name`, `categoryId`, `kind`, `createdAt`, `updatedAt` — enam kolom
 * itu disusun action sendiri.
 */
export const PACKAGE_SCALARS = [
  // Status
  "isPublished",
  "hasDetailPage",
  "isFeatured",
  "showOnHome",
  "order",
  // Kartu
  "cardImage",
  "cardImageAlt",
  "cardLoc",
  "cardHomeLoc",
  "cardTag",
  "cardRating",
  "cardHighlight",
  "cardPriceLabel",
  "cardPriceValue",
  "cardPriceUnit",
  "cardButtonLabel",
  "cardWaLink",
  "cardLinkMode",
  "cardVariant",
  // Hero & CTA
  "heroBadges",
  "heroTitle",
  "heroAccent",
  "heroSuffix",
  "heroDescription",
  "heroDecos",
  "heroImage",
  "heroImageAlt",
  "heroWaLink",
  "ctaPrimaryLabel",
  "ctaSecondaryLabel",
  "ctaSecondaryAnchor",
  "ctaTitle",
  "ctaText",
  "ctaLabel",
  "ctaMessage",
  "ctaWaNumber",
  "ctaWaGreeting",
  "ctaWaLink",
  "ctaBackground",
  "waMessage",
  "waNumber",
  "waGreeting",
  // Seksi
  "jadwalTag",
  "jadwalTitle",
  "jadwalAccent",
  "jadwalSuffix",
  "jadwalDescription",
  "jadwalAnchor",
  "itineraryTag",
  "itineraryTitle",
  "itineraryAccent",
  "itinerarySuffix",
  "itineraryDescription",
  "itineraryAnchor",
  "itineraryColumns",
  "facilityTag",
  "facilityTitle",
  "facilityAccent",
  "facilitySuffix",
  "facilityDescription",
  "pricingTag",
  "pricingTitle",
  "pricingAccent",
  "pricingSuffix",
  "pricingDescription",
  "galleryTag",
  "galleryTitle",
  "galleryAccent",
  "gallerySuffix",
  "galleryDescription",
  "galleryColumns",
] as const;

/** Kolom yang disusun action sendiri, bukan dari form. */
export const PACKAGE_DERIVED = ["slug", "name"] as const;