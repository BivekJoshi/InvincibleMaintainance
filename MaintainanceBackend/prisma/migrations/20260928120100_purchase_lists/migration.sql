-- Phase L7: what to buy for a job, raised from its shortfall; receiving it records the supplier on the stock movement.

-- CreateEnum
CREATE TYPE "PurchaseListStatus" AS ENUM ('DRAFT', 'ORDERED', 'RECEIVED', 'CANCELLED');

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "supplierId" TEXT;

-- CreateTable
CREATE TABLE "PurchaseList" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "jobId" TEXT,
    "supplierId" TEXT,
    "status" "PurchaseListStatus" NOT NULL DEFAULT 'DRAFT',
    "orderedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PurchaseList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseListItem" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,
    "packs" INTEGER,
    "receivedQty" DOUBLE PRECISION,
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PurchaseListItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseList_number_key" ON "PurchaseList"("number");

-- CreateIndex
CREATE INDEX "PurchaseList_status_createdAt_idx" ON "PurchaseList"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PurchaseList_jobId_idx" ON "PurchaseList"("jobId");

-- CreateIndex
CREATE INDEX "PurchaseListItem_listId_idx" ON "PurchaseListItem"("listId");

-- AddForeignKey
ALTER TABLE "PurchaseList" ADD CONSTRAINT "PurchaseList_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseList" ADD CONSTRAINT "PurchaseList_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseListItem" ADD CONSTRAINT "PurchaseListItem_listId_fkey" FOREIGN KEY ("listId") REFERENCES "PurchaseList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseListItem" ADD CONSTRAINT "PurchaseListItem_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
