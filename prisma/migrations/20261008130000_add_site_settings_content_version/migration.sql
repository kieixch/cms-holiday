-- Penanda versi konten global untuk auto-refresh halaman publik.
ALTER TABLE "SiteSettings" ADD COLUMN "contentVersion" INTEGER NOT NULL DEFAULT 0;