-- Phase L8 backfill: the closing bills Phase L6 made deducted each stage bill as a negative "Less: …" line; name
-- them DEDUCTION. (Kept apart from the enum's migration, which must commit first.)
UPDATE "InvoiceItem" SET "kind" = 'DEDUCTION'
WHERE "amount" < 0 AND "description" LIKE 'Less: %'
  AND "invoiceId" IN (SELECT "id" FROM "Invoice" WHERE "kind" = 'FINAL');
