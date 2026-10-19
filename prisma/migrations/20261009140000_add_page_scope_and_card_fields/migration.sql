-- AlterTable
ALTER TABLE "HtmlPage" ADD COLUMN "scope" TEXT NOT NULL DEFAULT 'page';
ALTER TABLE "HtmlPage" ADD COLUMN "cardTag" TEXT NOT NULL DEFAULT '';
ALTER TABLE "HtmlPage" ADD COLUMN "cardButtonLabel" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN "homePgTag" TEXT NOT NULL DEFAULT 'Info & Panduan';
ALTER TABLE "SiteSettings" ADD COLUMN "homePgTitle" TEXT NOT NULL DEFAULT 'Halaman';
ALTER TABLE "SiteSettings" ADD COLUMN "homePgAccent" TEXT NOT NULL DEFAULT 'Penting';
ALTER TABLE "SiteSettings" ADD COLUMN "homePgSuffix" TEXT NOT NULL DEFAULT '';
ALTER TABLE "SiteSettings" ADD COLUMN "homePgDesc" TEXT NOT NULL DEFAULT '';
ALTER TABLE "SiteSettings" ADD COLUMN "homePgAnchor" TEXT NOT NULL DEFAULT 'halaman';
