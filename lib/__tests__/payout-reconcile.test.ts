import { vi, describe, it, expect, beforeEach } from "vitest";

// #40: the one place a `sent` submission is settled against Horizon. These
// tests mock Horizon's `getTxStatus` ("confirmed" | "failed" | "not_found") and
// assert what each answer, or a read that throws, does to the row.
const {
  mockGetTxStatus,
  mockSubFindUnique,
  mockSubUpdate,
} = vi.hoisted(() => ({
  mockGetTxStatus: vi.fn(),
  mockSubFindUnique: vi.fn(),
  mockSubUpdate: vi.fn(),
}));

vi.mock("@/lib/stellar/client", () => ({
  getTxStatus: mockGetTxStatus,
}));

vi.mock("@sentry/nextjs", () => ({
  captureMessage: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    submission: { findUnique: mockSubFindUnique, update: mockSubUpdate },
  },
}));

import { reconcileSubmission } from "../payout-reconcile";
import * as Sentry from "@sentry/nextjs";

const TX = "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";

beforeEach(() => {
  vi.clearAllMocks();
  mockSubUpdate.mockResolvedValue({});
  mockSubFindUnique.mockResolvedValue({ id: "sub", retryCount: 0 });
});

describe("reconcileSubmission", () => {
  it("marks the submission confirmed when Horizon reports confirmed", async () => {
    mockGetTxStatus.mockResolvedValueOnce("confirmed");

    await reconcileSubmission("sub-1", TX);

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

    await reconcileSubmission("sub-2", TX);

    expect(mockSubUpdate).not.toHaveBeenCalled();
  });

  // "failed" (included and failed) hands the row back to the retry path; that
  // needs the attempts table and the retry cron, so it is tested against a real
  // database in payout-reconcile-db.test.ts.

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

      await reconcileSubmission("sub-5", TX);

      for (const [call] of mockSubUpdate.mock.calls) {
        expect(call.data).not.toHaveProperty("retryCount");
        expect(call.data).not.toHaveProperty("payoutStatus");
      }
    });

    it("does not mistake a database error after Horizon answered for a read error", async () => {
      mockGetTxStatus.mockResolvedValueOnce("confirmed");
      mockSubUpdate.mockRejectedValueOnce(new Error("connection reset"));

      await expect(reconcileSubmission("sub-7", TX)).rejects.toThrow("connection reset");
      expect(mockSubUpdate).toHaveBeenCalledTimes(1);
    });

    it("records the read error on the row", async () => {
      mockGetTxStatus.mockRejectedValueOnce(new Error("Horizon 503"));

      await reconcileSubmission("sub-6", TX);

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
      await reconcileSubmission("fresh", TX);
      expect(Sentry.captureMessage).not.toHaveBeenCalled();

      mockSubUpdate.mockResolvedValueOnce({ createdAt: new Date(Date.now() - 60 * 60_000) });
      await reconcileSubmission("stale", TX);
      expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        expect.stringContaining("stale"),
        expect.objectContaining({ fingerprint: expect.arrayContaining(["stale"]) }),
      );
    });
  });
});
