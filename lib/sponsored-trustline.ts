// ST-4e follow-up (#330) — bound platform-sponsored USDC trustlines per labeler.
//
// Each successful sponsorship (CAP-33) locks ~0.5 XLM (trustline) or ~1.5 XLM
// (account creation + trustline) of the pooled platform account's reserves on a
// recipient's behalf. The sponsor route authenticates the session but the only
// spend-shaped throttle is a per-address rate limit — a labeler can loop fresh
// keypairs to bypass it and drive the platform toward `op_low_reserve`, halting
// ALL real USDC payouts (an economic DoS on mainnet). Reserves are only
// recoverable by a revocation/reclaim job that does not exist yet.
//
// This module enforces two gates, backed by the `sponsored_trustlines` table:
//   1. a hard cap on OUTSTANDING sponsorships per user, and
//   2. a cross-user lock so an address already sponsored (outstanding) by one
//      user can't be re-sponsored by another.
//
// #27 adds the write order. A sponsorship is recorded as `pending` BEFORE its
// envelope is broadcast, because Horizon accepting it is irreversible while any
// write after it can still fail. "Outstanding" therefore means pending or
// confirmed and not revoked: a pending row's reserve may already be locked. A
// partial unique index allows one outstanding row per address, which makes the
// cross-user lock and duplicate protection hold under concurrency rather than
// only when requests happen to arrive one at a time.
//
// `address` is a case-sensitive `G…` StrKey and is never normalized/lowercased.
import prisma from "./prisma";

export type SponsorshipKind = "trustline" | "account+trustline";

/**
 * Base reserves a sponsorship locks on the sponsor: a sponsored account entry
 * takes two, a trustline one. Horizon's `num_sponsoring` counts the same units.
 */
export const SPONSORSHIP_RESERVE_UNITS: Readonly<Record<SponsorshipKind, number>> = {
  trustline: 1,
  "account+trustline": 3,
};

/** Rows whose reserve is, or may already be, locked on-chain. */
function outstanding() {
  return { revokedAt: null, status: { not: "failed" } };
}

/**
 * Max outstanding sponsored trustlines per labeler. A legitimate user links one
 * wallet and only occasionally re-links, so a small cap is ample; the default of
 * 2 leaves one headroom slot for a re-link before the old reserve is reclaimed.
 * Env-overridable so mainnet reserve sizing can be tuned without a deploy.
 */
export function sponsorMaxOutstanding(): number {
  const raw = Number(process.env.SPONSOR_MAX_OUTSTANDING ?? "2");
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 2;
}

/**
 * Count of this user's sponsorships whose reserves are, or may be, locked.
 * `exceptAddress` leaves one address out, so a retry for an address the user
 * already holds a pending row for is not counted against itself.
 */
export function countOutstandingSponsorships(userId: string, exceptAddress?: string): Promise<number> {
  return prisma.sponsoredTrustline.count({
    where: {
      userId,
      ...outstanding(),
      ...(exceptAddress ? { address: { not: exceptAddress } } : {}),
    },
  });
}

/** True iff `address` has an outstanding sponsorship owned by a *different* user. */
export async function addressSponsoredByOther(
  address: string,
  userId: string,
): Promise<boolean> {
  const row = await prisma.sponsoredTrustline.findFirst({
    where: { address, ...outstanding(), userId: { not: userId } },
    select: { id: true },
  });
  return row !== null;
}

export type SponsorGateResult =
  | { ok: true }
  | { ok: false; reason: "cap_reached" | "address_sponsored_by_other" };

/**
 * Pre-submit gate. Rejects when the address is already sponsored (outstanding)
 * by another user, or when this user already holds the cap's worth of
 * sponsorships for other addresses. Checked at both the build (GET) and submit
 * (POST) steps so an over-cap user never even receives an XDR. It reads before
 * it writes, so it is a courtesy under concurrency: the unique index behind
 * {@link openSponsorshipIntent} is what actually holds the address lock.
 */
export async function checkSponsorAllowed(
  userId: string,
  address: string,
): Promise<SponsorGateResult> {
  if (await addressSponsoredByOther(address, userId)) {
    return { ok: false, reason: "address_sponsored_by_other" };
  }
  if ((await countOutstandingSponsorships(userId, address)) >= sponsorMaxOutstanding()) {
    return { ok: false, reason: "cap_reached" };
  }
  return { ok: true };
}

/**
 * True while an earlier envelope for `address` is pending and could still land.
 * The build step uses it so a contributor is not asked to sign a second
 * envelope that the submit step would then refuse.
 */
export async function livePendingSponsorship(address: string, now: Date = new Date()): Promise<boolean> {
  const row = await prisma.sponsoredTrustline.findFirst({
    where: { address, revokedAt: null, status: "pending", expiresAt: { gt: now } },
    select: { id: true },
  });
  return row !== null;
}

/** Horizon's view of a transaction hash — `getTxStatus` in production. */
export type TxStatusLookup = (hash: string) => Promise<"confirmed" | "failed" | "not_found">;

export interface SponsorshipIntent {
  userId: string;
  address: string;
  kind: SponsorshipKind;
  /** Hash of the exact envelope about to be broadcast. */
  txHash: string;
  /** The envelope's `maxTime`; after it the envelope can no longer apply. */
  expiresAt: Date;
}

