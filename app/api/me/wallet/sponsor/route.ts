import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getLabelerSession, requireLabelerSession } from "@/lib/labeler-auth";
import { isValidStellarAddress } from "@/lib/stellar/signature";
import {
  accountHasUsdcTrustline,
  buildSponsoredTrustlineTx,
  getTxStatus,
  prepareSponsoredTrustline,
  StellarPaymentError,
  type PreparedSponsorship,
} from "@/lib/stellar/client";
import { checkWalletRateLimit } from "@/lib/rate-limit";
import {
  checkSponsorAllowed,
  confirmSponsorship,
  failSponsorship,
  livePendingSponsorship,
  openSponsorshipIntent,
  type SponsorshipIntentDecision,
} from "@/lib/sponsored-trustline";

/**
 * ST-4e (#314) — platform-sponsored USDC trustlines (CAP-33).
 *
 *   GET  ?address → { needed:false } if the address already trusts USDC, else
 *                   { needed:true, xdr, kind } — a platform-signed sponsored
 *                   `changeTrust` (+ `createAccount` if the account is unfunded)
 *                   for the wallet to co-sign.
 *   POST { address, signedXdr } → submit the recipient-co-signed tx; the labeler
 *                   pays 0 XLM (the platform sponsors the reserves).
 *
 * Replaces ST-4b's hard `no_trustline` reject with an in-app funded flow. StrKey
 * is case-sensitive — the address is never lowercased.
 *
 * #27 — POST records a pending sponsorship before broadcasting, and answers only
 * what it knows. `retry` means the envelope provably cannot land, so the client
 * may rebuild. A submit whose outcome is unknown answers 202 `pending` and keeps
 * the row, because rebuilding then could sponsor the address twice.
 */
