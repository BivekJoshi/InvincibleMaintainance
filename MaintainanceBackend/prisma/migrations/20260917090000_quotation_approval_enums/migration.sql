-- Phase F1 · internal quotation approval and customer change requests.
-- Enum values only: Postgres cannot use a value in the transaction that adds it,
-- so nothing here refers to them. The columns follow in the next migration.

-- MANAGER: every SALES capability plus quotations:approve.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'MANAGER' AFTER 'SALES';

-- APPROVED keeps meaning "the customer accepted"; OFFICE_APPROVED is the internal approval.
ALTER TYPE "QuotationStatus" ADD VALUE IF NOT EXISTS 'PENDING_APPROVAL' AFTER 'DRAFT';
ALTER TYPE "QuotationStatus" ADD VALUE IF NOT EXISTS 'OFFICE_APPROVED' AFTER 'PENDING_APPROVAL';
ALTER TYPE "QuotationStatus" ADD VALUE IF NOT EXISTS 'CHANGES_REQUESTED' AFTER 'SENT';
ALTER TYPE "QuotationStatus" ADD VALUE IF NOT EXISTS 'SUPERSEDED' AFTER 'EXPIRED';
