import "dotenv/config";
import * as Sentry from "@sentry/nextjs";
import prisma from "./prisma";
import { getTxStatus } from "./stellar/client";
import { checkAndAlert } from "./stellar/balance";
import { refundReversal } from "./user-balance";
import { reviveStrandedAttempts } from "./payout-attempt-revival";
import { alertIfStale, claimHeldPayment, reconcileSubmission, settleHeldPayment } from "./payout-reconcile";

const STALE_PROCESSING_MS = 30_000;
const POLL_IDLE_MS = 5_000;
const MAX_RETRIES = 3;
const BATCH_SIZE = 50;

let shouldStop = false;
let currentId: string | null = null;


async function claimNextSubmission(): Promise<{ id: string; payoutTxHash: string } | null> {
  const staleBefore = new Date(Date.now() - STALE_PROCESSING_MS);

  const claimed = await prisma.submission.findMany({
    where: {
      payoutStatus: "sent",
      payoutTxHash: { not: null },
      OR: [
        { lastRetriedAt: null },
        { lastRetriedAt: { lt: staleBefore } },
      ],
    },
    orderBy: { lastRetriedAt: "asc" },
    take: BATCH_SIZE,
    select: { id: true, payoutTxHash: true },
  });

  if (claimed.length === 0) return null;

  const first = claimed[0];
  await prisma.submission.update({
    where: { id: first.id },
    data: { lastRetriedAt: new Date() },
  });
  return { id: first.id, payoutTxHash: first.payoutTxHash! };
}

async function claimNextWithdrawal(): Promise<{ id: string; txHash: string; userId: string; amountUnits: bigint } | null> {
  const staleBefore = new Date(Date.now() - STALE_PROCESSING_MS);

  const claimed = await prisma.payoutJob.findMany({
    where: {
      type: "WITHDRAWAL",
      status: "processing",
      txHash: { not: null },
      OR: [
        { workerHeartbeatAt: null },
        { workerHeartbeatAt: { lt: staleBefore } },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: BATCH_SIZE,
    select: { id: true, txHash: true, userId: true, amountUnits: true },
  });

  if (claimed.length === 0) return null;

  const first = claimed[0];
  await prisma.payoutJob.update({
    where: { id: first.id },
    data: { workerHeartbeatAt: new Date() },
  });
  return {
    id: first.id,
    txHash: first.txHash!,
    userId: first.userId!,
    amountUnits: first.amountUnits!,
  };
}

export async function processWithdrawal(id: string, txHash: string, userId: string, amountUnits: bigint): Promise<void> {
  currentId = id;
  try {
    const status = await getTxStatus(txHash);
    if (status === "confirmed") {
      await prisma.payoutJob.update({
        where: { id },
        data: { status: "done", completedAt: new Date() },
      });
      console.log(`[reconciler] confirmed withdrawal ${id}`);
    } else if (status === "failed") {
      await handleWithdrawalRetry(id, userId, amountUnits, "transaction failed on Horizon");
    } else {
      // not_found: still pending on Horizon — leave `processing` and re-poll.
      console.log(`[reconciler] withdrawal ${id} not yet visible on Horizon — leaving processing`);
    }
  } catch (err: any) {
    // #40 D2/D7: never refund on a read error. A withdrawal that actually paid
    // and was then refunded is paid twice.
    const message = `Horizon read failed: ${err?.message ?? String(err)}`;
    const job = await prisma.payoutJob.update({
      where: { id },
      data: { lastError: message },
      select: { createdAt: true },
    });
    alertIfStale("withdrawal", id, job?.createdAt, message);
  } finally {
    currentId = null;
  }
}

async function handleWithdrawalRetry(id: string, userId: string, amountUnits: bigint, reason: string): Promise<void> {
  const job = await prisma.payoutJob.findUnique({ where: { id } });
  if (!job) return;

  const newCount = (job.retryCount ?? 0) + 1;
  if (newCount >= MAX_RETRIES) {
    await prisma.$transaction([
      prisma.payoutJob.update({
        where: { id },
        data: { status: "failed", completedAt: new Date(), lastError: reason, retryCount: newCount },
      }),
    ]);
    await refundReversal(userId, amountUnits, id, `Reconciler refund for failed withdrawal: ${reason}`).catch(() => {});
    console.warn(`[reconciler] withdrawal ${id} marked failed after ${MAX_RETRIES} retries: ${reason}`);
    Sentry.captureMessage(`[reconciler] withdrawal ${id} failed: ${reason}`, { level: "warning" });
  } else {
    await prisma.payoutJob.update({
      where: { id },
      data: { retryCount: newCount, workerHeartbeatAt: new Date(), lastError: reason },
    });
    console.log(`[reconciler] withdrawal ${id} retry ${newCount}/${MAX_RETRIES}: ${reason}`);
  }
}

export async function runReconcilerLoop(): Promise<void> {
  console.log("[reconciler] starting loop");

  while (!shouldStop) {
    try {
      const subClaim = await claimNextSubmission();
      if (subClaim) {
        currentId = subClaim.id;
        try {
          await reconcileSubmission(subClaim.id, subClaim.payoutTxHash);
        } finally {
          currentId = null;
        }
        continue;
      }

      // #40 D5: payments Horizon accepted that could not be recorded, settled on proof.
      const heldClaim = await claimHeldPayment();
      if (heldClaim) {
        currentId = heldClaim.id;
        try {
          await settleHeldPayment(heldClaim.id, heldClaim.payoutTxHash);
        } finally {
          currentId = null;
        }
        continue;
      }

      const wdClaim = await claimNextWithdrawal();
      if (wdClaim) {
        await processWithdrawal(wdClaim.id, wdClaim.txHash, wdClaim.userId, wdClaim.amountUnits);
        continue;
      }

      // #38: hand back stranded payouts whose unknown envelope is now proven.
      await reviveStrandedAttempts().catch((err) => {
        console.error("[reconciler] payout attempt revival failed:", err);
        Sentry.captureException(err, { extra: { context: "reconciler-attempt-revival" } });
      });

      await checkAndAlert();
      await sleep(POLL_IDLE_MS);
    } catch (err) {
      console.error("[reconciler] loop error:", err);
      Sentry.captureException(err, { extra: { context: "reconciler-loop" } });
      await sleep(POLL_IDLE_MS);
    }
  }

  console.log("[reconciler] loop stopped");
}

export function stopReconciler(): void {
  shouldStop = true;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function installSignalHandlers() {
  const handler = (signal: string) => {
    console.log(`[reconciler] received ${signal}, finishing in-flight job then exiting`);
    shouldStop = true;
    if (currentId) {
      console.log(`[reconciler] in-flight job ${currentId} will be retried on next run`);
    }
  };
  process.on("SIGTERM", () => handler("SIGTERM"));
  process.on("SIGINT", () => handler("SIGINT"));
}

const isEntrypoint = require.main === module;
if (isEntrypoint) {
  installSignalHandlers();
  runReconcilerLoop().catch((err) => {
    console.error("[reconciler] fatal:", err);
    Sentry.captureException(err, { extra: { context: "reconciler-fatal" } });
    process.exit(1);
  });
}
