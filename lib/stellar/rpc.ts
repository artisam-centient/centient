// Stellar RPC: the one server-side client for Soroban reads (M2-P2, #244).
//
// Horizon (config.ts) stays the source for classic accounts and payouts. Stellar
// RPC is what Soroban needs: contract state, simulation, events and the ledger
// clock. Every Month 2 feature that reads the chain through RPC (the event
// indexer, tranche release, export anchoring, the signer monitor and the proof
// page) builds on this module, so the timeout and the error vocabulary are
// settled once here.
//
// It reads only. Nothing in this file signs or submits a transaction.
import { rpc } from "@stellar/stellar-sdk";
import { networkPassphrase, stellarNetwork, type StellarNetwork } from "@/lib/stellar/config";

type Env = Readonly<Record<string, string | undefined>>;

/** SDF's public testnet RPC. There is no SDF mainnet RPC: public needs a provider. */
export const TESTNET_RPC_URL = "https://soroban-testnet.stellar.org";

export const DEFAULT_RPC_TIMEOUT_MS = 10_000;

/**
 * The RPC endpoint. `STELLAR_RPC_URL` overrides the testnet default. On the
 * public network there is no default, so an unset URL fails here instead of
 * quietly reading testnet state on a mainnet deployment.
 */
export function rpcUrl(env: Env = process.env, network: StellarNetwork = stellarNetwork()): string {
  const override = env.STELLAR_RPC_URL?.trim();
  if (override) {
    let parsed: URL;
    try {
      parsed = new URL(override);
    } catch {
      throw new Error("STELLAR_RPC_URL is not a valid URL");
    }
    if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && isLoopback(parsed))) {
      throw new Error("STELLAR_RPC_URL must use https (http is allowed only for localhost)");
    }
    return override;
  }
  if (network === "public") {
    throw new Error("STELLAR_RPC_URL is required on the public network");
  }
  return TESTNET_RPC_URL;
}

/**
 * Deadline for one RPC call, from `STELLAR_RPC_TIMEOUT_MS`. The SDK waits
 * forever by default, which would let a stalled RPC hang a cron route or a page.
 */
export function rpcTimeoutMs(env: Env = process.env): number {
  const value = Number(env.STELLAR_RPC_TIMEOUT_MS ?? DEFAULT_RPC_TIMEOUT_MS);
  return Number.isSafeInteger(value) && value > 0 ? value : DEFAULT_RPC_TIMEOUT_MS;
}

function isLoopback(url: URL): boolean {
  return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
}

// --- errors -------------------------------------------------------------------

export type RpcErrorCode =
  /** No answer within the deadline. */
  | "timeout"
  /** The request never got an HTTP answer (DNS, refused, reset). */
  | "network"
  /** An HTTP status other than 2xx. */
  | "http"
  /** A JSON-RPC error object in a 200 answer. */
  | "rpc"
  /** An answer that isn't the shape the method promises. */
  | "invalid_response"
  /** The endpoint serves a different network than STELLAR_NETWORK. */
  | "wrong_network";

/**
 * Every failure this client raises. `retryable` says whether the same call may
 * succeed if tried again later; callers decide whether and when.
 *
 * The message never carries the RPC URL: provider URLs often embed an API key.
 */
export class StellarRpcError extends Error {
  readonly code: RpcErrorCode;
  readonly method: string;
  readonly retryable: boolean;
  readonly status?: number;
  readonly rpcCode?: number;

  constructor(
    code: RpcErrorCode,
    method: string,
    message: string,
    options: { retryable: boolean; status?: number; rpcCode?: number },
  ) {
    super(`Stellar RPC ${method}: ${message}`);
    this.name = "StellarRpcError";
    this.code = code;
    this.method = method;
    this.retryable = options.retryable;
    this.status = options.status;
    this.rpcCode = options.rpcCode;
  }
}

/** JSON-RPC 2.0 server-side codes worth a retry: internal error and the -32000..-32099 range. */
function retryableRpcCode(code: number): boolean {
  return code === -32603 || (code <= -32000 && code >= -32099);
}

