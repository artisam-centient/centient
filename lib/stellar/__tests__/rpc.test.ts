import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Networks } from "@stellar/stellar-sdk";
import {
  DEFAULT_RPC_TIMEOUT_MS,
  StellarRpcError,
  TESTNET_RPC_URL,
  checkRpcHealth,
  createRpcClient,
  mapRpcError,
  rpcTimeoutMs,
  rpcUrl,
  type RpcTransport,
} from "@/lib/stellar/rpc";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  delete process.env.STELLAR_NETWORK;
  delete process.env.STELLAR_RPC_URL;
  delete process.env.STELLAR_RPC_TIMEOUT_MS;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.useRealTimers();
});

/** A transport that answers like testnet RPC, with any method overridable. */
function fakeTransport(overrides: Partial<Record<keyof RpcTransport, () => Promise<unknown>>> = {}) {
  const base = {
    getHealth: async () => ({
      status: "healthy",
      latestLedger: 1_200_000,
      oldestLedger: 1_079_041,
      ledgerRetentionWindow: 120_960,
    }),
    getLatestLedger: async () => ({
      id: "abc",
      sequence: 1_200_001,
      protocolVersion: "23",
      closeTime: "1764000000",
    }),
    getNetwork: async () => ({ passphrase: Networks.TESTNET, protocolVersion: "23" }),
  };
  return { ...base, ...overrides } as unknown as RpcTransport;
}

/** An Error shaped like the SDK fetch client's non-2xx failure. */
function httpError(status: number): Error {
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    response: { status, statusText: "", data: {} },
  });
}

describe("rpcUrl", () => {
  it("defaults to SDF's testnet RPC", () => {
    expect(rpcUrl({}, "testnet")).toBe(TESTNET_RPC_URL);
  });

  it("takes STELLAR_RPC_URL over the default", () => {
    expect(rpcUrl({ STELLAR_RPC_URL: " https://rpc.example.com/v1 " }, "testnet")).toBe(
      "https://rpc.example.com/v1",
    );
  });

  it("has no default on the public network", () => {
    expect(() => rpcUrl({}, "public")).toThrow(/required on the public network/);
    expect(rpcUrl({ STELLAR_RPC_URL: "https://mainnet.example.com" }, "public")).toBe(
      "https://mainnet.example.com",
    );
  });

  it("allows plain http only for localhost", () => {
    expect(rpcUrl({ STELLAR_RPC_URL: "http://localhost:8000/rpc" }, "testnet")).toBe(
      "http://localhost:8000/rpc",
    );
    expect(() => rpcUrl({ STELLAR_RPC_URL: "http://rpc.example.com" }, "testnet")).toThrow(/https/);
    expect(() => rpcUrl({ STELLAR_RPC_URL: "not a url" }, "testnet")).toThrow(/valid URL/);
  });

  it("never quotes the URL in its errors", () => {
    expect(() => rpcUrl({ STELLAR_RPC_URL: "http://rpc.example.com/key-SECRET" }, "testnet")).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining("SECRET") }),
    );
  });
});

describe("rpcTimeoutMs", () => {
  it("defaults, and ignores values that aren't positive integers", () => {
    expect(rpcTimeoutMs({})).toBe(DEFAULT_RPC_TIMEOUT_MS);
    expect(rpcTimeoutMs({ STELLAR_RPC_TIMEOUT_MS: "2500" })).toBe(2500);
    for (const bad of ["0", "-1", "abc", "1.5"]) {
      expect(rpcTimeoutMs({ STELLAR_RPC_TIMEOUT_MS: bad })).toBe(DEFAULT_RPC_TIMEOUT_MS);
    }
  });
});

describe("mapRpcError", () => {
  it("maps a JSON-RPC error object, retrying only server-side codes", () => {
    const internal = mapRpcError({ code: -32603, message: "internal" }, "getHealth");
    expect(internal).toMatchObject({ code: "rpc", rpcCode: -32603, retryable: true });
    const badParams = mapRpcError({ code: -32602, message: "invalid params" }, "getHealth");
    expect(badParams).toMatchObject({ code: "rpc", rpcCode: -32602, retryable: false });
  });

  it("maps HTTP statuses: 429 and 5xx retry, other 4xx don't", () => {
    expect(mapRpcError(httpError(503), "m")).toMatchObject({ code: "http", status: 503, retryable: true });
    expect(mapRpcError(httpError(429), "m")).toMatchObject({ code: "http", status: 429, retryable: true });
    expect(mapRpcError(httpError(404), "m")).toMatchObject({ code: "http", status: 404, retryable: false });
  });

  it("maps the SDK's timeout and abort errors to timeout", () => {
    expect(mapRpcError(new Error("timeout of 10000ms exceeded"), "m").code).toBe("timeout");
    const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
    expect(mapRpcError(abort, "m").code).toBe("timeout");
  });

  it("maps anything else to a retryable network error without its message", () => {
    const mapped = mapRpcError(new TypeError("fetch failed: https://rpc.example.com/key-SECRET"), "m");
    expect(mapped).toMatchObject({ code: "network", retryable: true });
    expect(mapped.message).not.toContain("SECRET");
  });

  it("passes a StellarRpcError through unchanged", () => {
    const original = new StellarRpcError("wrong_network", "getNetwork", "x", { retryable: false });
    expect(mapRpcError(original, "other")).toBe(original);
  });
});

