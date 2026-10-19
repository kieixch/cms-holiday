-- Tombol on/off tiap seksi beranda (hero & CTA selalu tampil).
ALTER TABLE "SiteSettings" ADD COLUMN "homeTypesEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "homeFavEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "homePgEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "homeBenefitsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "homeIgEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "homeTestiEnabled" BOOLEAN NOT NULL DEFAULT true;
