-- Wallet sign-in (#25) shares wallet_nonces with the payout-address link flow.
--
-- `action` separates the two. Existing rows are all link challenges, so the
-- default keeps every outstanding one valid through the deploy.
-- `networkPassphrase` and `issuedAt` let the verifier rebuild a sign-in
-- challenge's exact signed text from the row alone, never from anything the
-- client sends back.
ALTER TABLE "wallet_nonces"
    ADD COLUMN "action" TEXT NOT NULL DEFAULT 'link-payout-address',
    ADD COLUMN "networkPassphrase" TEXT,
    ADD COLUMN "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "wallet_nonces_walletAddress_action_idx" ON "wallet_nonces"("walletAddress", "action");
