// TC-026: sponsor cannot cover reserves + fee -> 503 before any XDR.
// Developer-prepared F5: the sponsor's spendable XLM is parked in a holder account for a few seconds, then merged back.
import { Client } from "pg";
import { Keypair } from "@stellar/stellar-sdk";
import { account, call, evidence, horizon, key, Operation, short, signIn, submitOps } from "./kit";

async function sponsorState(pub: string) {
  const a = await horizon.loadAccount(pub);
  const ledger = (await horizon.ledgers().order("desc").limit(1).call()).records[0];
  const base = Number(ledger.base_reserve_in_stroops) / 1e7;
  const native = a.balances.find((b: any) => b.asset_type === "native") as any;
  const locked = (2 + a.subentry_count + (a.num_sponsoring ?? 0) - (a.num_sponsored ?? 0)) * base;
  const spendable = Number(native.balance) - Number(native.selling_liabilities ?? 0) - locked;
  return { balance: native.balance, subentry_count: a.subentry_count, num_sponsoring: a.num_sponsoring, base_reserve_xlm: base, spendable_xlm: spendable.toFixed(7), needed_for_account_plus_trustline_xlm: (3 * base).toFixed(7) + " + fee" };
}

(async () => {
  const sponsor = Keypair.fromSecret(process.env.STELLAR_SPONSOR_SECRET!);
  const holder = key("tc026-holder");
  const F1 = key("tc026-F1");
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  const out: any = { sponsor: sponsor.publicKey(), F1: short(F1.publicKey()), steps: [] };

  const f = await signIn(F1); // wallet-only fixture, never funded
  out.steps.push({ step: "setup", sponsorBefore: await sponsorState(sponsor.publicKey()) });

  const before = await sponsorState(sponsor.publicKey());
  const park = (Number(before.spendable_xlm) - 1.2).toFixed(7); // leaves ~0.2 XLM spendable after the holder's reserve & fee
  let parked = false;
  try {
    const t1 = await submitOps(sponsor, [Operation.createAccount({ destination: holder.publicKey(), startingBalance: park })]);
    parked = true;
    out.steps.push({ step: "F5 in place: spendable XLM parked in holder " + short(holder.publicKey()), tx: t1.hash, sponsorDuring: await sponsorState(sponsor.publicKey()) });

    const r = await call("GET", "/api/me/wallet/sponsor", { cookie: f.cookie });
    const rows = await db.query(`select count(*)::int n from sponsored_trustlines where address=$1`, [F1.publicKey()]);
    out.steps.push({
      step: "1: GET /api/me/wallet/sponsor for F1 while the sponsor is short",
      expect: "503 sponsorship_unavailable before any XDR; no signature requested; no intent row",
      got: { status: r.status, body: r.body, at: r.at },
      xdrOffered: Boolean(r.body?.xdr),
      intentRowsForF1: rows.rows[0].n,
      f1OnChain: (await account(F1.publicKey())) ? "exists" : "404 (no partial account)",
    });
  } finally {
    if (parked || (await account(holder.publicKey()))) {
      const t2 = await submitOps(holder, [Operation.accountMerge({ destination: sponsor.publicKey() })]);
      out.steps.push({ step: "restore: holder merged back into sponsor", tx: t2.hash, sponsorAfter: await sponsorState(sponsor.publicKey()) });
    }
  }
  const again = await call("GET", "/api/me/wallet/sponsor", { cookie: f.cookie });
  out.steps.push({ step: "recovery check (not part of the TC): GET after restore", got: { status: again.status, kind: again.body?.kind, xdrOffered: Boolean(again.body?.xdr) } });
  evidence("026", "E026-2-insolvent-sponsor-503.json", out);
  console.log(JSON.stringify(out, null, 1));
  await db.end();
})();
