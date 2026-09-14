// Platform-side Stellar client (ST-1b #292): transaction status lookups and the
// sponsored USDC trustline path for new recipients.
//
// The single-key `payUsdc` broadcast that used to live here was retired by the
// multisig payout service (issue #7, closed out in #73). Every contributor
// payout now goes through `payout-submitter.ts`, which builds the payment from
// the 2-of-3 payout account, collects two independent signatures, fee-bumps, and
// submits under its own sequence lock. Nothing in this module can move funds
// with one signature: `sponsorKeypair()` signs only the sponsorship sandwich
// for a recipient's trustline, and is required to be a key that is not a signer
// on the payout account at all (F-01).
//
// USDC is an issued asset, so each recipient must hold a USDC trustline before
// they can be paid — see `op_no_trust` below and `buildSponsoredTrustlineTx`.
import {
  BASE_FEE,
  Horizon,
  Keypair,
  Operation,
  Transaction,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { calculateSpendableXlm, xlmToStroops } from "./balance";
import { server, networkPassphrase, usdcAsset } from "./config";
import { assertSponsorNotPayoutSigner } from "./key-custody";

/** How long a built transaction stays valid before Horizon rejects it. */
const TX_TIMEOUT_SECONDS = 180;

/**
 * The most the sponsor pays per operation: 0.01 XLM. The builder clamps the
 * network's base fee to it and the submit guard rejects anything above it.
 */
export const SPONSOR_MAX_FEE_PER_OP_STROOPS = 100_000;

/** Clock skew tolerated between the builder that set `maxTime` and the guard. */
const TIME_BOUND_SKEW_SECONDS = 60;

/** `changeTrust`'s limit when none is given: the int64 maximum, as the SDK decodes it. */
const DEFAULT_TRUST_LIMIT = "922337203685.4775807";

type SponsorshipKind = "trustline" | "account+trustline";

/** Base reserves a sponsorship adds to the sponsor: two per account entry, one per trustline. */
const SPONSORED_RESERVE_UNITS: Readonly<Record<SponsorshipKind, bigint>> = {
  trustline: 1n,
  "account+trustline": 3n,
};

/**
 * A payment failure surfaced to the caller. `retryable: false` means the caller
 * must NOT retry — e.g. `op_no_destination` (the destination account doesn't
 * exist / is unfunded) or `op_no_trust` (the destination holds no USDC
 * trustline), both of which would loop forever. The payout should be marked
 * failed instead. Error shapes confirmed in ST-0 (#290).
 */
export class StellarPaymentError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "StellarPaymentError";
  }
}

let _sponsorKeypair: Keypair | null = null;

/**
 * The sponsorship signing key, memoized after first use.
 *
 * Reads `STELLAR_SPONSOR_SECRET` and falls back to `STELLAR_PLATFORM_SECRET`.
 * The fallback exists so the two halves of the F-01 migration can land in either
 * order without an onboarding outage: this deployment keeps sponsoring
 * trustlines while the new key is provisioned, and keeps sponsoring them after
 * the payout master is removed. It is not a permanent affordance — while
 * `STELLAR_PLATFORM_SECRET` is what answers here, the deployment still holds a
 * payout signer and `assertCustodyBelowThreshold` still refuses to pay out.
 *
 * This key signs only the sponsorship sandwich — a shape asserted to contain no
 * payment operation — so it needs XLM for reserves and no payout authority at
 * all. `assertSponsorNotPayoutSigner` enforces that separation.
 */
function sponsorKeypair(): Keypair {
  if (_sponsorKeypair) return _sponsorKeypair;

  const sponsorSecret = process.env.STELLAR_SPONSOR_SECRET?.trim();
  if (sponsorSecret) {
    assertSponsorNotPayoutSigner();
    _sponsorKeypair = Keypair.fromSecret(sponsorSecret);
    return _sponsorKeypair;
  }

  const platformSecret = process.env.STELLAR_PLATFORM_SECRET?.trim();
  if (!platformSecret) {
    throw new Error(
      "STELLAR_SPONSOR_SECRET is not configured (and no STELLAR_PLATFORM_SECRET to fall back to) — new recipients cannot be given a sponsored USDC trustline",
    );
  }
  console.warn(
    "[stellar/client] sponsoring trustlines with STELLAR_PLATFORM_SECRET; set STELLAR_SPONSOR_SECRET to a non-payout-signer key so the payout master can be removed from this deployment (F-01)",
  );
  _sponsorKeypair = Keypair.fromSecret(platformSecret);
  return _sponsorKeypair;
}

