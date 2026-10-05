-- Phase L8: the final measurement of a job is closed by someone, at a time — an ITEM_RATE job bills from it.

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "measurementClosedAt" TIMESTAMP(3),
ADD COLUMN     "measurementClosedById" TEXT;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_measurementClosedById_fkey" FOREIGN KEY ("measurementClosedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
