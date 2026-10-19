-- AlterTable
ALTER TABLE "MediaAsset" ADD COLUMN     "derivedFromId" TEXT;

-- CreateIndex
CREATE INDEX "MediaAsset_derivedFromId_idx" ON "MediaAsset"("derivedFromId");

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_derivedFromId_fkey" FOREIGN KEY ("derivedFromId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
