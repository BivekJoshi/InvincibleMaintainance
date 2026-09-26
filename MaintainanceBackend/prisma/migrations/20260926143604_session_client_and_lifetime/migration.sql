-- CreateEnum
CREATE TYPE "SessionClient" AS ENUM ('WEB', 'DESKTOP');

-- AlterTable
ALTER TABLE "RefreshToken" ADD COLUMN     "client" "SessionClient" NOT NULL DEFAULT 'WEB',
ADD COLUMN     "signedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Existing sessions: the true sign-in time was never kept, so the current row's issue time is the best known.
UPDATE "RefreshToken" SET "signedInAt" = "createdAt";
