-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "ctaWaLink" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "heroWaLink" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Package" ADD COLUMN     "cardWaLink" TEXT,
ADD COLUMN     "ctaWaLink" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "heroWaLink" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN     "ctaWaLink" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "homeHeroWaLink" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "stickyWaLabel" TEXT NOT NULL DEFAULT 'Chat Sekarang',
ADD COLUMN     "stickyWaLink" TEXT NOT NULL DEFAULT '';
