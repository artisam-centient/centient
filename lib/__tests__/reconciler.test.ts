import { vi, describe, it, expect, beforeEach } from "vitest";

// ST-3b: the reconciler resolves finality via Horizon `getTxStatus`
// ("confirmed" | "failed" | "not_found"). These tests mock Horizon and assert
// the sent→confirmed / failed→retry / not_found→stay-pending mapping.
const {
  mockGetTxStatus,
  mockSubFindUnique,
  mockSubUpdate,
  mockJobFindUnique,
  mockJobUpdate,
} = vi.hoisted(() => ({
  mockGetTxStatus: vi.fn(),
  mockSubFindUnique: vi.fn(),
  mockSubUpdate: vi.fn(),
  mockJobFindUnique: vi.fn(),
  mockJobUpdate: vi.fn(),
}));

vi.mock("@/lib/stellar/client", () => ({
  getTxStatus: mockGetTxStatus,
  // #38's stranded-attempt revival reads it; covered in payout-attempt-revival-db.
  latestLedgerCloseMs: vi.fn(async () => null),
}));

vi.mock("@sentry/nextjs", () => ({
  captureMessage: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock("@/lib/stellar/balance", () => ({ checkAndAlert: vi.fn(async () => {}) }));

vi.mock("@/lib/user-balance", () => ({ refundReversal: vi.fn(async () => 0n) }));

vi.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    submission: { findUnique: mockSubFindUnique, update: mockSubUpdate },
    payoutJob: { findUnique: mockJobFindUnique, update: mockJobUpdate },
    $transaction: vi.fn(async (arr: Promise<unknown>[]) => Promise.all(arr)),
  },
}));

import { processSubmission, processWithdrawal } from "../reconciler";
import { refundReversal } from "@/lib/user-balance";
import * as Sentry from "@sentry/nextjs";

const TX = "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";

beforeEach(() => {
  vi.clearAllMocks();
  mockSubUpdate.mockResolvedValue({});
  mockJobUpdate.mockResolvedValue({});
  mockSubFindUnique.mockResolvedValue({ id: "sub", retryCount: 0 });
  mockJobFindUnique.mockResolvedValue({ id: "job", retryCount: 0 });
});