export type SponsorshipIntentDecision =
  /** Broadcast the envelope; settle row `id` with the result. */
  | { action: "submit"; id: string }
  /** This user's sponsorship of the address has already landed. Do not broadcast. */
  | { action: "already_confirmed" }
  /** An earlier envelope for the address could still land. Do not broadcast a second. */
  | { action: "prior_pending" }
  /** Another user holds the address. */
  | { action: "address_in_use" };

const INTENT_ATTEMPTS = 3;

/**
 * Record the intent to broadcast `intent.txHash`, and decide whether to.
 *
 * Re-broadcasting the identical envelope is safe — Horizon applies one hash at
 * most once — so a retry of the same hash is sent against the same row. A
 * *different* envelope for an address with a pending one is only allowed once
 * the earlier one provably cannot land: Horizon reports it failed, or it was
 * never seen and its time bound has passed. If Horizon shows the earlier one
 * landed, nothing new is broadcast.
 *
 * A unique violation means another request claimed the address between this
 * read and this write; the decision is simply taken again against what it wrote.
 * A failed Horizon lookup propagates without writing anything.
 */
export async function openSponsorshipIntent(
  intent: SponsorshipIntent,
  opts: { txStatus: TxStatusLookup; now?: Date },
): Promise<SponsorshipIntentDecision> {
  const now = opts.now ?? new Date();
  for (let attempt = 1; ; attempt++) {
    try {
      return await decideIntent(intent, opts.txStatus, now);
    } catch (err) {
      if (!isUniqueViolation(err) || attempt >= INTENT_ATTEMPTS) throw err;
    }
  }
}

async function decideIntent(
  intent: SponsorshipIntent,
  txStatus: TxStatusLookup,
  now: Date,
): Promise<SponsorshipIntentDecision> {
  const current = await prisma.sponsoredTrustline.findFirst({
    where: { address: intent.address, ...outstanding() },
  });
  if (!current) return { action: "submit", id: await createPending(intent) };
  if (current.userId !== intent.userId) return { action: "address_in_use" };
  if (current.status === "confirmed") return { action: "already_confirmed" };
  if (current.txHash === intent.txHash) return { action: "submit", id: current.id };

  const prior = await txStatus(current.txHash);
  if (prior === "confirmed") {
    await confirmSponsorship(current.id, current.txHash);
    return { action: "already_confirmed" };
  }
  // A pending row always carries an expiry; one without is treated as expired
  // rather than blocking the address forever.
  const expired = !current.expiresAt || current.expiresAt.getTime() < now.getTime();
  if (prior === "not_found" && !expired) return { action: "prior_pending" };

  await failSponsorship(current.id, current.txHash);
  return { action: "submit", id: await createPending(intent) };
}

async function createPending(intent: SponsorshipIntent): Promise<string> {
  const row = await prisma.sponsoredTrustline.create({
    data: { ...intent, status: "pending" },
    select: { id: true },
  });
  return row.id;
}

function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: unknown })?.code === "P2002";
}

/**
 * Mark row `id` confirmed — only while it still carries `txHash`, so a late
 * result for a replaced envelope cannot settle its successor.
 */
export async function confirmSponsorship(id: string, txHash: string): Promise<void> {
  await prisma.sponsoredTrustline.updateMany({
    where: { id, txHash, status: { not: "confirmed" } },
    data: { status: "confirmed", confirmedAt: new Date() },
  });
}

/**
 * Release row `id` after a definite failure — only while it is still pending
 * with `txHash`. A confirmed sponsorship is never downgraded.
 */
export async function failSponsorship(id: string, txHash: string): Promise<void> {
  await prisma.sponsoredTrustline.updateMany({
    where: { id, txHash, status: "pending" },
    data: { status: "failed" },
  });
}

export interface SponsorshipLiability {
  /** Outstanding sponsorships, pending included. */
  outstanding: number;
  /** Of those, how many have not been confirmed. */
  pending: number;
  /** Base reserves the ledger says are locked; compare with Horizon `num_sponsoring`. */
  reserveUnits: number;
  byKind: Record<SponsorshipKind, { confirmed: number; pending: number }>;
}

/**
 * The sponsor's reserve liability as the ledger records it. Wallet health sets
 * this beside Horizon's on-chain count, and reserve reclaim (#29) works from
 * the same rows.
 */
export async function sponsorshipLiability(): Promise<SponsorshipLiability> {
  const groups = await prisma.sponsoredTrustline.groupBy({
    by: ["kind", "status"],
    where: outstanding(),
    _count: { _all: true },
  });

  const liability: SponsorshipLiability = {
    outstanding: 0,
    pending: 0,
    reserveUnits: 0,
    byKind: {
      trustline: { confirmed: 0, pending: 0 },
      "account+trustline": { confirmed: 0, pending: 0 },
    },
  };
  for (const group of groups) {
    const kind = group.kind as SponsorshipKind;
    const status = group.status === "pending" ? "pending" : "confirmed";
    const count = group._count._all;
    liability.outstanding += count;
    if (status === "pending") liability.pending += count;
    liability.reserveUnits += count * SPONSORSHIP_RESERVE_UNITS[kind];
    liability.byKind[kind][status] += count;
  }
  return liability;
}
