-- Phase L5: a survey line's measurement sheet (qty derived from it), and the part of the site a photo shows.

-- AlterTable
ALTER TABLE "SurveyItem" ADD COLUMN     "measurements" JSONB;

-- AlterTable
ALTER TABLE "JobPhoto" ADD COLUMN     "area" TEXT;
