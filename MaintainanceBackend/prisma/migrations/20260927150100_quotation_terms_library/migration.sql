-- Phase L4: the terms library — reusable quotation terms, one of them the default.

-- CreateTable
CREATE TABLE "QuotationTerms" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "bodyNe" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "QuotationTerms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuotationTerms_isActive_sortOrder_idx" ON "QuotationTerms"("isActive", "sortOrder");
