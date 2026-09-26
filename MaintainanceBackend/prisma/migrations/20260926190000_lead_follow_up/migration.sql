-- Phase L1: every open lead has a next action and a clock; LOST carries a category and the stage.

-- CreateEnum
CREATE TYPE "LostCategory" AS ENUM ('PRICE', 'COMPETITOR', 'UNREACHABLE', 'POSTPONED', 'BUDGET', 'OWN_LABOUR', 'OUT_OF_SCOPE', 'OUT_OF_AREA', 'DUPLICATE_SPAM', 'OTHER');

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "contactAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lostAtStage" "LeadStatus",
ADD COLUMN     "lostCategory" "LostCategory",
ADD COLUMN     "nextActionAt" TIMESTAMP(3),
ADD COLUMN     "nextActionNote" TEXT,
ADD COLUMN     "nextActionType" TEXT,
ADD COLUMN     "qualification" JSONB,
ADD COLUMN     "stageEnteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "LeadActivity" ADD COLUMN     "outcome" TEXT;

-- CreateIndex
CREATE INDEX "Lead_nextActionAt_idx" ON "Lead"("nextActionAt");

-- Backfill: the stage began at the last status change, or when the lead came in.
UPDATE "Lead" l SET "stageEnteredAt" = COALESCE(
  (SELECT MAX(a."createdAt") FROM "LeadActivity" a WHERE a."leadId" = l.id AND a.type = 'status_change'),
  l."createdAt");

-- Backfill: every contact already logged was an attempt.
UPDATE "Lead" l SET "contactAttempts" = (
  SELECT COUNT(*) FROM "LeadActivity" a
  WHERE a."leadId" = l.id AND a.type IN ('call', 'sms', 'whatsapp', 'email', 'visit'));

-- Backfill: a lost lead's stage is the "from" of the move that lost it; its category, from how it was lost.
UPDATE "Lead" l SET "lostAtStage" = (last.meta->>'from')::"LeadStatus"
FROM (
  SELECT DISTINCT ON ("leadId") "leadId", meta FROM "LeadActivity"
  WHERE type = 'status_change' AND meta->>'to' = 'LOST'
  ORDER BY "leadId", "createdAt" DESC
) last
WHERE last."leadId" = l.id AND l.status = 'LOST' AND last.meta->>'from' IS NOT NULL;

UPDATE "Lead" SET "lostCategory" = CASE WHEN "lostReason" LIKE 'Merged into%' THEN 'DUPLICATE_SPAM'::"LostCategory" ELSE 'OTHER'::"LostCategory" END
WHERE status = 'LOST';
