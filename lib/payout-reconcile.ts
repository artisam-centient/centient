import * as Sentry from "@sentry/nextjs";
import prisma from "./prisma";
import { lookupTx, type TxLookup } from "./stellar/client";
import { usdcAsset } from "./stellar/config";
import { verifySettledPayout } from "./stellar/payout-verify";
import { refundSubmissionDebit } from "./payout-refund";
import { SUBMISSION_RETRY_BUDGET } from "./payout-retry-claim";

// #40 D2: a payout still unreadable this long after it was created is paged.
const READ_ERROR_ALERT_AFTER_MS = 15 * 60_000;

/**
 * Settle one `sent` submission against Horizon's answer for its hash (#40).
 *
 * The in-process reconciler loop is the only caller. It used to share these
 * rows with a cron route that applied different failure semantics to them; that
 * route is gone (D1), so this is the single place a broadcast submission payout
 * moves on Horizon's word.
 */
export async function reconcileSubmission(id: string, txHash: string): Promise<void> {
  // Horizon lookup (ST-1b) maps to three states: confirmed (successful tx),
  // failed (tx included but op failed), or not_found (404 — not yet visible).
  let lookup: TxLookup;
  try {
    lookup = await lookupTx(txHash);
  } catch (err: any) {
    // #40 D2: a read that throws (network, 5xx, a 400 on a malformed hash) says
    // nothing about the payment. The hash was broadcast and may have landed, so
    // neither the status nor the retry budget moves; only Horizon's answer may.
    const message = `Horizon read failed: ${err?.message ?? String(err)}`;
    const row = await prisma.submission.update({
      where: { id },
      data: { payoutError: message },
      select: { createdAt: true },
    });
    alertIfStale("submission", id, row?.createdAt, message);
    return;
  }

  if (lookup.status === "confirmed") {
    await settleConfirmedPayment(id, txHash, lookup.envelopeXdr);
  } else if (lookup.status === "failed") {
    await handBackFailedPayment(id, txHash);
  } else {
    // not_found: still pending. A submitted Stellar tx is only assigned a hash
    // once included in a ledger (≈5s finality), so a 404 here is Horizon
    // read-lag, not a drop. Leave the payout `sent` and re-check next pass —
    // the loop's claim already refreshed lastRetriedAt — without burning a
    // retry.
    console.log(`[reconciler] submission ${id} not yet visible on Horizon — leaving sent`);
  }
}

/**
 * #40 D4: Horizon says the envelope applied. Confirm it only if it paid what the
 * submission owed: the bound wallet, the payout amount in the configured USDC,
 * from the payout account, which also paid the fee bump. Anything else is held
 * as `needs_reconciliation` for a human, never confirmed.
 *
 * Without the payout account or USDC issuer configured there is nothing to hold
 * the envelope to, so nothing is confirmed: the row stays `sent` and pages.
 */
async function settleConfirmedPayment(id: string, txHash: string, envelopeXdr: string): Promise<void> {
  const sub = await prisma.submission.findUnique({
    where: { id },
    select: { walletAddress: true, payoutAmountUnits: true },
  });
  if (!sub) return;

  let payoutAccount: string;
  let asset: ReturnType<typeof usdcAsset>;
  try {
    payoutAccount = process.env.STELLAR_PLATFORM_ACCOUNT?.trim() ?? "";
    if (!payoutAccount) throw new Error("STELLAR_PLATFORM_ACCOUNT is not configured");
    asset = usdcAsset();
  } catch (err) {
    const message = `cannot verify payout ${txHash}: ${(err as Error).message}`;
    await prisma.submission.update({ where: { id }, data: { payoutError: message } });
    console.error(`[reconciler] submission ${id}: ${message} — leaving it sent`);
    Sentry.captureMessage(`[reconciler] ${message}`, {
      level: "error",
      fingerprint: ["reconciler-cannot-verify"],
    });
    return;
  }

  const verdict = sub.walletAddress
    ? verifySettledPayout(envelopeXdr, {
        payoutAccount,
        destination: sub.walletAddress,
        amountUnits: sub.payoutAmountUnits,
        asset,
      })
    : ({ ok: false, mismatches: ["submission has no bound wallet to check the destination against"] } as const);

  // Both writes are conditional on the row still being `sent` under this hash,
  // so a second reader of the same answer changes nothing.
  const stillSent = { id, payoutStatus: "sent", payoutTxHash: txHash };
  if (verdict.ok) {
    await prisma.submission.updateMany({
      where: stillSent,
      data: { payoutStatus: "confirmed", lastRetriedAt: new Date() },
    });
    console.log(`[reconciler] confirmed submission ${id}`);
    return;
  }

  const reason = `payout ${txHash} applied but does not match the submission: ${verdict.mismatches.join("; ")}`;
  const { count } = await prisma.submission.updateMany({
    where: stillSent,
    data: { payoutStatus: "needs_reconciliation", payoutError: reason },
  });
  if (count === 0) return;
  console.error(`[reconciler] submission ${id}: ${reason}`);
  Sentry.captureMessage(`[reconciler] submission ${id} payout mismatch`, {
    level: "error",
    extra: { txHash, mismatches: verdict.mismatches },
  });
}

