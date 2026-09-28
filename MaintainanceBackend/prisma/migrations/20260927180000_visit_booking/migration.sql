-- Phase L5: booking a site visit — who opens the door and how to find it (on the site), and the
-- customer's answer on the /visit/:token page (on the inspection job).

-- CreateEnum
CREATE TYPE "VisitAnswer" AS ENUM ('CONFIRMED', 'RESCHEDULE_REQUESTED');

-- AlterTable
ALTER TABLE "CustomerSite" ADD COLUMN     "contactName" TEXT,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "landmark" TEXT;

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "customerConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "visitAnswer" "VisitAnswer",
ADD COLUMN     "visitAnswerIp" TEXT,
ADD COLUMN     "visitAnswerNote" TEXT,
ADD COLUMN     "visitAnsweredAt" TIMESTAMP(3),
ADD COLUMN     "visitReminderSentAt" TIMESTAMP(3),
ADD COLUMN     "visitToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Job_visitToken_key" ON "Job"("visitToken");
