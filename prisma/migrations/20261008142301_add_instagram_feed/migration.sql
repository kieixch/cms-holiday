-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN     "homeIgAccent" TEXT NOT NULL DEFAULT 'Instagram',
ADD COLUMN     "homeIgDesc" TEXT NOT NULL DEFAULT 'Intip keseruan trip, promo, dan cerita traveler lainnya langsung dari Instagram kami.',
ADD COLUMN     "homeIgSuffix" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "homeIgTag" TEXT NOT NULL DEFAULT 'Instagram',
ADD COLUMN     "homeIgTitle" TEXT NOT NULL DEFAULT 'Follow kami di';

-- CreateTable
CREATE TABLE "InstagramPost" (
    "id" TEXT NOT NULL,
    "igId" TEXT NOT NULL,
    "caption" TEXT NOT NULL DEFAULT '',
    "mediaType" TEXT NOT NULL DEFAULT 'IMAGE',
    "mediaUrl" TEXT,
    "thumbnailUrl" TEXT,
    "permalink" TEXT NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstagramPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InstagramPost_igId_key" ON "InstagramPost"("igId");