describe("createRpcClient", () => {
  it("reads health, the latest ledger and the network", async () => {
    const client = createRpcClient({ transport: fakeTransport(), expectedPassphrase: Networks.TESTNET });
    await expect(client.getHealth()).resolves.toEqual({
      latestLedger: 1_200_000,
      oldestLedger: 1_079_041,
      ledgerRetentionWindow: 120_960,
    });
    await expect(client.getLatestLedger()).resolves.toEqual({
      sequence: 1_200_001,
      protocolVersion: 23,
      closeTime: "1764000000",
    });
    await expect(client.getNetwork()).resolves.toEqual({
      passphrase: Networks.TESTNET,
      protocolVersion: 23,
    });
  });

  it("times out a call that never answers", async () => {
    vi.useFakeTimers();
    const client = createRpcClient({
      transport: fakeTransport({ getLatestLedger: () => new Promise(() => {}) }),
      timeoutMs: 1_000,
    });
    const pending = client.getLatestLedger();
    const assertion = expect(pending).rejects.toMatchObject({
      name: "StellarRpcError",
      code: "timeout",
      method: "getLatestLedger",
      retryable: true,
    });
    await vi.advanceTimersByTimeAsync(1_000);
    await assertion;
  });

  it("does not time out a call that answers inside the deadline", async () => {
    vi.useFakeTimers();
    const client = createRpcClient({
      transport: fakeTransport({
        getLatestLedger: () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ sequence: 7, protocolVersion: 23, closeTime: "1" }), 999),
          ),
      }),
      timeoutMs: 1_000,
    });
    const pending = client.getLatestLedger();
    await vi.advanceTimersByTimeAsync(999);
    await expect(pending).resolves.toMatchObject({ sequence: 7 });
  });

  it("surfaces an RPC error as a StellarRpcError", async () => {
    const client = createRpcClient({
      transport: fakeTransport({ getHealth: () => Promise.reject({ code: -32603, message: "boom" }) }),
    });
    await expect(client.getHealth()).rejects.toMatchObject({ code: "rpc", method: "getHealth" });
  });

  it("refuses an endpoint on another network", async () => {
    const client = createRpcClient({
      transport: fakeTransport({
        getNetwork: async () => ({ passphrase: Networks.PUBLIC, protocolVersion: "23" }),
      }),
      expectedPassphrase: Networks.TESTNET,
    });
    await expect(client.getNetwork()).rejects.toMatchObject({ code: "wrong_network", retryable: false });
  });

  it("rejects answers that aren't the promised shape", async () => {
    const client = createRpcClient({
      transport: fakeTransport({
        getHealth: async () => ({ status: "unhealthy" }),
        getLatestLedger: async () => ({ sequence: "12", protocolVersion: 23 }),
      }),
    });
    await expect(client.getHealth()).rejects.toMatchObject({ code: "invalid_response" });
    await expect(client.getLatestLedger()).rejects.toMatchObject({ code: "invalid_response" });
  });
});

describe("checkRpcHealth", () => {
  it("reports a healthy endpoint with its ledger and latency", async () => {
    let t = 1_000;
    const check = await checkRpcHealth({ transport: fakeTransport(), now: () => (t += 40) });
    expect(check).toEqual({
      status: "healthy",
      network: "testnet",
      latestLedger: 1_200_001,
      oldestLedger: 1_079_041,
      ledgerRetentionWindow: 120_960,
      protocolVersion: 23,
      ledgerCloseTime: "1764000000",
      latencyMs: 40,
    });
  });

  it("reports a failure instead of throwing", async () => {
    const check = await checkRpcHealth({
      transport: fakeTransport({ getHealth: () => Promise.reject(httpError(502)) }),
    });
    expect(check).toMatchObject({
      status: "error",
      network: "testnet",
      error: { code: "http", method: "getHealth", retryable: true },
    });
  });

  it("reports a missing mainnet RPC URL as a config error", async () => {
    process.env.STELLAR_NETWORK = "public";
    const check = await checkRpcHealth();
    expect(check).toMatchObject({
      status: "error",
      network: "public",
      error: { code: "config", retryable: false },
    });
  });
});
