-- AlterTable
ALTER TABLE "HtmlPage" ADD COLUMN "categorySlugs" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Data migration: nilai lama "tampil di semua kategori" diterjemahkan ke
-- daftar semua kategori yang ada saat migrasi dijalankan.
UPDATE "HtmlPage"
SET "categorySlugs" = COALESCE(
  (SELECT ARRAY_AGG("slug" ORDER BY "order") FROM "Category"),
  ARRAY[]::TEXT[]
)
WHERE "showOnCategory" = true;

-- AlterTable
ALTER TABLE "HtmlPage" DROP COLUMN "showOnCategory";