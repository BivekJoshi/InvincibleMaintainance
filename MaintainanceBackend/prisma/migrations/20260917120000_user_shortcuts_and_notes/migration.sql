-- Per-user admin-shell preferences: the quick-links bar (UserShortcut, at most 12 per
-- user, one per path) and sticky notes (UserNote, soft-deleted). Both belong to one
-- user and go with the account. New tables only; nothing existing changes.

-- CreateTable
CREATE TABLE "UserShortcut" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserShortcut_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserNote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'yellow',
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "UserNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserShortcut_userId_sortOrder_idx" ON "UserShortcut"("userId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "UserShortcut_userId_to_key" ON "UserShortcut"("userId", "to");

-- CreateIndex
CREATE INDEX "UserNote_userId_deletedAt_idx" ON "UserNote"("userId", "deletedAt");

-- AddForeignKey
ALTER TABLE "UserShortcut" ADD CONSTRAINT "UserShortcut_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserNote" ADD CONSTRAINT "UserNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