describe("processSubmission", () => {
  it("marks the submission confirmed when Horizon reports confirmed", async () => {
    mockGetTxStatus.mockResolvedValueOnce("confirmed");

    await processSubmission("sub-1", TX);

    expect(mockGetTxStatus).toHaveBeenCalledWith(TX);
    expect(mockSubUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sub-1" },
        data: expect.objectContaining({ payoutStatus: "confirmed" }),
      }),
    );
  });

  it("leaves the submission untouched (still pending) on not_found", async () => {
    mockGetTxStatus.mockResolvedValueOnce("not_found");

    await processSubmission("sub-2", TX);

    expect(mockSubUpdate).not.toHaveBeenCalled();
  });

  it("routes to a bounded retry (increment) when Horizon reports failed", async () => {
    mockGetTxStatus.mockResolvedValueOnce("failed");
    mockSubFindUnique.mockResolvedValueOnce({ id: "sub-3", retryCount: 0 });

    await processSubmission("sub-3", TX);

    expect(mockSubUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sub-3" },
        data: expect.objectContaining({ retryCount: 1 }),
      }),
    );
  });

  it("marks failed after exhausting the retry budget", async () => {
    mockGetTxStatus.mockResolvedValueOnce("failed");
    mockSubFindUnique.mockResolvedValueOnce({ id: "sub-4", retryCount: 2 });

    await processSubmission("sub-4", TX);

    expect(mockSubUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sub-4" },
        data: expect.objectContaining({ payoutStatus: "failed", retryCount: 3 }),
      }),
    );
  });

  // #40 D2: a hash that was broadcast may have landed, so only Horizon's answer
  // may move the row. A read that throws is no answer at all.
  describe("on a Horizon read error", () => {
    it.each([
      ["a 5xx", Object.assign(new Error("Horizon 503"), { response: { status: 503 } })],
      ["a network error", new Error("fetch failed")],
      // Production row a5e7223b went `failed` this way: a non-hex hash draws a
      // 400, and three of them used to exhaust the retry budget.
      ["a 400 on a malformed hash", Object.assign(new Error("Bad Request"), { response: { status: 400 } })],
    ])("never spends a retry or marks failed, on %s", async (_label, err) => {
      mockGetTxStatus.mockRejectedValueOnce(err);
      mockSubFindUnique.mockResolvedValue({ id: "sub-5", retryCount: 2 });

      await processSubmission("sub-5", TX);

      for (const [call] of mockSubUpdate.mock.calls) {
        expect(call.data).not.toHaveProperty("retryCount");
        expect(call.data).not.toHaveProperty("payoutStatus");
      }
    });

    it("records the read error on the row", async () => {
      mockGetTxStatus.mockRejectedValueOnce(new Error("Horizon 503"));

      await processSubmission("sub-6", TX);

      expect(mockSubUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "sub-6" },
          data: { payoutError: expect.stringContaining("Horizon 503") },
        }),
      );
    });

    it("pages only once the payout has been unreadable past the threshold", async () => {
      mockGetTxStatus.mockRejectedValue(new Error("Horizon 503"));

      mockSubUpdate.mockResolvedValueOnce({ createdAt: new Date() });
      await processSubmission("fresh", TX);
      expect(Sentry.captureMessage).not.toHaveBeenCalled();

      mockSubUpdate.mockResolvedValueOnce({ createdAt: new Date(Date.now() - 60 * 60_000) });
      await processSubmission("stale", TX);
      expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        expect.stringContaining("stale"),
        expect.objectContaining({ fingerprint: expect.arrayContaining(["stale"]) }),
      );
    });
  });
});

describe("processWithdrawal", () => {
  it("marks the job done when Horizon reports confirmed", async () => {
    mockGetTxStatus.mockResolvedValueOnce("confirmed");

    await processWithdrawal("job-1", TX, "user-1", 100n);

    expect(mockJobUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "job-1" },
        data: expect.objectContaining({ status: "done" }),
      }),
    );
  });

  it("leaves the job processing (no refund) on not_found", async () => {
    mockGetTxStatus.mockResolvedValueOnce("not_found");

    await processWithdrawal("job-2", TX, "user-2", 100n);

    expect(mockJobUpdate).not.toHaveBeenCalled();
    expect(refundReversal).not.toHaveBeenCalled();
  });

  // #40 D2/D7: refunding a withdrawal that actually paid is a double pay.
  it("never refunds, fails or spends a retry on a Horizon read error", async () => {
    mockGetTxStatus.mockRejectedValueOnce(new Error("Horizon 503"));
    mockJobFindUnique.mockResolvedValue({ id: "job-4", retryCount: 2 });

    await processWithdrawal("job-4", TX, "user-4", 250n);

    expect(refundReversal).not.toHaveBeenCalled();
    for (const [call] of mockJobUpdate.mock.calls) {
      expect(call.data).not.toHaveProperty("retryCount");
      expect(call.data).not.toHaveProperty("status");
    }
    expect(mockJobUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "job-4" },
        data: { lastError: expect.stringContaining("Horizon 503") },
      }),
    );
  });

  it("refunds and fails the job once the retry budget is exhausted on failed", async () => {
    mockGetTxStatus.mockResolvedValueOnce("failed");
    mockJobFindUnique.mockResolvedValueOnce({ id: "job-3", retryCount: 2 });

    await processWithdrawal("job-3", TX, "user-3", 250n);

    expect(mockJobUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "job-3" },
        data: expect.objectContaining({ status: "failed" }),
      }),
    );
    expect(refundReversal).toHaveBeenCalledWith(
      "user-3",
      250n,
      "job-3",
      expect.any(String),
    );
  });
});
