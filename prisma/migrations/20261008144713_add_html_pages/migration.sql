-- CreateTable
CREATE TABLE "HtmlPage" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "showOnHome" BOOLEAN NOT NULL DEFAULT false,
    "showOnCategory" BOOLEAN NOT NULL DEFAULT false,
    "cardImage" TEXT,
    "cardTitle" TEXT NOT NULL DEFAULT '',
    "cardDesc" TEXT NOT NULL DEFAULT '',
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HtmlPage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HtmlPage_slug_key" ON "HtmlPage"("slug");
