-- The language a lead or customer is written to in SMS and email (en | ne).
ALTER TABLE "Lead" ADD COLUMN "preferredLocale" TEXT NOT NULL DEFAULT 'en';
ALTER TABLE "Customer" ADD COLUMN "preferredLocale" TEXT NOT NULL DEFAULT 'en';
