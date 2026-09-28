-- Phase L3 backfill: every existing line is an ITEM row (the column default) whose net quantity is its
-- quantity. Its kind comes from its rate-card item — LABOUR for the Labour category, SERVICE for any other
-- item, OTHER for a hand-typed line. Cost stays null: unknown, never zero.
UPDATE "QuotationItem" SET "netQty" = "qty" WHERE "netQty" IS NULL;

UPDATE "QuotationItem" q SET "kind" = CASE
    WHEN r."category" = 'Labour' THEN 'LABOUR'::"SurveyItemKind"
    ELSE 'SERVICE'::"SurveyItemKind"
  END
FROM "RateCardItem" r
WHERE q."rateCardItemId" = r."id" AND q."kind" IS NULL;

UPDATE "QuotationItem" SET "kind" = 'OTHER'::"SurveyItemKind" WHERE "kind" IS NULL;
