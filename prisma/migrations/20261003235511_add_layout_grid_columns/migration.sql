-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "gridColumns" INTEGER NOT NULL DEFAULT 3,
ALTER COLUMN "ctaPrimaryLabel" SET DEFAULT '💬 Tanya via WhatsApp',
ALTER COLUMN "ctaSecondaryLabel" SET DEFAULT '📦 Lihat Pilihan Paket',
ALTER COLUMN "ctaLabel" SET DEFAULT '💬 Chat & Booking Sekarang';

-- AlterTable
ALTER TABLE "ItineraryDay" ALTER COLUMN "emoji" SET DEFAULT '🌴';

-- AlterTable
ALTER TABLE "Package" ADD COLUMN     "galleryColumns" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "itineraryColumns" INTEGER NOT NULL DEFAULT 1,
ALTER COLUMN "ctaPrimaryLabel" SET DEFAULT '💬 Booking via WhatsApp',
ALTER COLUMN "ctaSecondaryLabel" SET DEFAULT '📋 Lihat Itinerary',
ALTER COLUMN "ctaLabel" SET DEFAULT '💬 Chat & Booking Sekarang';

-- AlterTable
ALTER TABLE "PackageNote" ALTER COLUMN "icon" SET DEFAULT 'ℹ️';

-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN     "homeGridColumns" INTEGER NOT NULL DEFAULT 3,
ALTER COLUMN "footerHeading" SET DEFAULT 'Yuk, Mulai Petualanganmu! 🌴',
ALTER COLUMN "copyrightText" SET DEFAULT '© 2026 Holiday Banyuwangi. All Rights Reserved.',
ALTER COLUMN "footerHeart" SET DEFAULT '🌴',
ALTER COLUMN "homeHeroPrimaryLabel" SET DEFAULT '💬 Tanya via WhatsApp',
ALTER COLUMN "homeHeroSecondaryLabel" SET DEFAULT '📦 Lihat Pilihan Trip',
ALTER COLUMN "ctaTitle" SET DEFAULT 'Yuk, Rencanakan Liburanmu ke Banyuwangi! 🌴🔥',
ALTER COLUMN "ctaLabel" SET DEFAULT '💬 Chat & Konsultasi Sekarang';
