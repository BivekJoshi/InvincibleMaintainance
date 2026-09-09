-- CreateEnum
CREATE TYPE "SurveyStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'RETURNED', 'QUOTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SurveyItemKind" AS ENUM ('LABOUR', 'MATERIAL', 'SERVICE', 'OTHER');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'SURVEYOR';

-- CreateTable
CREATE TABLE "SiteSurvey" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "leadId" TEXT,
    "customerId" TEXT NOT NULL,
    "siteId" TEXT,
    "serviceId" TEXT,
    "surveyorId" TEXT,
    "status" "SurveyStatus" NOT NULL DEFAULT 'DRAFT',
    "problemSummary" TEXT,
    "diagnosis" TEXT,
    "recommendation" TEXT,
    "accessNotes" TEXT,
    "riskNotes" TEXT,
    "areaValue" DOUBLE PRECISION,
    "areaUnit" TEXT,
    "estimatedDays" DOUBLE PRECISION,
    "urgency" "Priority" NOT NULL DEFAULT 'NORMAL',
    "submittedAt" TIMESTAMP(3),
    "submittedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewNote" TEXT,
    "returnedReason" TEXT,
    "quotationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SiteSurvey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyReading" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "value" DOUBLE PRECISION,
    "unit" TEXT,
    "textValue" TEXT,
    "location" TEXT,
    "mediaId" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SurveyReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyItem" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "kind" "SurveyItemKind" NOT NULL DEFAULT 'MATERIAL',
    "materialId" TEXT,
    "rateCardItemId" TEXT,
    "serviceId" TEXT,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,
    "wastagePct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SurveyItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SiteSurvey_number_key" ON "SiteSurvey"("number");

-- CreateIndex
CREATE UNIQUE INDEX "SiteSurvey_jobId_key" ON "SiteSurvey"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "SiteSurvey_quotationId_key" ON "SiteSurvey"("quotationId");

-- CreateIndex
CREATE INDEX "SiteSurvey_status_submittedAt_idx" ON "SiteSurvey"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "SiteSurvey_surveyorId_status_idx" ON "SiteSurvey"("surveyorId", "status");

-- CreateIndex
CREATE INDEX "SiteSurvey_customerId_idx" ON "SiteSurvey"("customerId");

-- CreateIndex
CREATE INDEX "SiteSurvey_deletedAt_idx" ON "SiteSurvey"("deletedAt");

-- CreateIndex
CREATE INDEX "SurveyReading_surveyId_sortOrder_idx" ON "SurveyReading"("surveyId", "sortOrder");

-- CreateIndex
CREATE INDEX "SurveyItem_surveyId_sortOrder_idx" ON "SurveyItem"("surveyId", "sortOrder");

-- CreateIndex
CREATE INDEX "SurveyItem_materialId_idx" ON "SurveyItem"("materialId");

-- CreateIndex
CREATE INDEX "SurveyItem_rateCardItemId_idx" ON "SurveyItem"("rateCardItemId");

-- AddForeignKey
ALTER TABLE "SiteSurvey" ADD CONSTRAINT "SiteSurvey_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteSurvey" ADD CONSTRAINT "SiteSurvey_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteSurvey" ADD CONSTRAINT "SiteSurvey_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteSurvey" ADD CONSTRAINT "SiteSurvey_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "CustomerSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteSurvey" ADD CONSTRAINT "SiteSurvey_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteSurvey" ADD CONSTRAINT "SiteSurvey_surveyorId_fkey" FOREIGN KEY ("surveyorId") REFERENCES "Technician"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteSurvey" ADD CONSTRAINT "SiteSurvey_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteSurvey" ADD CONSTRAINT "SiteSurvey_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteSurvey" ADD CONSTRAINT "SiteSurvey_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyReading" ADD CONSTRAINT "SurveyReading_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "SiteSurvey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyItem" ADD CONSTRAINT "SurveyItem_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "SiteSurvey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyItem" ADD CONSTRAINT "SurveyItem_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyItem" ADD CONSTRAINT "SurveyItem_rateCardItemId_fkey" FOREIGN KEY ("rateCardItemId") REFERENCES "RateCardItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyItem" ADD CONSTRAINT "SurveyItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;
