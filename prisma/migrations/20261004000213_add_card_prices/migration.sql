-- CreateTable
CREATE TABLE "CardPrice" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "unit" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CardPrice_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CardPrice" ADD CONSTRAINT "CardPrice_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;
