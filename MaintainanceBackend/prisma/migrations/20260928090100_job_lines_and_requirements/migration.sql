-- Phase L6: the job carries the plan — its BOQ lines from the accepted quotation and what they need.

-- CreateEnum
CREATE TYPE "JobLineSource" AS ENUM ('QUOTATION', 'VARIATION');

-- CreateEnum
CREATE TYPE "JobRequirementKind" AS ENUM ('MATERIAL', 'LABOUR');

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "plannedDays" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "JobLine" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "source" "JobLineSource" NOT NULL DEFAULT 'QUOTATION',
    "quotationItemId" TEXT,
    "number" TEXT,
    "section" TEXT,
    "kind" "SurveyItemKind",
    "description" TEXT NOT NULL,
    "unit" TEXT,
    "quotedQty" DOUBLE PRECISION NOT NULL,
    "rate" INTEGER NOT NULL,
    "measurements" JSONB,
    "measuredQty" DOUBLE PRECISION,
    "progressPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isProvisional" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobRequirement" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "kind" "JobRequirementKind" NOT NULL,
    "materialId" TEXT,
    "tradeId" TEXT,
    "description" TEXT NOT NULL,
    "unit" TEXT,
    "qty" DOUBLE PRECISION NOT NULL,
    "packs" INTEGER,
    "source" "JobLineSource" NOT NULL DEFAULT 'QUOTATION',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobLine_jobId_sortOrder_idx" ON "JobLine"("jobId", "sortOrder");

-- CreateIndex: one job line per quotation row — the hand-off cannot copy a row twice.
CREATE UNIQUE INDEX "JobLine_jobId_quotationItemId_key" ON "JobLine"("jobId", "quotationItemId");

-- CreateIndex
CREATE INDEX "JobRequirement_jobId_kind_idx" ON "JobRequirement"("jobId", "kind");

-- AddForeignKey
ALTER TABLE "JobLine" ADD CONSTRAINT "JobLine_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobRequirement" ADD CONSTRAINT "JobRequirement_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobRequirement" ADD CONSTRAINT "JobRequirement_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobRequirement" ADD CONSTRAINT "JobRequirement_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE SET NULL ON UPDATE CASCADE;
