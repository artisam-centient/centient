import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { Keypair, Networks } from "@stellar/stellar-sdk";

vi.mock("@/lib/rate-limit", () => ({ checkWalletRateLimit: vi.fn(async () => false) }));

import { POST } from "@/app/api/auth/wallet/challenge/route";
import { checkWalletRateLimit } from "@/lib/rate-limit";
import { PROOF_ACTION, buildChallengeMessage } from "@/lib/stellar/challenge-message";
import { prisma, truncateAll } from "@/tests/helpers/db";

const IP = "203.0.113.7";
const ORIGINAL_NETWORK = process.env.STELLAR_NETWORK;

function makeReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/auth/wallet/challenge", {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": IP },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(async () => {
  process.env.STELLAR_NETWORK = "testnet";
  await truncateAll();
  vi.mocked(checkWalletRateLimit).mockReset().mockResolvedValue(false);
});

afterEach(() => {
  if (ORIGINAL_NETWORK === undefined) delete process.env.STELLAR_NETWORK;
  else process.env.STELLAR_NETWORK = ORIGINAL_NETWORK;
});

describe("POST /api/auth/wallet/challenge", () => {
  it("issues a challenge without any session", async () => {
    const address = Keypair.random().publicKey();

    const res = await POST(makeReq({ address }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.nonce).toMatch(/^[0-9a-f]{32}$/);

    const row = await prisma.walletNonce.findUniqueOrThrow({ where: { nonce: body.nonce } });
    expect(row.action).toBe(PROOF_ACTION);
    expect(body.expiresAt).toBe(row.expiresAt.toISOString());
    expect(body.message).toBe(
      buildChallengeMessage({
        address,
        networkPassphrase: Networks.TESTNET,
        nonce: body.nonce,
        issuedAt: row.issuedAt,
        expiresAt: row.expiresAt,
      }),
    );
  });

  it.each([
    ["a lowercased address", () => ({ address: Keypair.random().publicKey().toLowerCase() })],
    ["a non-StrKey address", () => ({ address: "0xdeadbeef" })],
    ["a missing address", () => ({})],
    ["a non-string address", () => ({ address: 42 })],
    ["a non-JSON body", () => "not json"],
  ])("400 invalid_address for %s, issuing nothing", async (_name, body) => {
    const res = await POST(makeReq(body()));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_address" });
    expect(await prisma.walletNonce.count()).toBe(0);
    expect(checkWalletRateLimit).not.toHaveBeenCalled();
  });

  it("429 when the caller's IP is throttled, issuing nothing", async () => {
    vi.mocked(checkWalletRateLimit).mockResolvedValueOnce(true);

    const res = await POST(makeReq({ address: Keypair.random().publicKey() }));

    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "rate_limited" });
    expect(checkWalletRateLimit).toHaveBeenCalledWith(`auth-challenge-ip:${IP}`);
    expect(await prisma.walletNonce.count()).toBe(0);
  });

  it("429 when the address is throttled, issuing nothing", async () => {
    const address = Keypair.random().publicKey();
    vi.mocked(checkWalletRateLimit).mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    const res = await POST(makeReq({ address }));

    expect(res.status).toBe(429);
    expect(checkWalletRateLimit).toHaveBeenCalledWith(`auth-challenge:${address}`);
    expect(await prisma.walletNonce.count()).toBe(0);
  });
});
