-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN     "homeGalleryAccent" TEXT NOT NULL DEFAULT 'Pengunjung',
ADD COLUMN     "homeGalleryAnchor" TEXT NOT NULL DEFAULT 'galeri',
ADD COLUMN     "homeGalleryColumns" INTEGER NOT NULL DEFAULT 4,
ADD COLUMN     "homeGalleryDesc" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "homeGalleryEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "homeGallerySuffix" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "homeGalleryTag" TEXT NOT NULL DEFAULT 'Galeri',
ADD COLUMN     "homeGalleryTitle" TEXT NOT NULL DEFAULT 'Momen';

-- CreateTable
CREATE TABLE "HomeGalleryImage" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "alt" TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "HomeGalleryImage_pkey" PRIMARY KEY ("id")
);
