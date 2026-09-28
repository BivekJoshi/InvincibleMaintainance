-- Phase L6 (L-D3): invoices by kind, a stage billed once, and the advance a job waits for — with its override.

-- CreateEnum
CREATE TYPE "InvoiceKind" AS ENUM ('STANDARD', 'ADVANCE', 'RUNNING', 'FINAL');

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "jobId" TEXT,
ADD COLUMN     "kind" "InvoiceKind" NOT NULL DEFAULT 'STANDARD',
ADD COLUMN     "paymentStageId" TEXT;

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "advanceInvoiceId" TEXT,
ADD COLUMN     "advanceOverriddenAt" TIMESTAMP(3),
ADD COLUMN     "advanceOverrideById" TEXT,
ADD COLUMN     "advanceOverrideReason" TEXT;

-- CreateIndex: a payment stage is billed once.
CREATE UNIQUE INDEX "Invoice_paymentStageId_key" ON "Invoice"("paymentStageId");

-- CreateIndex
CREATE INDEX "Invoice_jobId_idx" ON "Invoice"("jobId");

-- CreateIndex: a job has one advance.
CREATE UNIQUE INDEX "Job_advanceInvoiceId_key" ON "Job"("advanceInvoiceId");

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_advanceInvoiceId_fkey" FOREIGN KEY ("advanceInvoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_advanceOverrideById_fkey" FOREIGN KEY ("advanceOverrideById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_paymentStageId_fkey" FOREIGN KEY ("paymentStageId") REFERENCES "QuotationPaymentStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
