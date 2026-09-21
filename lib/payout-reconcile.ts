import * as Sentry from "@sentry/nextjs";
import prisma from "./prisma";
import { getTxStatus } from "./stellar/client";

const MAX_RETRIES = 3;
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
  let status: Awaited<ReturnType<typeof getTxStatus>>;
  try {
    status = await getTxStatus(txHash);
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

  if (status === "confirmed") {
    await prisma.submission.update({
      where: { id },
      data: { payoutStatus: "confirmed", lastRetriedAt: new Date() },
    });
    console.log(`[reconciler] confirmed submission ${id}`);
  } else if (status === "failed") {
    await handleSubmissionRetry(id, "transaction failed on Horizon");
  } else {
    // not_found: still pending. A submitted Stellar tx is only assigned a hash
    // once included in a ledger (≈5s finality), so a 404 here is Horizon
    // read-lag, not a drop. Leave the payout `sent` and re-check next pass —
    // the loop's claim already refreshed lastRetriedAt — without burning a
    // retry.
    console.log(`[reconciler] submission ${id} not yet visible on Horizon — leaving sent`);
  }
}

async function handleSubmissionRetry(id: string, reason: string): Promise<void> {
  const sub = await prisma.submission.findUnique({ where: { id } });
  if (!sub) return;

  const newCount = (sub.retryCount ?? 0) + 1;
  if (newCount >= MAX_RETRIES) {
    await prisma.submission.update({
      where: { id },
      data: { payoutStatus: "failed", retryCount: newCount, lastRetriedAt: new Date() },
    });
    console.warn(`[reconciler] submission ${id} marked failed after ${MAX_RETRIES} retries: ${reason}`);
    Sentry.captureMessage(`[reconciler] submission ${id} failed: ${reason}`, { level: "warning" });
  } else {
    await prisma.submission.update({
      where: { id },
      data: { retryCount: newCount, lastRetriedAt: new Date() },
    });
    console.log(`[reconciler] submission ${id} retry ${newCount}/${MAX_RETRIES}: ${reason}`);
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
