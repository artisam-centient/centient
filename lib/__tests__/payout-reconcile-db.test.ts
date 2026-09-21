import { Account, Asset, Keypair, Networks, Operation, TransactionBuilder } from "@stellar/stellar-sdk";
import { NextRequest } from "next/server";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

// #40 — settling a `sent` payout against what Horizon says it did.
//
// D3: included and failed. The payment provably did not happen, but the row
// reads paid: its hash is stored, its attempt is confirmed, and the user's
// totals were raised. The reconciler undoes exactly that and hands the row back
// to the retry path, which builds the one replacement under its usual budget.
//
// D4: applied. It is confirmed only if the envelope paid what the submission
// owed; otherwise it is held for a human.
//
// The attempts table, the claim, the refund ledger and the retry path run for
// real; Horizon is a fake chain serving real envelopes.

const PAYOUT_ACCOUNT = Keypair.random().publicKey();
const USDC = new Asset("USDC", Keypair.random().publicKey());

const chain = new Map<string, "confirmed" | "failed">();
const envelopes = new Map<string, string>();
let broadcasts: string[] = [];

/** The envelope `submitMultisigPayout` builds: one USDC payment, fee-bumped by the payout account. */
function payoutEnvelope(destination: string, amount: string, feeSource = PAYOUT_ACCOUNT) {
  const inner = new TransactionBuilder(new Account(PAYOUT_ACCOUNT, "41"), {
    fee: "100",
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(Operation.payment({ destination, asset: USDC, amount }))
    .setTimeout(180)
    .build();
  return TransactionBuilder.buildFeeBumpTransaction(feeSource, "200", inner, Networks.TESTNET).toXDR();
}

const { mockSubmitMultisigPayout } = vi.hoisted(() => ({ mockSubmitMultisigPayout: vi.fn() }));

vi.mock("@/lib/stellar/payout-submitter", () => ({ submitMultisigPayout: mockSubmitMultisigPayout }));
vi.mock("@/lib/stellar/payout-cosigner", () => ({
  resolvePayoutCoSigner: vi.fn(() => ({ signPayout: vi.fn() })),
}));
vi.mock("@/lib/stellar/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/stellar/client")>();
  return {
    ...actual,
    getTxStatus: vi.fn(async (hash: string) => chain.get(hash) ?? "not_found"),
    lookupTx: vi.fn(async (hash: string) => {
      const status = chain.get(hash);
      return status ? { status, envelopeXdr: envelopes.get(hash)! } : { status: "not_found" };
    }),
    latestLedgerCloseMs: vi.fn(async () => Date.now()),
  };
});
vi.mock("@/lib/stellar/balance", () => ({ checkAndAlert: vi.fn(async () => {}) }));
vi.mock("@/lib/health-alert", () => ({ sendDedupedDiscordAlert: vi.fn(async () => "sent") }));
vi.mock("@sentry/nextjs", () => ({ captureMessage: vi.fn(), captureException: vi.fn() }));

import { reconcileSubmission } from "@/lib/payout-reconcile";
import { reprocessPayoutWithNonceSafety } from "@/lib/payout-service";
import { POST as retryCron } from "@/app/api/cron/payout-retry/route";
import { SUBMISSION_RETRY_BUDGET } from "@/lib/payout-retry-claim";
import { prisma, truncateAll } from "@/tests/helpers/db";
import {
  createCampaign,
  createCampaignBalance,
  createTask,
  createUser,
  VALID_REASON,
} from "@/tests/helpers/factories";

const AMOUNT = 2_500_000n;
const ORIGINAL_ENV = { ...process.env };
const LONG_AGO = () => new Date(Date.now() - 10 * 60_000);

beforeEach(async () => {
  vi.clearAllMocks();
  process.env = {
    ...ORIGINAL_ENV,
    DAILY_PAYOUT_CAP_UNITS: "0",
    PLATFORM_FEE_UNITS: "1500000",
    CRON_SECRET: "test-secret",
    STELLAR_NETWORK: "testnet",
    STELLAR_PLATFORM_ACCOUNT: PAYOUT_ACCOUNT,
    STELLAR_USDC_ISSUER: USDC.getIssuer(),
  };
  chain.clear();
  envelopes.clear();
  broadcasts = [];
  mockSubmitMultisigPayout.mockImplementation(
    async (
      req: { destination: string; amountUnits: bigint },
      { attempts }: { attempts?: { open(e: { hash: string; expiresAt: Date }): Promise<void> } },
    ) => {
      const hash = `envelope-${broadcasts.length + 1}`;
      await attempts?.open({ hash, expiresAt: new Date(Date.now() + 180_000) });
      broadcasts.push(hash);
      chain.set(hash, "confirmed");
      envelopes.set(hash, payoutEnvelope(req.destination, (Number(req.amountUnits) / 1e7).toFixed(7)));
      return { hash };
    },
  );
  await truncateAll();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

/** A submission the real retry path has paid: `sent`, attempt confirmed, totals raised. */
async function paid(opts: { retryCount?: number } = {}) {
  const campaign = await createCampaign({ rewardUnits: AMOUNT });
  await createCampaignBalance(campaign.id, 1_000_000_000n);
  const user = await createUser({ walletAddress: Keypair.random().publicKey() });
  const task = await createTask({ campaignId: campaign.id, prompt: `Paid ${Math.random()}?` });
  const submission = await prisma.submission.create({
    data: {
      userId: user.id,
      walletAddress: user.walletAddress,
      taskId: task.id,
      choice: "A",
      reason: VALID_REASON,
      payoutAmountUnits: AMOUNT,
      payoutStatus: "failed",
      retryCount: opts.retryCount ?? 0,
      createdAt: LONG_AGO(),
    },
  });
  await reprocessPayoutWithNonceSafety(submission.id);
  const hash = broadcasts.at(-1)!;
  expect(await row(submission.id)).toMatchObject({ payoutStatus: "sent", payoutTxHash: hash });
  expect(await totals(user.id)).toEqual({ submissionCount: 1, totalEarnedUnits: AMOUNT });
  return { submission, user, hash };
}

/** One pass of the real retry cron: its selection, backoff and abandon sweep. */
const runRetryCron = () =>
  retryCron(
    new NextRequest("http://localhost/api/cron/payout-retry", {
      method: "POST",
      headers: { Authorization: "Bearer test-secret" },
    }),
  );

const row = (id: string) => prisma.submission.findUniqueOrThrow({ where: { id } });
const totals = (userId: string) =>
  prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { submissionCount: true, totalEarnedUnits: true },
  });