/**
 * Map whatever the SDK threw onto one {@link StellarRpcError}.
 *
 * The SDK's fetch client throws an `Error` with `response.status` for a non-2xx
 * answer and `timeout of Nms exceeded` on its own deadline; its JSON-RPC layer
 * throws the raw `{ code, message }` error object from the response body.
 */
export function mapRpcError(error: unknown, method: string): StellarRpcError {
  if (error instanceof StellarRpcError) return error;

  if (isJsonRpcError(error)) {
    return new StellarRpcError("rpc", method, `RPC error ${error.code}: ${error.message}`, {
      retryable: retryableRpcCode(error.code),
      rpcCode: error.code,
    });
  }

  const status = httpStatus(error);
  if (status !== undefined) {
    return new StellarRpcError("http", method, `HTTP ${status}`, {
      retryable: status === 408 || status === 429 || status >= 500,
      status,
    });
  }

  const message = error instanceof Error ? error.message : String(error);
  const name = error instanceof Error ? error.name : "";
  if (/timeout|timed out/i.test(message) || name === "TimeoutError") {
    return new StellarRpcError("timeout", method, "timed out", { retryable: true });
  }
  if (name === "AbortError") {
    return new StellarRpcError("timeout", method, "aborted", { retryable: true });
  }
  return new StellarRpcError("network", method, `request failed (${name || "Error"})`, {
    retryable: true,
  });
}

function isJsonRpcError(value: unknown): value is { code: number; message: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    !(value instanceof Error) &&
    typeof (value as { code?: unknown }).code === "number" &&
    typeof (value as { message?: unknown }).message === "string"
  );
}

function httpStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const status = (error as { response?: { status?: unknown } }).response?.status;
  return typeof status === "number" ? status : undefined;
}

// --- client -------------------------------------------------------------------

/** The slice of `rpc.Server` this client uses, so tests can stand in for it. */
export interface RpcTransport {
  getHealth(): Promise<rpc.Api.GetHealthResponse>;
  getLatestLedger(): Promise<rpc.Api.GetLatestLedgerResponse>;
  getNetwork(): Promise<rpc.Api.GetNetworkResponse>;
}

export interface LatestLedger {
  sequence: number;
  protocolVersion: number;
  closeTime: string;
}

export interface RpcHealth {
  latestLedger: number;
  oldestLedger: number;
  ledgerRetentionWindow: number;
}

export interface RpcNetworkInfo {
  passphrase: string;
  protocolVersion: number;
}

export interface StellarRpcClient {
  getHealth(): Promise<RpcHealth>;
  getLatestLedger(): Promise<LatestLedger>;
  getNetwork(): Promise<RpcNetworkInfo>;
}

export interface RpcClientOptions {
  transport?: RpcTransport;
  timeoutMs?: number;
  /** The passphrase the endpoint must report. Defaults to the active network's. */
  expectedPassphrase?: string;
  env?: Env;
}

/**
 * A Stellar RPC client for the active network. Each call is bounded by
 * {@link rpcTimeoutMs} (also passed to the SDK), and every failure surfaces as
 * a {@link StellarRpcError}.
 */
export function createRpcClient(options: RpcClientOptions = {}): StellarRpcClient {
  const env = options.env ?? process.env;
  const timeoutMs = options.timeoutMs ?? rpcTimeoutMs(env);
  const transport = options.transport ?? defaultTransport(env, timeoutMs);
  const expectedPassphrase = options.expectedPassphrase ?? networkPassphrase();

  const call = <T>(method: string, run: () => Promise<T>): Promise<T> =>
    withDeadline(method, timeoutMs, run);

  return {
    async getHealth() {
      const health = await call("getHealth", () => transport.getHealth());
      if (health?.status !== "healthy") {
        throw new StellarRpcError("invalid_response", "getHealth", `status ${String(health?.status)}`, {
          retryable: true,
        });
      }
      return {
        latestLedger: requireLedger(health.latestLedger, "getHealth", "latestLedger"),
        oldestLedger: requireLedger(health.oldestLedger, "getHealth", "oldestLedger"),
        ledgerRetentionWindow: requireLedger(
          health.ledgerRetentionWindow,
          "getHealth",
          "ledgerRetentionWindow",
        ),
      };
    },

    async getLatestLedger() {
      const ledger = await call("getLatestLedger", () => transport.getLatestLedger());
      return {
        sequence: requireLedger(ledger?.sequence, "getLatestLedger", "sequence"),
        protocolVersion: requireProtocol(ledger?.protocolVersion, "getLatestLedger"),
        closeTime: typeof ledger?.closeTime === "string" ? ledger.closeTime : "",
      };
    },

    async getNetwork() {
      const network = await call("getNetwork", () => transport.getNetwork());
      if (typeof network?.passphrase !== "string") {
        throw new StellarRpcError("invalid_response", "getNetwork", "no passphrase", {
          retryable: false,
        });
      }
      if (network.passphrase !== expectedPassphrase) {
        throw new StellarRpcError(
          "wrong_network",
          "getNetwork",
          "endpoint serves a different network than STELLAR_NETWORK",
          { retryable: false },
        );
      }
      return {
        passphrase: network.passphrase,
        protocolVersion: requireProtocol(network.protocolVersion, "getNetwork"),
      };
    },
  };
}

