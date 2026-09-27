-- Phase L4: a quotation's contract type (L-D2), duration, exclusions, the customer view's options, view
-- tracking, a decline category, its stored cost total (costs:read), and its payment schedule (L-D3).

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('LUMP_SUM', 'ITEM_RATE');

-- CreateEnum
CREATE TYPE "PaymentTrigger" AS ENUM ('ON_ACCEPT', 'MILESTONE', 'ON_COMPLETION');

-- AlterTable
ALTER TABLE "Quotation" ADD COLUMN     "contractType" "ContractType" NOT NULL DEFAULT 'LUMP_SUM',
ADD COLUMN     "costComplete" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "costTotal" INTEGER,
ADD COLUMN     "declineCategory" "LostCategory",
ADD COLUMN     "estimatedDays" DOUBLE PRECISION,
ADD COLUMN     "exclusions" TEXT,
ADD COLUMN     "firstViewedAt" TIMESTAMP(3),
ADD COLUMN     "showMeasurements" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "summaryOnly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "viewCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "QuotationPaymentStage" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "basisPoints" INTEGER NOT NULL,
    "trigger" "PaymentTrigger" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "QuotationPaymentStage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuotationPaymentStage_quotationId_sortOrder_idx" ON "QuotationPaymentStage"("quotationId", "sortOrder");

-- AddForeignKey
ALTER TABLE "QuotationPaymentStage" ADD CONSTRAINT "QuotationPaymentStage_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