export async function GET(req: NextRequest) {
  const userId = await getLabelerSession(req);
  const unauthorized = requireLabelerSession(userId);
  if (unauthorized) return unauthorized;

  const address = req.nextUrl.searchParams.get("address");
  if (!address || !isValidStellarAddress(address)) {
    return NextResponse.json({ error: "invalid_address" }, { status: 400 });
  }

  // Per-user throttle: the per-address limiter below gives no per-user bound — a
  // labeler could loop fresh keypairs to bypass it. This session-keyed check is a
  // stopgap; a proper cap on outstanding sponsorships per labeler is tracked as a
  // follow-up before ST-7 mainnet (issue link will be added).
  if (await checkWalletRateLimit(`sponsor-get:${userId}`)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  if (await checkWalletRateLimit(`sponsor-build:${address}`)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  try {
    if (await accountHasUsdcTrustline(address)) {
      return NextResponse.json({ needed: false });
    }
    // #330: bound outstanding sponsorships per user (a session-keyed rate throttle
    // caps *rate*, not *total outstanding* — a labeler could loop fresh keypairs to
    // drain platform reserves). Gate before building so an over-cap user never even
    // receives an XDR. Only reached when a sponsorship would actually be created
    // (needed=true), so re-linking an already-trusting address never consumes it.
    const gate = await checkSponsorAllowed(userId!, address);
    if (!gate.ok) return gateRefusal(gate.reason);
    // #27: don't ask for a signature on an envelope POST would refuse to send.
    if (await livePendingSponsorship(address)) {
      return NextResponse.json({ error: "submission_pending" }, { status: 409 });
    }
    const { xdr, kind } = await buildSponsoredTrustlineTx(address);
    return NextResponse.json({ needed: true, xdr, kind });
  } catch (err) {
    if (err instanceof StellarPaymentError && err.code === "sponsor_low_reserve") {
      Sentry.captureException(err, { extra: { context: "sponsor-trustline-low-reserve", userId } });
      return NextResponse.json({ error: "sponsorship_unavailable" }, { status: 503 });
    }
    Sentry.captureException(err, { extra: { context: "sponsor-trustline-build", userId } });
    return NextResponse.json({ error: "build_failed" }, { status: 502 });
  }
}

/**
 * Submit a recipient-co-signed sponsorship envelope. Validates it, records the
 * intent, broadcasts, then settles the row with whatever Horizon actually said.
 */
export async function POST(req: NextRequest) {
  const userId = await getLabelerSession(req);
  const unauthorized = requireLabelerSession(userId);
  if (unauthorized) return unauthorized;

  let body: { address?: unknown; signedXdr?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const address = typeof body.address === "string" ? body.address : "";
  const signedXdr = typeof body.signedXdr === "string" ? body.signedXdr : "";
  if (!isValidStellarAddress(address)) {
    return NextResponse.json({ error: "invalid_address" }, { status: 400 });
  }
  if (!signedXdr) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  // Per-user throttle: the per-address limiter does not exist on POST (no address
  // check on the build step here), so a labeler could loop fresh keypairs to
  // submit unlimited sponsorship txs. This session-keyed check is a stopgap; a
  // proper cap on outstanding sponsorships per labeler is tracked as a follow-up
  // before ST-7 mainnet (issue link will be added).
  if (await checkWalletRateLimit(`sponsor-submit:${userId}`)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  // #330: per-user outstanding cap + cross-user address lock, re-checked here
  // (not just at build) so a client that skips GET can't bypass it.
  const gate = await checkSponsorAllowed(userId!, address);
  if (!gate.ok) return gateRefusal(gate.reason);

  let prepared: PreparedSponsorship;
  try {
    prepared = prepareSponsoredTrustline(signedXdr, address);
  } catch (err) {
    if (err instanceof StellarPaymentError && err.code === "invalid_sponsor_tx") {
      return NextResponse.json({ error: "invalid_sponsor_tx" }, { status: 400 });
    }
    Sentry.captureException(err, { extra: { context: "sponsor-trustline-prepare", userId } });
    return NextResponse.json({ error: "submit_failed" }, { status: 502 });
  }

  // Written BEFORE the irreversible step. If this fails, nothing is broadcast.
  let decision: SponsorshipIntentDecision;
  try {
    decision = await openSponsorshipIntent(
      {
        userId: userId!,
        address,
        kind: prepared.kind,
        txHash: prepared.hash,
        expiresAt: prepared.expiresAt,
      },
      { txStatus: getTxStatus },
    );
  } catch (err) {
    Sentry.captureException(err, { extra: { context: "sponsor-intent", userId, address } });
    return NextResponse.json({ error: "submit_failed" }, { status: 502 });
  }

  switch (decision.action) {
    case "address_in_use":
      return NextResponse.json({ error: "address_in_use" }, { status: 409 });
    case "already_confirmed":
      return established();
    case "prior_pending":
      return NextResponse.json({ error: "submission_pending" }, { status: 409 });
  }

  const settle = { id: decision.id, hash: prepared.hash, userId: userId!, address };
  try {
    await prepared.submit();
  } catch (err) {
    return settleFailedSubmit(err, settle);
  }
  await confirm(settle);
  return established();
}

/** The #330 gate's refusal: 429 at the cap, 409 when another user holds the address. */
function gateRefusal(reason: "cap_reached" | "address_sponsored_by_other") {
  return NextResponse.json(
    { error: reason === "cap_reached" ? "sponsorship_cap_reached" : "address_in_use" },
    { status: reason === "cap_reached" ? 429 : 409 },
  );
}

/** The address holds its sponsored account and trustline. */
function established() {
  return NextResponse.json({ established: true });
}

type Settle = { id: string; hash: string; userId: string; address: string };

/**
 * Answer a broadcast that threw, settling the intent only on a definite result.
 * `tx_bad_seq` and an unknown outcome are both resolved by asking Horizon about
 * the hash: a stale sequence can only belong to an envelope that already landed,
 * and a timed-out one may land yet.
 */
async function settleFailedSubmit(err: unknown, settle: Settle): Promise<NextResponse> {
  const code = err instanceof StellarPaymentError ? err.code : "submission_unknown";

  if (code === "op_low_reserve") {
    await release(settle);
    Sentry.captureException(err, { extra: { context: "sponsor-trustline-submit", userId: settle.userId } });
    return NextResponse.json({ error: "sponsorship_unavailable" }, { status: 503 });
  }
  if (code !== "tx_bad_seq" && code !== "submission_unknown") {
    await release(settle);
    Sentry.captureException(err, { extra: { context: "sponsor-trustline-submit", userId: settle.userId } });
    return NextResponse.json({ error: "submit_failed" }, { status: 502 });
  }

  let status: Awaited<ReturnType<typeof getTxStatus>>;
  try {
    status = await getTxStatus(settle.hash);
  } catch (lookupErr) {
    Sentry.captureException(lookupErr, { extra: { context: "sponsor-status-lookup", ...settle } });
    return pending();
  }

  if (status === "confirmed") {
    await confirm(settle);
    return established();
  }
  if (code === "tx_bad_seq") {
    await release(settle);
    return NextResponse.json({ error: "retry" }, { status: 409 });
  }
  if (status === "failed") {
    await release(settle);
    Sentry.captureException(err, { extra: { context: "sponsor-trustline-submit", userId: settle.userId } });
    return NextResponse.json({ error: "submit_failed" }, { status: 502 });
  }
  Sentry.captureException(err, { extra: { context: "sponsor-submission-unknown", ...settle } });
  return pending();
}

/** The envelope may still land. The pending row stays, and counts, until it is resolved. */
function pending() {
  return NextResponse.json({ established: false, pending: true }, { status: 202 });
}

/**
 * Best-effort: the sponsorship is on-chain whether or not this write lands. A
 * row left pending still counts against the cap and can be reconciled by hash.
 */
async function confirm(settle: Settle): Promise<void> {
  try {
    await confirmSponsorship(settle.id, settle.hash);
  } catch (err) {
    Sentry.captureException(err, { extra: { context: "sponsor-confirm", ...settle } });
  }
}

/** Best-effort: a row left pending only over-counts until its envelope expires. */
async function release(settle: Settle): Promise<void> {
  try {
    await failSponsorship(settle.id, settle.hash);
  } catch (err) {
    Sentry.captureException(err, { extra: { context: "sponsor-release", ...settle } });
  }
}
