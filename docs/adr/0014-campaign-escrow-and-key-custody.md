# ADR-0014: One immutable escrow contract, released by the 2-of-3 payout account after 24 hours

- **Status:** Accepted — 2026-11-25
- **Scope:** The Soroban campaign escrow (Month 2, D1): its interface, its rules, who holds which key, and how a fix ships.
- **Relates to:** [#246](https://github.com/webnxt-2030/Centient/issues/246) (this change), [#250](https://github.com/webnxt-2030/Centient/issues/250) (authorization-path suite, the funding gate), [#247](https://github.com/webnxt-2030/Centient/issues/247) (SAC wiring and TS client), [#252](https://github.com/webnxt-2030/Centient/issues/252) (event indexer), [#253](https://github.com/webnxt-2030/Centient/issues/253) (tranche release and co-signer budget rule), [#258](https://github.com/webnxt-2030/Centient/issues/258) (export anchoring), [#263](https://github.com/webnxt-2030/Centient/issues/263) (TTL upkeep), [ADR-0001](0001-simulated-cosigner-isolation.md), [ADR-0008](0008-reconcile-multisig-payouts.md).

## Context

Until now a campaign's budget was a number an admin typed into Centient's
database. The SOW's D1 moves the partner's side of the money on-chain: a
partner funds its campaign in USDC into a Soroban contract, and the contract,
not Centient, decides what can leave and where it goes.

Four facts shaped the design:

- **The payout account already enforces two signatures.** The hot payout
  account [`GCP34RIT…K4BUO`](https://stellar.expert/explorer/testnet/account/GCP34RITQIVSLHS5T4XZRENIBUS3T7FHL3VSR24GK7HPMHGAAKWK4BUO)
  has thresholds 2/2/2 and three signers of weight 1: its master key, the ops
  key (`web`) and the policy co-signer (its own service). Read from Horizon on
  25 Nov 2026 and re-verified in [`docs/d4-multisig-reverify.md`](../d4-multisig-reverify.md).
- **The partner has to be able to leave.** A partner trusting Centient with
  money it can't take back is the admin-ledger problem again, on-chain.
- **Contracts can't be patched quietly.** That's the point of putting the
  money there, so a fix has to be a visible, new deployment.
- **Testnet only (D-7).** USDC is Circle's testnet USDC
  (`GBBD47IF…FLA5`), held through its Stellar Asset Contract
  `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA`.

## Decision

**One contract holds every campaign.** `contracts/escrow` keys each campaign
by Centient's campaign UUID. One deployment means one contract ID for the
indexer (#252), the dashboard (#251) and the proof page (#262) to read, and
one audit surface. A per-campaign contract (a factory) would multiply deploys
and TTL upkeep for no gain at pilot scale.

**Admin, token and payout destination are fixed by the constructor.** They're
set in the deploy transaction and nothing can change them. There is no
`set_admin`, no ownership transfer and **no upgrade function**. The deployer
key has no role after deploy.

**The money leaves three ways, each with one rule set:**

| Way | Who signs | Rule |
|---|---|---|
| Release | the payout account (2 of 3) to queue; anyone to execute | `queue_release` holds the tranche to the funder's cap and the campaign's balance, one queued at a time. `execute_release` pays it **only to the payout destination**, 24 h after queuing. |
| Refund | the payout account (2 of 3) | Everything still held goes **only to the recorded funder**. |
| Reclaim | the funder alone | Everything still held goes back to the funder at any time, and a queued tranche is cancelled. **No Centient key can block it.** |

Refund and reclaim **close** the campaign: no more funding and no more
releases. A new round uses a new campaign ID, so totals never mix across
rounds.

**The 24 h delay is the partner's window.** A queued tranche is public (an
event) a full day before it can move. If the partner disagrees, it reclaims,
and the queued tranche is cancelled. Because only one tranche can wait at a
time, releases are also at most one a day. That rule needs no separate
counter, and the contract has none.

**The funder sets the tranche cap.** `fund(campaign, funder, amount,
tranche_cap)` records the cap, and every later `fund` by the same funder can
change it. It's the funder's own limit on how fast its money can move.

**`anchor` is write-once.** An export's Merkle root (#258) is stored once per
(campaign, export) and can't be overwritten, so a delivered dataset's
fingerprint can't be swapped later. Anchoring works on a closed campaign,
because datasets are delivered after the budget is spent.

**Every write emits an event** (`funded`, `release_queued`, `released`,
`refunded`, `reclaimed`, `anchored`, with the campaign ID as a topic) for the
indexer, and **extends the TTL** of the entries it touched to about 30 days
once they fall under about 15. #263 runs the scheduled upkeep for quiet
campaigns.

### Key custody

| Key | Held by | What it can do in the escrow |
|---|---|---|
| Payout account master (`GCP34RIT…`) | Outside the running services: neither `web` nor the co-signer has `STELLAR_PLATFORM_SECRET` (`.railway/railway.ts`) | One of the three signers. Alone, nothing. |
| Ops key (`GAHZKJFA…`) | `web` (`STELLAR_OPS_SIGNER_SECRET`) | One of the three signers. Alone, nothing. |
| Policy co-signer (`GCAUNAS2…`) | The co-signer service (ADR-0001) | One of the three signers. Alone, nothing. |
| Partner wallet | The partner (Varial) | `fund` and `reclaim` its own campaign. Nothing else. |
| Deployer | stellar-cli key store, testnet only | Nothing after deploy. |

**How the payout account authorizes a call.** `queue_release`, `refund` and
`anchor` call `admin.require_auth()`. When the admin is a classic account,
Soroban checks the signatures against the account's **medium threshold**,
here 2, so one signature fails and any two of the three pass. Centient sends
these calls **with the payout account as the transaction source**, so the
authorization is the envelope's own signatures: the ops key signs on `web`,
and the policy co-signer adds a detached signature after checking its own
rules, the same two-step flow as payouts (ADR-0008). Teaching the co-signer
the escrow calls and its campaign-budget rule is #253.

**A payout signer is never a deployer, a SEP-10 key or a SEP-7 key**
(#245's key-custody guard). The partner wallet is never a payout signer.

### Not chosen

- **OpenZeppelin's `stellar-access` / `stellar-contract-utils`.** #246
  suggested reusing them. Their current release (0.8.0) needs
  `soroban-sdk` ^28, and the workspace pins 29.0.1. A contract can't link two
  SDKs, and moving the pin is its own PR (`contracts/README.md`). Their
  Ownable also adds `transfer_ownership` and `renounce_ownership`, which this
  contract must not have. The admin check here is one `require_auth()`
  against a constructor-fixed address, and the 24 h lock is a timestamp
  compare in the style of `soroban-examples/timelock`.
- **An upgradeable contract.** An upgrade key is a key that can rewrite the
  rules over a partner's money. A fix ships as a new deployment instead.
- **Releasing without a delay.** It would leave the partner no way to object
  before money moves.
- **The co-signer as the contract's admin.** The co-signer's job is to refuse
  bad payouts, not to hold a key that can move escrow alone.

## Consequences

- **A defect means a fresh deployment.** The old contract keeps working for
  refunds and reclaims, so no money is stranded, and new campaigns fund the
  new contract. The wasm hash and contract ID of each deployment are recorded
  in [`docs/escrow-runbook.md`](../escrow-runbook.md).
- **No partner funds the contract until #250 closes.** #250 is the
  authorization-path suite and it is the funding gate. The runbook and
  `contracts/README.md` both say so.
- **Contributors wait for released tranches.** #253's co-signer rule refuses
  any payout beyond what has been released to a campaign, so a campaign pays
  out at most one tranche a day, a day after it was queued.
- **A partner can pull its money at any time.** Released tranches are the
  only money Centient can count on. Anything still escrowed can leave.
- **Quiet campaigns need TTL upkeep.** An archived entry can be restored
  (Protocol 23 restores it on access), but #263 keeps them live so reads stay
  cheap.
- **The master key counts as one of the three.** Any two signers, master
  included, can queue a release or refund. That's the same boundary as
  payouts today.