const refunds = (submissionId: string) =>
  prisma.balanceLedger.count({ where: { type: "REFUND", submissionId } });

describe("a sent payout Horizon reports included and failed (#40 D3)", () => {
  it("is handed back to the retry path with its hash, attempt and credit undone", async () => {
    const { submission, user, hash } = await paid();
    chain.set(hash, "failed");

    await reconcileSubmission(submission.id, hash);

    expect(await row(submission.id)).toMatchObject({
      payoutStatus: "failed",
      payoutTxHash: null,
      retryCount: 1,
      lastRetriedAt: null,
    });
    expect(await prisma.payoutAttempt.findUniqueOrThrow({ where: { envelopeHash: hash } })).toMatchObject({
      status: "void",
      outcome: "included and failed",
    });
    expect(await totals(user.id)).toEqual({ submissionCount: 0, totalEarnedUnits: 0n });
    expect(await refunds(submission.id)).toBe(0);
  });

  it("gets exactly one replacement, and the user is credited once", async () => {
    const { submission, user, hash } = await paid();
    chain.set(hash, "failed");

    await reconcileSubmission(submission.id, hash);
    await runRetryCron();
    await runRetryCron();

    expect(broadcasts).toEqual([hash, "envelope-2"]);
    expect(await row(submission.id)).toMatchObject({ payoutStatus: "sent", payoutTxHash: "envelope-2" });
    expect(await totals(user.id)).toEqual({ submissionCount: 1, totalEarnedUnits: AMOUNT });
  });

  it("undoes the credit once, however many times the failure is read", async () => {
    const { submission, user, hash } = await paid();
    chain.set(hash, "failed");

    await Promise.all([reconcileSubmission(submission.id, hash), reconcileSubmission(submission.id, hash)]);
    await reconcileSubmission(submission.id, hash);

    expect(await totals(user.id)).toEqual({ submissionCount: 0, totalEarnedUnits: 0n });
    expect(await row(submission.id)).toMatchObject({ payoutStatus: "failed", retryCount: 1 });
  });

  it("spends the last retry: refunds the campaign debit once and pays nothing more", async () => {
    const { submission, hash } = await paid({ retryCount: SUBMISSION_RETRY_BUDGET - 1 });
    chain.set(hash, "failed");

    await reconcileSubmission(submission.id, hash);
    await reconcileSubmission(submission.id, hash);
    await runRetryCron();

    // The retry cron's own give-up: its abandon sweep finalizes the row.
    expect(await row(submission.id)).toMatchObject({
      payoutStatus: "abandoned",
      payoutTxHash: null,
      retryCount: SUBMISSION_RETRY_BUDGET,
    });
    expect(await refunds(submission.id)).toBe(1);
    expect(broadcasts).toEqual([hash]);
  });
});

describe("a sent payout Horizon reports applied (#40 D4)", () => {
  it("is confirmed when its envelope paid what the submission owed", async () => {
    const { submission, user, hash } = await paid();

    await reconcileSubmission(submission.id, hash);

    expect(await row(submission.id)).toMatchObject({ payoutStatus: "confirmed", payoutTxHash: hash });
    expect(await totals(user.id)).toEqual({ submissionCount: 1, totalEarnedUnits: AMOUNT });
  });

  it.each([
    ["paid someone else", () => payoutEnvelope(Keypair.random().publicKey(), "0.2500000"), /destination/],
    ["paid the wrong amount", (wallet: string) => payoutEnvelope(wallet, "2.5000000"), /amount/],
    [
      "had its fee paid by another account",
      (wallet: string) => payoutEnvelope(wallet, "0.2500000", Keypair.random().publicKey()),
      /fee source/,
    ],
  ])("is held for a human, never confirmed, when it %s", async (_label, forge, reason) => {
    const { submission, user, hash } = await paid();
    envelopes.set(hash, forge(submission.walletAddress!));

    await reconcileSubmission(submission.id, hash);
    await reconcileSubmission(submission.id, hash);

    const held = await row(submission.id);
    expect(held).toMatchObject({ payoutStatus: "needs_reconciliation", payoutTxHash: hash });
    expect(held.payoutError).toMatch(reason);
    // Nothing is undone or rebuilt: what landed is for a human to judge.
    expect(await prisma.payoutAttempt.findUniqueOrThrow({ where: { envelopeHash: hash } })).toMatchObject({
      status: "confirmed",
    });
    expect(await totals(user.id)).toEqual({ submissionCount: 1, totalEarnedUnits: AMOUNT });
    await runRetryCron();
    expect(broadcasts).toEqual([hash]);
  });
});
