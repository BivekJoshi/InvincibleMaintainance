-- Phase F1 · who submitted and approved a quotation, why it went back to draft,
-- the customer's user agent, the change request a revision answers, and which
-- version replaced it. No data migration: every existing status stays valid.

ALTER TABLE "Quotation" ADD COLUMN     "submittedAt" TIMESTAMP(3),
ADD COLUMN     "submittedById" TEXT,
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvalNote" TEXT,
ADD COLUMN     "autoApproved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sentBackReason" TEXT,
ADD COLUMN     "decidedUserAgent" TEXT,
ADD COLUMN     "requestedChanges" TEXT,
ADD COLUMN     "supersededById" TEXT;

-- The version chain and a lead's quotations are read on every quotation page.
CREATE INDEX "Quotation_parentId_idx" ON "Quotation"("parentId");
CREATE INDEX "Quotation_leadId_idx" ON "Quotation"("leadId");

ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "Quotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