const FAILED_ON_CHAIN = "included and failed";

/**
 * #40 D3: Horizon says the envelope was included and failed, so nothing was
 * paid. The row still reads paid: its hash is stored, its attempt confirmed, and
 * the user's totals raised in the write that stored the hash. Undo exactly those
 * and hand the row back to the retry path, which builds the one replacement.
 *
 * The hand-back spends one retry. Without that, an envelope that fails on-chain
 * every time would be rebuilt forever. On the last retry the payout is over, and
 * the campaign debit is returned the way the retry path returns it.
 *
 * Everything is conditional on the row still being `sent` under this hash, in
 * one transaction, so a second reader of the same failure changes nothing.
 */
async function handBackFailedPayment(id: string, txHash: string): Promise<void> {
  const handedBack = await prisma.$transaction(async (tx) => {
    const [sub] = await tx.$queryRaw<
      { userId: string; payoutAmountUnits: bigint; retryCount: number }[]
    >`
      SELECT "userId", "payoutAmountUnits", "retryCount" FROM "submissions"
      WHERE "id" = ${id} AND "payoutStatus" = 'sent' AND "payoutTxHash" = ${txHash}
      FOR UPDATE
    `;
    if (!sub) return null;

    const retryCount = sub.retryCount + 1;
    await tx.submission.update({
      where: { id },
      data: {
        payoutStatus: "failed",
        payoutTxHash: null,
        retryCount,
        lastRetriedAt: null,
        payoutError: `envelope ${txHash} ${FAILED_ON_CHAIN}; returned to the retry path`,
      },
    });
    // Confirmed when the hash was stored; open if the row predates that write.
    await tx.payoutAttempt.updateMany({
      where: { envelopeHash: txHash, status: { in: ["open", "confirmed"] } },
      data: { status: "void", outcome: FAILED_ON_CHAIN, resolvedAt: new Date() },
    });
    // Never below zero: a row whose credit write never landed has nothing to undo.
    await tx.user.updateMany({
      where: { id: sub.userId, totalEarnedUnits: { gte: sub.payoutAmountUnits }, submissionCount: { gt: 0 } },
      data: { totalEarnedUnits: { decrement: sub.payoutAmountUnits }, submissionCount: { decrement: 1 } },
    });
    await tx.payoutJob.updateMany({
      where: { submissionId: id, txHash },
      data: { status: "failed", lastError: `${FAILED_ON_CHAIN} on Horizon` },
    });
    return { amount: sub.payoutAmountUnits, retryCount };
  });

  if (!handedBack) return;
  console.warn(`[reconciler] submission ${id}: envelope ${txHash} ${FAILED_ON_CHAIN} — returned to the retry path`);
  Sentry.captureMessage(`[reconciler] submission ${id} payout ${FAILED_ON_CHAIN} on-chain`, { level: "warning" });

  if (handedBack.retryCount >= SUBMISSION_RETRY_BUDGET) {
    await refundSubmissionDebit(id, handedBack.amount, "refund: payout failed on-chain with its retries spent");
  }
}

export function alertIfStale(kind: string, id: string, createdAt: Date | undefined, message: string): void {
  console.warn(`[reconciler] ${kind} ${id}: ${message} — leaving it for the next pass`);
  if (!createdAt || Date.now() - createdAt.getTime() < READ_ERROR_ALERT_AFTER_MS) return;
  Sentry.captureMessage(`[reconciler] ${kind} ${id} still unreadable on Horizon`, {
    level: "warning",
    fingerprint: ["reconciler-read-error", kind, id],
    extra: { message },
  });
}