/**
 * Public key of the account that sponsors trustlines, or null when no usable
 * sponsorship key is configured. Lets wallet health tell whether the account it
 * monitors is the one whose `num_sponsoring` the ledger should explain.
 */
export function sponsorPublicKey(): string | null {
  try {
    return sponsorKeypair().publicKey();
  } catch {
    return null;
  }
}

/** Horizon error → `{ transaction, operations }` result codes (ST-0 #290 shapes). */
export function resultCodes(err: unknown): { transaction?: string; operations?: string[] } {
  const extras = (err as { response?: { data?: { extras?: { result_codes?: unknown } } } })
    ?.response?.data?.extras?.result_codes;
  return (extras as { transaction?: string; operations?: string[] }) ?? {};
}

/**
 * A human-readable failure description that preserves Horizon's verdict.
 *
 * Horizon rejects with an axios error whose `message` is only
 * `Request failed with status code 400`; the reason — `tx_insufficient_balance`,
 * `op_underfunded`, `op_no_trust` — lives in `extras.result_codes`, and
 * `console.log`ging the error renders that object as `[Object]`. So a payout
 * that failed for a precise, actionable reason was indistinguishable from one
 * that failed for an unknown one (F-04b). Anything that records a payout failure
 * for an operator should describe it through here.
 */
export function describeStellarError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const codes = resultCodes(err);
  const parts: string[] = [];
  if (codes.transaction) parts.push(codes.transaction);
  if (codes.operations?.length) {
    // Horizon pads the array with "op_success" for operations that did apply;
    // keeping those buries the one code that explains the failure.
    const failed = codes.operations.filter((code) => code && code !== "op_success");
    if (failed.length) parts.push(...failed);
  }
  if (!parts.length) return message;
  return `${message} (${parts.join(", ")})`;
}

/**
 * Look up a transaction by hash and map it to a coarse status for the reconciler
 * (ST-3b): `confirmed` (Horizon `successful: true`), `failed` (explicit
 * failure), or `not_found` (404 — not yet visible or never submitted).
 */
export async function getTxStatus(
  hash: string,
): Promise<"confirmed" | "failed" | "not_found"> {
  try {
    const tx = await server().transactions().transaction(hash).call();
    return tx.successful ? "confirmed" : "failed";
  } catch (err) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 404) return "not_found";
    throw err;
  }
}

/** A Horizon `account.balances[]` line — the subset we read for trustline checks. */
interface HorizonBalanceLine {
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
}

/**
 * True iff `address` (a `G…`) holds a USDC trustline for the configured issuer.
 * Holding the trustline is a precondition for receiving USDC — without it a
 * payment fails non-retryably with `op_no_trust`. Used to precheck a withdrawal
 * destination so an untrusted address is rejected with clear guidance up front
 * instead of failing silently at payout time (ST-4b #300).
 *
 * A non-existent / unfunded account (Horizon 404) holds no trustline → `false`.
 * ST-4e (#314) turns this gate from a hard reject into a sponsored-trustline flow.
 */
export async function accountHasUsdcTrustline(address: string): Promise<boolean> {
  const asset = usdcAsset();
  try {
    const account = await server().loadAccount(address);
    return (account.balances as HorizonBalanceLine[]).some(
      (b) =>
        b.asset_type !== "native" &&
        b.asset_code === asset.getCode() &&
        b.asset_issuer === asset.getIssuer(),
    );
  } catch (err) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 404) return false;
    throw err;
  }
}

/**
 * Does `address` exist on-chain? A Horizon 404 means the account is unfunded /
 * never created (so it needs sponsored creation before it can hold a trustline).
 */
async function accountExists(address: string): Promise<boolean> {
  try {
    await server().loadAccount(address);
    return true;
  } catch (err) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 404) return false;
    throw err;
  }
}

/**
 * Build a CAP-33 platform-sponsored USDC-trustline transaction for `recipientG`
 * and platform-sign it. The platform is the transaction source (sequence + fee)
 * and the sponsor; the recipient owns (and must also sign) the `changeTrust` and
 * `endSponsoring` ops, but pays no reserve. If the recipient account does not yet
 * exist, a sponsored `createAccount(recipient, "0")` is prepended.
 *
 * Sequence: built from the platform's *current* sequence but submitted later
 * (after the recipient signs in-browser), so a concurrent multisig payout may consume it
 * first → tx_bad_seq at submit; the caller re-runs the flow (simple strategy,
 * ST-4e #314). Returns the base64 XDR for the browser to co-sign.
 *
 * #27: refuses with `sponsor_low_reserve` before anything is offered when the
 * sponsor cannot cover the reserves this sponsorship would add plus its fee.
 * Otherwise the contributor would sign, and only then learn at submit
 * (`op_low_reserve`) that it could never have worked.
 */
