# Payout failure matrix (D4, #46)

The four failures the Statement of Work names, injected into the payout rail,
with what must happen, what must never happen, and what the rail actually does.
Proven on Stellar **testnet** only (D-7).

## How to reproduce

The suite is `lib/__tests__/payout-failure-injection-db.test.ts`. It is part of
the payments lane, so it runs in CI's `payments-lane` job.

```bash
# Against the test database (docker compose, or any Postgres 15+):
export DATABASE_URL=postgresql://postgres:postgres@localhost:5433/centient_test
export TEST_DATABASE_URL=$DATABASE_URL
npx prisma migrate deploy
npx vitest run lib/__tests__/payout-failure-injection-db.test.ts
```

### What is real and what is injected

| Part | In the suite |
| --- | --- |
| Payout worker, retry path, revival, attempt journal, daily cap | Real, against Postgres |
| Multisig submitter: build, platform signature, fee bump, sequence mutex, ambiguous-submit resolution | Real |
| Co-signer client: HMAC transport, timeout, response parsing | Real (`remotePolicyCoSigner`, resolved from env) |
| Co-signer decision: ledger check, open-envelope check, independent daily cap | Real (`handleCoSignRequest`, reading the same database through `readLedgerPayout`) |
| **Horizon** | Fake. It enforces the payout account's sequence number, rejects a stale one exactly as Horizon rejects a stale fee bump, and records every envelope it is shown |
| **The network hop to the co-signer** | A stubbed `fetch`, so an outage, a timeout or a 5xx can be switched on |

Each passing case checks the same invariants. A paid submission has exactly
one applied payment of the owed amount. Both the inner transaction and the fee
bump carry both signatures and only those two. The ledger records that
envelope's hash, and exactly one payout attempt is `confirmed`.

## Results

| Failure | Must happen | Must never happen | Observed | Status |
| --- | --- | --- | --- | --- |
| **Sequence collision.** Another submitter spends the payout account's sequence between load and submit | One payout lands; the other retries on a fresh sequence | A second transfer for the same submission | The stale envelope is voided with its reason (`tx_fee_bump_inner_failed, tx_bad_seq`). It is rebuilt and co-signed again in the same call, and lands once. The job ends `done` with no retry spent. Under sustained contention both envelopes are voided, the job requeues retryably, and the next pass pays once. Two payouts in one process serialize onto consecutive sequences | ✅ Pass, after the fix below |
| **Co-signer outage.** Unreachable, timing out, or answering 503 | The payout stays pending, an alert fires, and it resumes when the co-signer returns | A payout with one signature, or a status that says paid | Nothing is presented to Horizon and no attempt is opened. The submission stays `pending` with no hash, and the claim is handed back. If the co-signer returns within the worker's retries, the next pass pays once. **But** each failure is requeued immediately and counted against the worker's 3 retries. An outage longer than three passes (seconds) fails the payout, exhausts its retry budget and refunds the campaign, and the returning co-signer never pays it. The only alert is the permanent-failure page afterwards | 🟡 **Never unsafe; does not resume.** Gap for #47 |
| **Daily cap exceeded** | Both signers refuse independently, and an alert fires | Either signer alone lifting the cap | *Service cap:* refuses before the co-signer is asked, leaves the submission `pending` with no retry spent, and raises the `payout-cap` page. The retry path refuses the same way, and the row pays once when room returns. *Co-signer cap,* with the service's cap switched off: the co-signer refuses (409, `daily cap reached`), so there is no second signature and nothing reaches Horizon. **But** that refusal raises no cap alert and spends worker retries like any error, so after three passes the payout is failed and refunded | 🟡 **Both refuse; the co-signer's refusal is unalerted and final.** Gap for #47 |
| **Horizon timeout.** The outcome is unknown | The payout stays reconcilable and is resolved only from on-chain proof | A blind resubmit | *Response lost, transaction landed:* resolved by the envelope's hash, recorded once, nothing rebuilt. *Never landed:* rebuilt only after Horizon reports it absent in a lookup after a ledger closed past its `maxTime`. *Horizon unreachable past the deadline:* the job fails as `needs manual reconciliation (ambiguous_submit)`. There is no refund, the attempt stays `open`, Sentry pages at `error`, and even a direct retry sends nothing (`attempt_unsettled`). Once Horizon answers, `reviveStrandedAttempts` and the retry path record the envelope that landed. Horizon saw one submit in total | ✅ Pass |

## Defects found and fixed here

1. **A stale-sequence fee bump was never rebuilt.** The submitter recognized a
   stale sequence only as `transaction: "tx_bad_seq"`. Every payout is a fee
   bump, and Horizon reports its stale inner sequence as
   `tx_fee_bump_inner_failed` with `inner_transaction: "tx_bad_seq"` (captured on
   testnet, 2026-09-14). So the documented in-call rebuild never ran: each
   collision spent one of the worker's three retries instead. Funds were never at
   risk. `isStaleSequence` in `lib/stellar/payout-submitter.ts` now reads both
   forms.
2. **A voided fee bump lost its reason.** The attempt journal recorded
   `rejected: tx_fee_bump_inner_failed` and dropped the inner code that explains
   it. `describeResultCodes` now includes `inner_transaction`.

## Gaps left for #47

Neither gap can double-pay or pay on one signature. Both end a payable
submission early.

* **Co-signer outage.** Treat a transport failure, a timeout or a 5xx from the
  co-signer as a deferral, not a failure: requeue with a delay (`notBefore`),
  spend no retry, and raise a deduplicated `cosigner-unavailable` alert. A 4xx
  refusal stays a failure.
* **Co-signer cap.** Give the co-signer's cap refusal a machine-readable code,
  defer it the way the service's own cap is deferred, and alert on it. This
  changes the co-signer service, so it needs a co-signer redeploy.

The two `today:` cases in the suite pin the current behaviour, so the #47 change
shows up as a change to those tests.
