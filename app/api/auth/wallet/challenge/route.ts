import { NextRequest, NextResponse } from "next/server";
import { isValidStellarAddress } from "@/lib/stellar/signature";
import { issueSignInChallenge } from "@/lib/stellar/auth-challenge";
import { checkWalletRateLimit } from "@/lib/rate-limit";

function clientIp(req: NextRequest): string {
  // x-real-ip is set by Railway's proxy and cannot be overridden by the client;
  // the first x-forwarded-for entry can. Same reasoning as /api/auth/login.
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * POST /api/auth/wallet/challenge — issue a one-time wallet sign-in challenge (#25).
 *
 * Public: a contributor has no session yet. The response carries the exact text
 * to sign with Freighter's `signMessage`; the proof goes to
 * `/api/auth/wallet/verify`, within five minutes, once.
 *
 * Two throttles, because the endpoint writes a row and needs no session: per
 * address, which bounds churn on one address, and per IP, which bounds a caller
 * looping fresh addresses.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const address =
    body && typeof body === "object" && typeof (body as { address?: unknown }).address === "string"
      ? (body as { address: string }).address
      : "";

  // No normalization: StrKey is case-sensitive, so a lowercased key is refused.
  if (!isValidStellarAddress(address)) {
    return NextResponse.json({ error: "invalid_address" }, { status: 400 });
  }

  if (await checkWalletRateLimit(`auth-challenge-ip:${clientIp(req)}`)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  if (await checkWalletRateLimit(`auth-challenge:${address}`)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const challenge = await issueSignInChallenge(address);
  return NextResponse.json({
    nonce: challenge.nonce,
    message: challenge.message,
    expiresAt: challenge.expiresAt.toISOString(),
  });
}