export async function buildSponsoredTrustlineTx(
  recipientG: string,
): Promise<{ xdr: string; kind: SponsorshipKind }> {
  const kp = sponsorKeypair();
  const srv = server();
  const account = await srv.loadAccount(kp.publicKey());
  const networkFee = await srv.fetchBaseFee().catch(() => Number(BASE_FEE));
  const fee = Math.min(networkFee, SPONSOR_MAX_FEE_PER_OP_STROOPS);
  const exists = await accountExists(recipientG);
  const kind: SponsorshipKind = exists ? "trustline" : "account+trustline";
  await assertSponsorCanCover(srv, account, kind, BigInt(fee) * BigInt(exists ? 3 : 4));

  const builder = new TransactionBuilder(account, {
    fee: String(fee),
    networkPassphrase: networkPassphrase(),
  }).addOperation(Operation.beginSponsoringFutureReserves({ sponsoredId: recipientG }));

  if (!exists) {
    builder.addOperation(
      Operation.createAccount({ destination: recipientG, startingBalance: "0" }),
    );
  }

  const tx = builder
    .addOperation(Operation.changeTrust({ asset: usdcAsset(), source: recipientG }))
    .addOperation(Operation.endSponsoringFutureReserves({ source: recipientG }))
    .setTimeout(TX_TIMEOUT_SECONDS)
    .build();
  tx.sign(kp);

  return { xdr: tx.toXDR(), kind };
}

/** A Horizon balance line, as far as the reserve pre-check reads it. */
interface NativeBalanceLine {
  asset_type: string;
  balance: string;
  selling_liabilities?: string;
}

/**
 * Throw `sponsor_low_reserve` unless the sponsor's spendable XLM covers the
 * base reserves a `kind` sponsorship adds and the transaction fee. Spendable is
 * computed the way wallet health computes it, from the live base reserve.
 */
async function assertSponsorCanCover(
  srv: Horizon.Server,
  account: Horizon.AccountResponse,
  kind: SponsorshipKind,
  feeStroops: bigint,
): Promise<void> {
  const ledgers = await srv.ledgers().order("desc").limit(1).call();
  const latest = ledgers.records[0];
  const native = (account.balances as NativeBalanceLine[]).find((b) => b.asset_type === "native");
  if (!latest || !native) {
    throw new Error("buildSponsoredTrustlineTx: Horizon sponsor account or latest ledger is incomplete");
  }
  const baseReserveStroops = BigInt(latest.base_reserve_in_stroops);
  const { spendableStroops } = calculateSpendableXlm({
    totalStroops: xlmToStroops(native.balance),
    sellingLiabilitiesStroops: xlmToStroops(native.selling_liabilities ?? "0"),
    baseReserveStroops,
    subentryCount: account.subentry_count,
    numSponsoring: account.num_sponsoring ?? 0,
    numSponsored: account.num_sponsored ?? 0,
  });
  const requiredStroops = baseReserveStroops * SPONSORED_RESERVE_UNITS[kind] + feeStroops;
  if (spendableStroops < requiredStroops) {
    throw new StellarPaymentError(
      `buildSponsoredTrustlineTx: sponsor has ${spendableStroops} spendable stroops, needs ${requiredStroops} for a ${kind} sponsorship`,
      "sponsor_low_reserve",
      false,
    );
  }
}

function rejectSponsorTx(why: string): never {
  throw new StellarPaymentError(`submitSponsoredTrustline: ${why}`, "invalid_sponsor_tx", false);
}

/**
 * Assert `xdr` is exactly a platform-sponsored USDC-trustline sandwich for a
 * single recipient — begin / [createAccount] / changeTrust(USDC) / end, no other
 * op types (esp. no payment, and no setOptions that could add a signer to the
 * contributor's account). Throws `invalid_sponsor_tx`.
 *
 * Fix 2: also asserts `beginSponsoringFutureReserves.sponsoredId === expectedRecipient`.
 * Fix 4: also asserts `endSponsoringFutureReserves.source === sponsored`.
 *
 * #27 pins the fields that make "the contributor pays nothing and owns the
 * account" true of the envelope itself, not just of the builder that made it:
 * the sponsor is the transaction source (so it pays the fee and sequence) and
 * validly signed it; `createAccount` funds 0 XLM; the trustline has the default
 * limit; the fee is bounded; and the envelope has a time bound no later than the
 * builder issues, so a stalled one is known to expire.
 */
