-- Phase L7: a variation order is a quotation of kind VARIATION against a running job.

-- CreateEnum
CREATE TYPE "QuotationKind" AS ENUM ('QUOTATION', 'VARIATION');

-- AlterTable
ALTER TABLE "Quotation" ADD COLUMN     "jobId" TEXT,
ADD COLUMN     "kind" "QuotationKind" NOT NULL DEFAULT 'QUOTATION';

-- CreateIndex
CREATE INDEX "Quotation_jobId_idx" ON "Quotation"("jobId");

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;
