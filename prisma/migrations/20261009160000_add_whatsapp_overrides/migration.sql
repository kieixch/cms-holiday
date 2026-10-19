-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN     "waGreeting" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "waNumber" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "waGreeting" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "waMessage" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Package" ADD COLUMN     "waNumber" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "waGreeting" TEXT NOT NULL DEFAULT '';