function assertSponsoredTrustlineShape(
  tx: Transaction,
  expectedRecipient: string,
  sponsor: Keypair,
  nowMs: number,
): void {
  const types = tx.operations.map((o) => o.type);
  const withAccount = ["beginSponsoringFutureReserves", "createAccount", "changeTrust", "endSponsoringFutureReserves"];
  const withoutAccount = ["beginSponsoringFutureReserves", "changeTrust", "endSponsoringFutureReserves"];
  const ok =
    JSON.stringify(types) === JSON.stringify(withAccount) ||
    JSON.stringify(types) === JSON.stringify(withoutAccount);
  if (!ok) rejectSponsorTx(`unexpected op shape [${types.join(", ")}]`);

  const begin = tx.operations[0] as { sponsoredId?: string };
  const changeTrust = tx.operations.find((o) => o.type === "changeTrust") as
    | { source?: string; limit?: string; line?: { code?: string; issuer?: string } }
    | undefined;
  const asset = usdcAsset();
  const sponsored = begin.sponsoredId;
  if (
    !sponsored ||
    !changeTrust ||
    changeTrust.source !== sponsored ||
    changeTrust.line?.code !== asset.getCode() ||
    changeTrust.line?.issuer !== asset.getIssuer()
  ) {
    rejectSponsorTx("sponsored target / asset mismatch");
  }
  // Fix 2: the envelope's sponsoredId must match the address the route validated.
  // Guards against an injected envelope targeting a different account while reusing
  // a valid shape.
  if (sponsored !== expectedRecipient) {
    rejectSponsorTx("sponsored target does not match expected recipient");
  }
  if (changeTrust.limit !== DEFAULT_TRUST_LIMIT) {
    rejectSponsorTx(`changeTrust limit ${changeTrust.limit} is not the default`);
  }
  const createAccount = tx.operations.find((o) => o.type === "createAccount") as
    | { destination?: string; startingBalance?: string }
    | undefined;
  if (createAccount && createAccount.destination !== sponsored) {
    rejectSponsorTx("createAccount destination does not match sponsoredId");
  }
  if (createAccount && xlmToStroops(createAccount.startingBalance ?? "") !== 0n) {
    rejectSponsorTx(`createAccount starting balance ${createAccount.startingBalance} is not 0`);
  }
  // Fix 4: the endSponsoringFutureReserves op must be sourced by the recipient
  // (sponsored), not some other party.
  const endSponsoring = tx.operations.find((o) => o.type === "endSponsoringFutureReserves") as
    | { source?: string }
    | undefined;
  if (!endSponsoring || endSponsoring.source !== sponsored) {
    rejectSponsorTx("endSponsoringFutureReserves.source does not match sponsored");
  }

  if (tx.source !== sponsor.publicKey()) {
    rejectSponsorTx("transaction source is not the sponsor account");
  }
  if (BigInt(tx.fee) > BigInt(SPONSOR_MAX_FEE_PER_OP_STROOPS * tx.operations.length)) {
    rejectSponsorTx(`fee ${tx.fee} exceeds the sponsor's bound`);
  }
  const maxTime = Number(tx.timeBounds?.maxTime ?? 0);
  if (maxTime === 0) rejectSponsorTx("envelope has no upper time bound");
  if (maxTime > Math.floor(nowMs / 1000) + TX_TIMEOUT_SECONDS + TIME_BOUND_SKEW_SECONDS) {
    rejectSponsorTx("envelope is valid for longer than the sponsor issues");
  }
  // The recipient cannot alter a sponsor-signed envelope without invalidating
  // this signature, so checking it proves the envelope is one the sponsor built.
  const hash = tx.hash();
  const sponsorSigned = tx.signatures.some(
    (sig) => sig.hint().equals(sponsor.signatureHint()) && sponsor.verify(hash, sig.signature()),
  );
  if (!sponsorSigned) rejectSponsorTx("envelope does not carry a valid sponsor signature");
}

/** A validated sponsorship envelope, ready to broadcast. */
export interface PreparedSponsorship {
  /** Hex hash of the envelope — known before broadcast, so it can be recorded first. */
  hash: string;
  kind: SponsorshipKind;
  /** The envelope's `maxTime`: after it, the envelope can no longer apply. */
  expiresAt: Date;
  /** Broadcast the envelope. Errors are classified; see {@link submitSponsoredTrustline}. */
  submit(): Promise<{ hash: string }>;
}

