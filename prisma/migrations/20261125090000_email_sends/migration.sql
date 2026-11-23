-- #260 (ADR-0013): the email send queue and send log, and the last served task
-- that makes an "unfinished task" reminder possible.

-- AlterTable
ALTER TABLE "users" ADD COLUMN "lastServedTaskId" TEXT,
ADD COLUMN "lastServedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "email_sends" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "reason" TEXT,
    "notBefore" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "payload" JSONB,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_sends_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_sends_dedupeKey_key" ON "email_sends"("dedupeKey");

-- CreateIndex
CREATE INDEX "email_sends_status_notBefore_idx" ON "email_sends"("status", "notBefore");

-- CreateIndex
CREATE INDEX "email_sends_sentAt_idx" ON "email_sends"("sentAt");

-- CreateIndex
CREATE INDEX "email_sends_userId_kind_sentAt_idx" ON "email_sends"("userId", "kind", "sentAt");

-- AddForeignKey
ALTER TABLE "email_sends" ADD CONSTRAINT "email_sends_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
