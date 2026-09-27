-- Phase L4 backfill: a quotation's stored cost total, from its totalled rows (ITEM, not optional). It is
-- complete only when it has such rows and every one has a known cost — an unknown cost is never zero.
UPDATE "Quotation" q SET
  "costTotal" = agg.cost_total,
  "costComplete" = agg.rows > 0 AND agg.unknown = 0
FROM (
  SELECT "quotationId",
         COALESCE(SUM("costAmount"), 0)::int AS cost_total,
         COUNT(*) AS rows,
         COUNT(*) FILTER (WHERE "unitCost" IS NULL) AS unknown
  FROM "QuotationItem"
  WHERE "rowType" = 'ITEM' AND "isOptional" = false
  GROUP BY "quotationId"
) agg
WHERE agg."quotationId" = q."id";