/**
 * Parse and validate a recipient-co-signed sponsorship XDR without touching the
 * network. The only way to broadcast it is the returned `submit`, so nothing
 * unvalidated can reach Horizon, while the caller still learns the hash and
 * expiry in time to record its intent before the irreversible step.
 */
export function prepareSponsoredTrustline(
  signedXdr: string,
  expectedRecipient: string,
): PreparedSponsorship {
  // Fix 3: wrap XDR parse so garbage input / fee-bump envelopes become
  // `invalid_sponsor_tx` (→ 400) instead of a raw JS error (→ 502).
  let tx: Transaction;
  try {
    const parsed = TransactionBuilder.fromXDR(signedXdr, networkPassphrase());
    if (!(parsed instanceof Transaction)) {
      rejectSponsorTx("fee-bump or non-standard envelope not accepted");
    }
    tx = parsed;
  } catch (err) {
    if (err instanceof StellarPaymentError) throw err;
    rejectSponsorTx("could not parse XDR (malformed or garbage input)");
  }
  assertSponsoredTrustlineShape(tx, expectedRecipient, sponsorKeypair(), Date.now());

  const hash = tx.hash().toString("hex");
  // Derived from the validated shape so the caller can record which reserve kind
  // was locked (#330): account-creation + trustline (~1.5 XLM) vs trustline only.
  const kind: SponsorshipKind = tx.operations.some((o) => o.type === "createAccount")
    ? "account+trustline"
    : "trustline";
  return {
    hash,
    kind,
    expiresAt: new Date(Number(tx.timeBounds!.maxTime) * 1000),
    submit: () => broadcastSponsorship(tx, hash),
  };
}

/**
 * Validate and submit a recipient-co-signed sponsored-trustline XDR (from
 * {@link buildSponsoredTrustlineTx}) in one step.
 *
 * Maps: `op_low_reserve` → non-retryable (platform lacks XLM for the sponsored
 * reserves); `tx_bad_seq` → retryable (the sequence was consumed, so this
 * envelope cannot apply unless it is what consumed it); any other Horizon
 * verdict, or a 4xx → `sponsor_tx_rejected` (definite: it did not apply);
 * a timeout, 5xx or network failure → `submission_unknown` (it may still
 * apply — resolve by hash, never by rebuilding). Shape mismatch or garbage input
 * → non-retryable `invalid_sponsor_tx` (→ 400 at the route).
 *
 * NOTE: the sponsor path is intentionally NOT serialized with the payout
 * submitter's sequence lock (simple strategy; the multisig payout path rebuilds
 * once on `tx_bad_seq`).
 */
export async function submitSponsoredTrustline(
  signedXdr: string,
  expectedRecipient: string,
): Promise<{ hash: string; kind: SponsorshipKind }> {
  const prepared = prepareSponsoredTrustline(signedXdr, expectedRecipient);
  const { hash } = await prepared.submit();
  return { hash, kind: prepared.kind };
}

async function broadcastSponsorship(tx: Transaction, hash: string): Promise<{ hash: string }> {
  try {
    await server().submitTransaction(tx);
    return { hash };
  } catch (err) {
    const codes = resultCodes(err);
    if (codes.operations?.includes("op_low_reserve")) {
      throw new StellarPaymentError(
        "submitSponsoredTrustline: platform account cannot fund sponsored reserves (op_low_reserve)",
        "op_low_reserve",
        false,
      );
    }
    if (codes.transaction === "tx_bad_seq") {
      throw new StellarPaymentError(
        "submitSponsoredTrustline: stale sequence (tx_bad_seq) — rebuild and retry",
        "tx_bad_seq",
        true,
      );
    }
    const status = (err as { response?: { status?: unknown } })?.response?.status;
    const answered = codes.transaction !== undefined || (codes.operations?.length ?? 0) > 0;
    if (answered || (typeof status === "number" && status >= 400 && status < 500)) {
      throw new StellarPaymentError(
        `submitSponsoredTrustline: Horizon rejected ${hash} (${describeStellarError(err)})`,
        "sponsor_tx_rejected",
        false,
      );
    }
    throw new StellarPaymentError(
      `submitSponsoredTrustline: outcome of ${hash} unknown (${describeStellarError(err)}) — resolve it by hash before building another`,
      "submission_unknown",
      false,
    );
  }
}