function defaultTransport(env: Env, timeoutMs: number): RpcTransport {
  const url = rpcUrl(env);
  return new rpc.Server(url, { timeout: timeoutMs, allowHttp: url.startsWith("http://") });
}

/**
 * Run one call under a hard deadline. The SDK's own timeout covers the HTTP
 * request; this one also covers anything after it, and maps every failure.
 */
async function withDeadline<T>(method: string, timeoutMs: number, run: () => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new StellarRpcError("timeout", method, `no answer in ${timeoutMs} ms`, { retryable: true })),
      timeoutMs,
    );
  });
  try {
    return await Promise.race([run(), deadline]);
  } catch (error) {
    throw mapRpcError(error, method);
  } finally {
    clearTimeout(timer);
  }
}

function requireLedger(value: unknown, method: string, field: string): number {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return value;
  throw new StellarRpcError("invalid_response", method, `invalid ${field}`, { retryable: false });
}

/** RPC reports the protocol version as a number or a numeric string, depending on the method. */
function requireProtocol(value: unknown, method: string): number {
  const n = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  if (typeof n === "number" && Number.isSafeInteger(n) && n > 0) return n;
  throw new StellarRpcError("invalid_response", method, "invalid protocolVersion", {
    retryable: false,
  });
}

// --- health check -------------------------------------------------------------

export type RpcCheck =
  | {
      status: "healthy";
      network: StellarNetwork;
      latestLedger: number;
      oldestLedger: number;
      ledgerRetentionWindow: number;
      protocolVersion: number;
      ledgerCloseTime: string;
      latencyMs: number;
    }
  | {
      status: "error";
      network: StellarNetwork;
      error: { code: RpcErrorCode | "config"; method: string; retryable: boolean };
      latencyMs: number;
    };

/**
 * One health probe: `getHealth`, `getLatestLedger` and `getNetwork` together.
 * Never throws, so a status route or a monitor can always answer.
 */
export async function checkRpcHealth(
  options: RpcClientOptions & { now?: () => number } = {},
): Promise<RpcCheck> {
  const now = options.now ?? Date.now;
  const started = now();
  let network: StellarNetwork = "testnet";
  try {
    network = stellarNetwork();
    const client = createRpcClient(options);
    const [health, ledger, info] = await Promise.all([
      client.getHealth(),
      client.getLatestLedger(),
      client.getNetwork(),
    ]);
    return {
      status: "healthy",
      network,
      latestLedger: Math.max(health.latestLedger, ledger.sequence),
      oldestLedger: health.oldestLedger,
      ledgerRetentionWindow: health.ledgerRetentionWindow,
      protocolVersion: info.protocolVersion,
      ledgerCloseTime: ledger.closeTime,
      latencyMs: now() - started,
    };
  } catch (error) {
    const latencyMs = now() - started;
    if (error instanceof StellarRpcError) {
      return {
        status: "error",
        network,
        error: { code: error.code, method: error.method, retryable: error.retryable },
        latencyMs,
      };
    }
    // Config errors (a bad STELLAR_RPC_URL or STELLAR_NETWORK) land here.
    return {
      status: "error",
      network,
      error: { code: "config", method: "config", retryable: false },
      latencyMs,
    };
  }
}
