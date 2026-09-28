-- Phase L6: what kind of job an accepted quotation for a service becomes (it was always REPAIR).

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "jobType" "JobType" NOT NULL DEFAULT 'REPAIR';
