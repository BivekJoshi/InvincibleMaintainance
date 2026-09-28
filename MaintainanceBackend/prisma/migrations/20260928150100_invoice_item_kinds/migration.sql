-- Phase L8: an invoice line is a billed ITEM or a DEDUCTION of an earlier stage bill (negative).

-- CreateEnum
CREATE TYPE "InvoiceItemKind" AS ENUM ('ITEM', 'DEDUCTION');

-- AlterTable
ALTER TABLE "InvoiceItem" ADD COLUMN     "kind" "InvoiceItemKind" NOT NULL DEFAULT 'ITEM';
