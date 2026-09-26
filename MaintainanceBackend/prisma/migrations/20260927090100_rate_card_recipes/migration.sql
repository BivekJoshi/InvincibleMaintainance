-- Phase L2 (L-D1): a rate-library item's recipe — what one unit of work needs — and how its rate is set.
-- Every existing item stays MANUAL with no recipe: its rate is what it was.

-- CreateEnum
CREATE TYPE "RateMode" AS ENUM ('MANUAL', 'DERIVED');

-- CreateEnum
CREATE TYPE "RecipeComponentKind" AS ENUM ('MATERIAL', 'LABOUR', 'EQUIPMENT', 'OTHER');

-- AlterTable
ALTER TABLE "RateCardItem" ADD COLUMN     "overheadPct" DOUBLE PRECISION,
ADD COLUMN     "profitPct" DOUBLE PRECISION,
ADD COLUMN     "rateMode" "RateMode" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "recipeQty" DOUBLE PRECISION NOT NULL DEFAULT 1,
ADD COLUMN     "roundTo" INTEGER,
ADD COLUMN     "unitCost" INTEGER;

-- CreateTable
CREATE TABLE "RateCardComponent" (
    "id" TEXT NOT NULL,
    "rateCardItemId" TEXT NOT NULL,
    "kind" "RecipeComponentKind" NOT NULL,
    "materialId" TEXT,
    "tradeId" TEXT,
    "description" TEXT,
    "unit" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,
    "wastagePct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cost" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RateCardComponent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RateCardComponent_rateCardItemId_sortOrder_idx" ON "RateCardComponent"("rateCardItemId", "sortOrder");

-- CreateIndex
CREATE INDEX "RateCardComponent_materialId_idx" ON "RateCardComponent"("materialId");

-- CreateIndex
CREATE INDEX "RateCardComponent_tradeId_idx" ON "RateCardComponent"("tradeId");

-- AddForeignKey
ALTER TABLE "RateCardComponent" ADD CONSTRAINT "RateCardComponent_rateCardItemId_fkey" FOREIGN KEY ("rateCardItemId") REFERENCES "RateCardItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateCardComponent" ADD CONSTRAINT "RateCardComponent_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateCardComponent" ADD CONSTRAINT "RateCardComponent_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
