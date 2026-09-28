-- Phase L7: the foreman's day on site — one entry per job per Kathmandu day.

-- CreateEnum
CREATE TYPE "DiaryWeather" AS ENUM ('SUNNY', 'CLOUDY', 'RAIN', 'HEAVY_RAIN', 'COLD');

-- CreateEnum
CREATE TYPE "LostTimeReason" AS ENUM ('RAIN', 'LATE_MATERIAL', 'CUSTOMER', 'BANDH', 'FESTIVAL', 'OTHER');

-- CreateTable
CREATE TABLE "SiteDiary" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "weather" "DiaryWeather",
    "headcount" JSONB NOT NULL,
    "progress" JSONB NOT NULL,
    "received" JSONB NOT NULL,
    "issues" TEXT,
    "lostHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lostReason" "LostTimeReason",
    "photoMediaIds" JSONB NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteDiary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: one entry per job per day — a replayed save lands on the same row.
CREATE UNIQUE INDEX "SiteDiary_jobId_day_key" ON "SiteDiary"("jobId", "day");

-- AddForeignKey
ALTER TABLE "SiteDiary" ADD CONSTRAINT "SiteDiary_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteDiary" ADD CONSTRAINT "SiteDiary_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
