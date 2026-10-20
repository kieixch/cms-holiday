-- AlterTable
-- integer -> text butuh USING eksplisit (PostgreSQL tidak meng-cast otomatis).
ALTER TABLE "PackageSchedule" ALTER COLUMN "day" SET DATA TYPE TEXT USING "day"::TEXT,
ALTER COLUMN "year" SET DATA TYPE TEXT USING "year"::TEXT;
