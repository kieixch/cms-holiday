-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TripKind" AS ENUM ('OPEN_TRIP', 'PRIVATE');

-- CreateEnum
CREATE TYPE "PricingKind" AS ENUM ('TABLE', 'ITEMS');

-- CreateEnum
CREATE TYPE "FacilityVariant" AS ENUM ('INCLUDE', 'EXCLUDE');

-- CreateTable
CREATE TABLE "SiteSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "siteName" TEXT NOT NULL DEFAULT 'Holiday Banyuwangi',
    "siteUrl" TEXT NOT NULL DEFAULT 'https://holidaybanyuwangi.com',
    "logoVariant" TEXT NOT NULL DEFAULT 'svg',
    "waNumber" TEXT NOT NULL DEFAULT '628133111543',
    "waMessage" TEXT NOT NULL DEFAULT 'Hai Holiday Banyuwangi, aku mau tanya paket trip',
    "email" TEXT NOT NULL DEFAULT 'banyuwangiholliday@gmail.com',
    "instagram" TEXT NOT NULL DEFAULT 'https://www.instagram.com/holiday.banyuwangi/',
    "tiktok" TEXT NOT NULL DEFAULT 'https://www.tiktok.com/@holiday.banyuwangi_',
    "footerText" TEXT NOT NULL DEFAULT 'Follow & DM kami buat info trip terbaru, promo seru, dan keseruan lainnya seputar Banyuwangi.',
    "footerHeading" TEXT NOT NULL DEFAULT 'Yuk, Mulai Petualanganmu! ðŸŒ´',
    "copyrightText" TEXT NOT NULL DEFAULT 'Â© 2026 Holiday Banyuwangi. All Rights Reserved.',
    "footerMadeWith" TEXT NOT NULL DEFAULT 'Made with',
    "footerLocation" TEXT NOT NULL DEFAULT 'in Banyuwangi',
    "footerHeart" TEXT NOT NULL DEFAULT 'ðŸŒ´',
    "homeHeroBadges" TEXT[],
    "homeHeroTitle" TEXT NOT NULL DEFAULT 'Jelajahi Keindahan',
    "homeHeroAccent" TEXT NOT NULL DEFAULT 'Banyuwangi',
    "homeHeroSuffix" TEXT NOT NULL DEFAULT 'Bareng Kami!',
    "homeHeroText" TEXT NOT NULL DEFAULT '',
    "homeHeroDecos" TEXT[],
    "homeHeroPrimaryLabel" TEXT NOT NULL DEFAULT 'ðŸ’¬ Tanya via WhatsApp',
    "homeHeroSecondaryLabel" TEXT NOT NULL DEFAULT 'ðŸ“¦ Lihat Pilihan Trip',
    "homeHeroSecondaryAnchor" TEXT NOT NULL DEFAULT '#tipe-trip',
    "homeTypesTag" TEXT NOT NULL DEFAULT 'Pilihan Trip',
    "homeTypesTitle" TEXT NOT NULL DEFAULT 'Mau Liburan yang',
    "homeTypesAccent" TEXT NOT NULL DEFAULT 'Mana',
    "homeTypesSuffix" TEXT NOT NULL DEFAULT 'Hari Ini?',
    "homeTypesDesc" TEXT NOT NULL DEFAULT '',
    "homeTypesAnchor" TEXT NOT NULL DEFAULT 'tipe-trip',
    "homeFavTag" TEXT NOT NULL DEFAULT 'Paling Laris',
    "homeFavTitle" TEXT NOT NULL DEFAULT 'Paket',
    "homeFavAccent" TEXT NOT NULL DEFAULT 'Favorit',
    "homeFavSuffix" TEXT NOT NULL DEFAULT 'Traveler',
    "homeFavDesc" TEXT NOT NULL DEFAULT '',
    "homeBenefitsTag" TEXT NOT NULL DEFAULT 'Keunggulan',
    "homeBenefitsTitle" TEXT NOT NULL DEFAULT 'Kenapa Pilih',
    "homeBenefitsAccent" TEXT NOT NULL DEFAULT 'Holiday Banyuwangi?',
    "homeBenefitsSuffix" TEXT NOT NULL DEFAULT '',
    "homeBenefitsDesc" TEXT NOT NULL DEFAULT '',
    "homeTestiTag" TEXT NOT NULL DEFAULT 'Testimoni',
    "homeTestiTitle" TEXT NOT NULL DEFAULT 'Apa Kata',
    "homeTestiAccent" TEXT NOT NULL DEFAULT 'Mereka?',
    "homeTestiSuffix" TEXT NOT NULL DEFAULT '',
    "homeTestiDesc" TEXT NOT NULL DEFAULT '',
    "ctaTitle" TEXT NOT NULL DEFAULT 'Yuk, Rencanakan Liburanmu ke Banyuwangi! ðŸŒ´ðŸ”¥',
    "ctaText" TEXT NOT NULL DEFAULT 'Chat kami sekarang buat rekomendasi paket sesuai waktu & budget kamu!',
    "ctaLabel" TEXT NOT NULL DEFAULT 'ðŸ’¬ Chat & Konsultasi Sekarang',
    "ctaMessage" TEXT NOT NULL DEFAULT 'Hai Holiday Banyuwangi, aku mau tanya rekomendasi paket trip',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeStat" (
    "id" TEXT NOT NULL,
    "num" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "HomeStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Testimonial" (
    "id" TEXT NOT NULL,
    "stars" INTEGER NOT NULL DEFAULT 5,
    "quote" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Testimonial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "navLabel" TEXT NOT NULL,
    "kind" "TripKind" NOT NULL,
    "duration" TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL DEFAULT 0,
    "showInNav" BOOLEAN NOT NULL DEFAULT true,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "heroBadges" TEXT[],
    "heroTitle" TEXT NOT NULL,
    "heroAccent" TEXT NOT NULL DEFAULT '',
    "heroSuffix" TEXT NOT NULL DEFAULT '',
    "heroDescription" TEXT NOT NULL,
    "heroDecos" TEXT[],
    "ctaPrimaryLabel" TEXT NOT NULL DEFAULT 'ðŸ’¬ Tanya via WhatsApp',
    "ctaSecondaryLabel" TEXT NOT NULL DEFAULT 'ðŸ“¦ Lihat Pilihan Paket',
    "ctaSecondaryAnchor" TEXT NOT NULL DEFAULT '#paket',
    "ctaTitle" TEXT NOT NULL DEFAULT '',
    "ctaText" TEXT NOT NULL DEFAULT '',
    "ctaLabel" TEXT NOT NULL DEFAULT 'ðŸ’¬ Chat & Booking Sekarang',
    "ctaMessage" TEXT NOT NULL DEFAULT '',
    "listingTag" TEXT NOT NULL DEFAULT 'Pilihan Paket',
    "listingTitle" TEXT NOT NULL DEFAULT 'Pilih',
    "listingAccent" TEXT NOT NULL DEFAULT 'Itinerary',
    "listingSuffix" TEXT NOT NULL DEFAULT 'Favoritmu',
    "listingDescription" TEXT NOT NULL,
    "listingAnchor" TEXT NOT NULL DEFAULT 'paket',
    "listingNoteIcon" TEXT,
    "listingNoteText" TEXT,
    "benefitsTag" TEXT NOT NULL DEFAULT '',
    "benefitsTitle" TEXT NOT NULL DEFAULT '',
    "benefitsAccent" TEXT NOT NULL DEFAULT '',
    "benefitsSuffix" TEXT NOT NULL DEFAULT '',
    "benefitsDescription" TEXT NOT NULL DEFAULT '',
    "cardIcon" TEXT NOT NULL DEFAULT '',
    "cardDescription" TEXT NOT NULL DEFAULT '',
    "cardPrice" TEXT NOT NULL DEFAULT '',
    "cardLinkLabel" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Benefit" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT,
    "isHomepage" BOOLEAN NOT NULL DEFAULT false,
    "icon" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Benefit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Package" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "kind" "TripKind" NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "hasDetailPage" BOOLEAN NOT NULL DEFAULT true,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "showOnHome" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "cardImage" TEXT,
    "cardImageAlt" TEXT,
    "cardLoc" TEXT,
    "cardTag" TEXT,
    "cardRating" TEXT,
    "cardHighlight" TEXT,
    "cardPriceLabel" TEXT,
    "cardPriceValue" TEXT,
    "cardPriceUnit" TEXT,
    "cardButtonLabel" TEXT,
    "cardLinkMode" TEXT NOT NULL DEFAULT 'detail',
    "cardVariant" TEXT NOT NULL DEFAULT 'default',
    "heroBadges" TEXT[],
    "heroTitle" TEXT NOT NULL,
    "heroAccent" TEXT NOT NULL DEFAULT '',
    "heroSuffix" TEXT NOT NULL DEFAULT '',
    "heroDescription" TEXT NOT NULL,
    "heroDecos" TEXT[],
    "ctaPrimaryLabel" TEXT NOT NULL DEFAULT 'ðŸ’¬ Booking via WhatsApp',
    "ctaSecondaryLabel" TEXT NOT NULL DEFAULT 'ðŸ“‹ Lihat Itinerary',
    "ctaSecondaryAnchor" TEXT NOT NULL DEFAULT '#itinerary',
    "ctaTitle" TEXT NOT NULL DEFAULT '',
    "ctaText" TEXT NOT NULL DEFAULT '',
    "ctaLabel" TEXT NOT NULL DEFAULT 'ðŸ’¬ Chat & Booking Sekarang',
    "ctaMessage" TEXT NOT NULL DEFAULT '',
    "waMessage" TEXT NOT NULL DEFAULT '',
    "itineraryTag" TEXT NOT NULL DEFAULT 'Itinerary',
    "itineraryTitle" TEXT NOT NULL DEFAULT 'Day by Day,',
    "itineraryAccent" TEXT NOT NULL DEFAULT 'No Boring Moments',
    "itinerarySuffix" TEXT NOT NULL DEFAULT '',
    "itineraryDescription" TEXT NOT NULL DEFAULT '',
    "itineraryAnchor" TEXT NOT NULL DEFAULT 'itinerary',
    "facilityTag" TEXT NOT NULL DEFAULT 'Fasilitas',
    "facilityTitle" TEXT NOT NULL DEFAULT 'Udah Termasuk',
    "facilityAccent" TEXT NOT NULL DEFAULT 'Apa Aja?',
    "facilitySuffix" TEXT NOT NULL DEFAULT '',
    "facilityDescription" TEXT NOT NULL DEFAULT '',
    "pricingTag" TEXT NOT NULL DEFAULT 'Harga Paket',
    "pricingTitle" TEXT NOT NULL DEFAULT 'Pilih Sesuai',
    "pricingAccent" TEXT NOT NULL DEFAULT 'Jumlah Squad',
    "pricingSuffix" TEXT NOT NULL DEFAULT '',
    "pricingDescription" TEXT NOT NULL DEFAULT '',
    "galleryTag" TEXT NOT NULL DEFAULT 'Galeri',
    "galleryTitle" TEXT NOT NULL DEFAULT 'Intip',
    "galleryAccent" TEXT NOT NULL DEFAULT 'Keseruannya',
    "gallerySuffix" TEXT NOT NULL DEFAULT '',
    "galleryDescription" TEXT NOT NULL DEFAULT '',
    "galleryHasMore" BOOLEAN NOT NULL DEFAULT false,
    "galleryMoreLabel" TEXT NOT NULL DEFAULT 'Lihat Selengkapnya',
    "images" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Package_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardDay" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CardDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacilityPill" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FacilityPill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItineraryDay" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL DEFAULT 'ðŸŒ´',
    "label" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ItineraryDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimelineItem" (
    "id" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TimelineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacilityGroup" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "variant" "FacilityVariant" NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FacilityGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacilityItem" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FacilityItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pricing" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "kind" "PricingKind" NOT NULL DEFAULT 'TABLE',
    "note" TEXT,
    "rowHeaderLabel" TEXT,

    CONSTRAINT "Pricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceColumn" (
    "id" TEXT NOT NULL,
    "pricingId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "cssClass" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PriceColumn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceRow" (
    "id" TEXT NOT NULL,
    "pricingId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PriceRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceValue" (
    "id" TEXT NOT NULL,
    "rowId" TEXT NOT NULL,
    "columnId" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "PriceValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceItem" (
    "id" TEXT NOT NULL,
    "pricingId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "unit" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PriceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GalleryImage" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "alt" TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GalleryImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageNote" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'â„¹ï¸',
    "text" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PackageNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "alt" TEXT NOT NULL DEFAULT '',
    "folder" TEXT NOT NULL DEFAULT 'uploads',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Package_slug_key" ON "Package"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Pricing_packageId_key" ON "Pricing"("packageId");

-- CreateIndex
CREATE UNIQUE INDEX "PriceValue_rowId_columnId_key" ON "PriceValue"("rowId", "columnId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- AddForeignKey
ALTER TABLE "Benefit" ADD CONSTRAINT "Benefit_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Package" ADD CONSTRAINT "Package_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardDay" ADD CONSTRAINT "CardDay_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilityPill" ADD CONSTRAINT "FacilityPill_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItineraryDay" ADD CONSTRAINT "ItineraryDay_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineItem" ADD CONSTRAINT "TimelineItem_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "ItineraryDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilityGroup" ADD CONSTRAINT "FacilityGroup_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilityItem" ADD CONSTRAINT "FacilityItem_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "FacilityGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pricing" ADD CONSTRAINT "Pricing_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceColumn" ADD CONSTRAINT "PriceColumn_pricingId_fkey" FOREIGN KEY ("pricingId") REFERENCES "Pricing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceRow" ADD CONSTRAINT "PriceRow_pricingId_fkey" FOREIGN KEY ("pricingId") REFERENCES "Pricing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceValue" ADD CONSTRAINT "PriceValue_rowId_fkey" FOREIGN KEY ("rowId") REFERENCES "PriceRow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceValue" ADD CONSTRAINT "PriceValue_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "PriceColumn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceItem" ADD CONSTRAINT "PriceItem_pricingId_fkey" FOREIGN KEY ("pricingId") REFERENCES "Pricing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GalleryImage" ADD CONSTRAINT "GalleryImage_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageNote" ADD CONSTRAINT "PackageNote_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;
