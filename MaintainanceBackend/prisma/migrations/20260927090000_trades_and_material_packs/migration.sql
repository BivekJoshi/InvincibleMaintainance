-- Phase L2: what a day of each trade costs, and how each material is bought.

-- AlterTable
ALTER TABLE "Material" ADD COLUMN     "packLabel" TEXT,
ADD COLUMN     "packSize" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dayWage" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Trade_code_key" ON "Trade"("code");

-- CreateIndex
CREATE INDEX "Trade_isActive_sortOrder_idx" ON "Trade"("isActive", "sortOrder");
