# Privacy and analytics

What Centient sends to its analytics provider, and why one event carries a wallet address. Centient runs on the Stellar **testnet** only (D-7).

*Published 28 September 2026 for the D4 public release. This page covers analytics. It is not a full privacy policy.*

## In the browser

Centient uses [PostHog](https://posthog.com) for product analytics. The browser sends events to Centient's own `/ingest` path, which forwards them to PostHog.

* **Identity.** Events are tied to Centient's internal user id (or an admin id on the admin console), never to an email address or wallet address.
* **What is never sent:** email address, wallet address, demographics (country, gender, age range).
* **Explicit events only.** Autocapture is off, because clicked elements on this app can show wallet addresses and balances. The events are named product steps, such as `task_presented`, `submission_approved`, `onboarding_completed` and `payout_ready`.
* **Session replay** keeps layout and clicks but masks all text and every input.
* **Signing out** resets the analytics identity, so the next person on the same browser starts anonymous.

## On the server: `payout_transaction`

Each on-chain payout attempt is recorded once as a `payout_transaction` event. **This event carries the contributor's Stellar wallet address.**

| Property | What it is |
| --- | --- |
| `wallet_address` (also the event's person id) | The Stellar address the payout was sent to |
| `amount_usdc`, `amount_units` | The payout amount |
| `tx_hash` | The Stellar transaction hash, or empty when the payout failed before one existed |
| `success`, `status`, `error_code` | Whether the payout settled and, if not, why |
| `reference_kind`, `reference_id` | The internal submission or withdrawal the payout belongs to |

**Why the address is sent here and nowhere else.** A payout's destination address, amount and transaction hash are already public on the Stellar ledger: anyone can look up the transaction on [stellar.expert](https://stellar.expert/explorer/testnet). The event copies public ledger facts so payouts can be listed per wallet. It adds no email address and no demographics. Browser events never carry the address, and the two are recorded under different person ids (the wallet here, the internal user id in the browser), so PostHog does not merge them into one profile.

## What is public anyway

Every payout is a Stellar transaction. The paying account, the receiving address, the amount and the time are public on the ledger, whether or not analytics records them.
