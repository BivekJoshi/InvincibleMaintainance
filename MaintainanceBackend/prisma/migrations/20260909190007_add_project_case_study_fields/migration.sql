-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "costBandMax" INTEGER,
ADD COLUMN     "costBandMin" INTEGER,
ADD COLUMN     "durationDays" INTEGER,
ADD COLUMN     "jobId" TEXT,
ADD COLUMN     "outcome" TEXT,
ADD COLUMN     "problem" TEXT,
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "serviceId" TEXT,
ADD COLUMN     "solution" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Project_jobId_key" ON "Project"("jobId");

-- CreateIndex
CREATE INDEX "Project_serviceId_isActive_idx" ON "Project"("serviceId", "isActive");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

