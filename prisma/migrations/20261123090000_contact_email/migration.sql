-- #248: contributor email notices. Separate from users.email (the legacy
-- email/password login). Everything is opt-in: both notice flags default off.

-- CreateTable
CREATE TABLE "contact_emails" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "address" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "pendingAddress" TEXT,
    "verifyTokenHash" TEXT,
    "verifyTokenExpires" TIMESTAMP(3),
    "unsubscribeToken" TEXT NOT NULL,
    "pendingUnsubscribeToken" TEXT,
    "unsubscribedAt" TIMESTAMP(3),
    "notifyNewWork" BOOLEAN NOT NULL DEFAULT false,
    "notifyReminders" BOOLEAN NOT NULL DEFAULT false,
    "promptDismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_emails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contact_emails_userId_key" ON "contact_emails"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "contact_emails_verifyTokenHash_key" ON "contact_emails"("verifyTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "contact_emails_unsubscribeToken_key" ON "contact_emails"("unsubscribeToken");

-- CreateIndex
CREATE UNIQUE INDEX "contact_emails_pendingUnsubscribeToken_key" ON "contact_emails"("pendingUnsubscribeToken");

-- AddForeignKey
ALTER TABLE "contact_emails" ADD CONSTRAINT "contact_emails_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
