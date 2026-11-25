# Campaign escrow runbook

Operating the Soroban campaign escrow (`contracts/escrow`, #246). The design
and who holds which key are in
[ADR-0014](adr/0014-campaign-escrow-and-key-custody.md). **Stellar testnet
only** (D-7). The full escrow journey (fund → release → pay → refund) joins this
runbook with #266.

## Funding gate

> **No partner funds the escrow until [#250](https://github.com/webnxt-2030/Centient/issues/250)
> is closed.** #250 is the contract's authorization-path test suite. Until it
> passes, the only USDC that may enter a deployment is Centient's own test
> funding (#247). If #250 finds a defect, the fix is a fresh deployment
> (below), never a patch.

## Deployments

The newest row is the live one. A superseded deployment is never deleted: it
stays open for `refund` and `reclaim` until it holds nothing.

| Deployed | Contract | Wasm hash (SHA-256) | Source | Status |
|---|---|---|---|---|
| 2026-11-25 | [`CDR5R7WRYSOTL5SWFL66L3N5ZRKODU6K3NFRX4V4TNCXPTFDNLDNIXUU`](https://stellar.expert/explorer/testnet/contract/CDR5R7WRYSOTL5SWFL66L3N5ZRKODU6K3NFRX4V4TNCXPTFDNLDNIXUU) | `773e91b05caf6b3e99d3a0a02aef80315dc0769c952822895c2367239f1e0e9a` | #246 | Live, unfunded (funding gate) |

Its fixed settings, read back from the contract with `config`:

| Setting | Value |
|---|---|
| `admin` | [`GCP34RITQIVSLHS5T4XZRENIBUS3T7FHL3VSR24GK7HPMHGAAKWK4BUO`](https://stellar.expert/explorer/testnet/account/GCP34RITQIVSLHS5T4XZRENIBUS3T7FHL3VSR24GK7HPMHGAAKWK4BUO), the hot payout account (`STELLAR_PLATFORM_ACCOUNT`, thresholds 2/2/2) |
| `token` | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA`, the SAC of testnet USDC (`USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`) |
| `payout` | `GCP34RITQIVSLHS5T4XZRENIBUS3T7FHL3VSR24GK7HPMHGAAKWK4BUO`, the same payout account |

Transactions: wasm upload
[`250d8c40…`](https://stellar.expert/explorer/testnet/tx/250d8c40d77f1c9bd9701840ef242f04d09968f716ccbc9a0fd5a42760219e46),
deploy and constructor
[`119f855c…`](https://stellar.expert/explorer/testnet/tx/119f855cbbb6c473c5d2c60159f8d69615923ed6ef397f4bc0957422c5c27406).
Deployer `GCVG5ZCKATY3SWD7UY2OYYJXPBRTEJY4G5GL5OEEOZ7ND4XINR46UMV5`, a
friendbot-funded testnet key in the stellar-cli key store. It has no role in
the contract.

## Deploy a new version

1. Merge the contract change. Build from the merged commit, from `contracts/`:
   ```bash
   stellar contract build --locked
   shasum -a 256 target/wasm32v1-none/release/centient_escrow.wasm
   ```
2. Use a fresh testnet deployer, never a payout signer (platform, ops, policy,
   cold reserve) and never a SEP-10 or SEP-7 key:
   ```bash
   stellar keys generate centient-escrow-deployer --network testnet --fund
   ```
3. Upload, then deploy with the payout account and the USDC SAC. The SAC ID
   comes from `stellar contract id asset --asset USDC:<issuer> --network testnet`.
   ```bash
   stellar contract upload --wasm target/wasm32v1-none/release/centient_escrow.wasm \
     --source-account centient-escrow-deployer --network testnet
   stellar contract deploy --wasm-hash <WASM_HASH> \
     --source-account centient-escrow-deployer --network testnet --alias centient-escrow \
     -- --admin <PAYOUT_ACCOUNT> --token <USDC_SAC> --payout <PAYOUT_ACCOUNT>
   ```
4. Check it, then add a row above and mark the old one superseded:
   ```bash
   stellar contract invoke --id <CONTRACT_ID> --source-account centient-escrow-deployer \
     --network testnet --send=no -- config
   ```
   `config` must show the payout account twice and the USDC SAC.
   `stellar contract info interface --id <CONTRACT_ID> --network testnet` must
   list no upgrade function.

## Read a campaign

Reads need no signature. Simulate them with any funded testnet key:

```bash
stellar contract invoke --id <CONTRACT_ID> --source-account centient-escrow-deployer \
  --network testnet --send=no -- balance --campaign <CAMPAIGN_UUID>
```

`campaign` returns the full state (funder, cap, totals, queued tranche),
`anchored --campaign … --export …` returns an anchored root. An unknown
campaign answers `Error(Contract, #3)`. The codes are listed in
`contracts/escrow/src/lib.rs`.
