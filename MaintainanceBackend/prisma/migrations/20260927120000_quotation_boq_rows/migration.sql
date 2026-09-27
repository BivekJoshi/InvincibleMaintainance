-- Phase L3: a quotation is a bill of quantities — ordered ITEM / SECTION / NOTE rows with measurements,
-- wastage, optional and provisional flags, a frozen recipe and (costs:read only) its cost.

-- CreateEnum
CREATE TYPE "QuotationRowType" AS ENUM ('ITEM', 'SECTION', 'NOTE');

-- AlterTable
ALTER TABLE "QuotationItem" ADD COLUMN     "costAmount" INTEGER,
ADD COLUMN     "isOptional" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isProvisional" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "kind" "SurveyItemKind",
ADD COLUMN     "materialId" TEXT,
ADD COLUMN     "measurements" JSONB,
ADD COLUMN     "netQty" DOUBLE PRECISION,
ADD COLUMN     "recipe" JSONB,
ADD COLUMN     "rowType" "QuotationRowType" NOT NULL DEFAULT 'ITEM',
ADD COLUMN     "spec" TEXT,
ADD COLUMN     "unitCost" INTEGER,
ADD COLUMN     "wastagePct" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "QuotationItem" ADD CONSTRAINT "QuotationItem_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;
