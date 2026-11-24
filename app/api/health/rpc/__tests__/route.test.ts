import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCheck } = vi.hoisted(() => ({ mockCheck: vi.fn() }));

vi.mock("@/lib/stellar/rpc", () => ({ checkRpcHealth: mockCheck }));

import { GET } from "../route";

beforeEach(() => {
  mockCheck.mockReset();
});

describe("GET /api/health/rpc", () => {
  it("answers 200 with the check when RPC is healthy", async () => {
    const check = {
      status: "healthy",
      network: "testnet",
      latestLedger: 10,
      oldestLedger: 1,
      ledgerRetentionWindow: 9,
      protocolVersion: 23,
      ledgerCloseTime: "1",
      latencyMs: 5,
    };
    mockCheck.mockResolvedValue(check);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toEqual(check);
  });

  it("answers 503 when RPC is unreachable", async () => {
    mockCheck.mockResolvedValue({
      status: "error",
      network: "testnet",
      error: { code: "timeout", method: "getHealth", retryable: true },
      latencyMs: 10_000,
    });
    const res = await GET();
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ status: "error", error: { code: "timeout" } });
  });
});
