-- AlterTable
ALTER TABLE "Package" ADD COLUMN     "jadwalAccent" TEXT NOT NULL DEFAULT 'Keberangkatan',
ADD COLUMN     "jadwalAnchor" TEXT NOT NULL DEFAULT 'jadwal',
ADD COLUMN     "jadwalDescription" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "jadwalSuffix" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "jadwalTag" TEXT NOT NULL DEFAULT 'Jadwal',
ADD COLUMN     "jadwalTitle" TEXT NOT NULL DEFAULT 'Jadwal';
