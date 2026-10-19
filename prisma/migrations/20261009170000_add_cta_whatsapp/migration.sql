-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN     "ctaWaNumber" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "ctaWaGreeting" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "ctaWaNumber" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "ctaWaGreeting" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Package" ADD COLUMN     "ctaWaNumber" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "ctaWaGreeting" TEXT NOT NULL DEFAULT '';
