# Soroban contracts

Centient's Soroban contracts, in one Cargo workspace. Testnet only (D-7).

| Crate | What it is |
|---|---|
| `escrow` | The campaign escrow (#246, [ADR-0014](../docs/adr/0014-campaign-escrow-and-key-custody.md)). Holds partner USDC through the SAC and releases it in 24 h-delayed tranches, only to the 2-of-3 payout account. |
| `smoke` | A trivial contract (`ping`, `pings`) that proves the toolchain builds, tests and deploys. It holds nothing. |

## The campaign escrow

> **No partner funds the escrow until [#250](https://github.com/webnxt-2030/Centient/issues/250)
> (the authorization-path test suite) is closed.** #250 is the funding gate. A
> defect it finds means a fresh deployment, not a patch.

The deployed contract ID, wasm hash and deploy transactions are recorded in
[`docs/escrow-runbook.md`](../docs/escrow-runbook.md).

| Entry point | Who signs | What it does |
|---|---|---|
| constructor | deployer, once | Fixes `admin` (the payout account), `token` (the USDC SAC) and `payout` (where releases go). Nothing changes them later. |
| `fund(campaign, funder, amount, tranche_cap)` | the funder | Moves USDC into escrow, records the funder and sets its tranche cap. Later calls must come from the same funder. |
| `queue_release(campaign, amount)` | `admin` (2 of 3) | Queues a tranche: at most the cap, at most the balance, one queued at a time. Returns when it can execute. |
| `execute_release(campaign)` | anyone | Pays the queued tranche to `payout`, 24 h after queuing. |
| `refund(campaign)` | `admin` (2 of 3) | Returns everything still held to the funder and closes the campaign. |
| `reclaim(campaign)` | the funder alone | Same, at any time, with no Centient key. Cancels a queued tranche. |
| `anchor(campaign, export, root)` | `admin` (2 of 3) | Stores an export's Merkle root, once. |
| `balance(campaign)` | anyone (read) | `{ escrowed, released }`. |
| `campaign(campaign)`, `anchored(campaign, export)`, `config()` | anyone (read) | The full campaign state, an anchored root, the fixed settings. |

There is **no upgrade function**. Errors are `Error(Contract, #n)` with `n` from
`Error` in `escrow/src/lib.rs` (for example `#3` is `CampaignNotFound`).

## Pinned versions

Move these together, on purpose, in their own PR: a contract's behaviour and its
wasm hash depend on them.

| Tool | Version | Pinned in |
|---|---|---|
| Rust | 1.100.0, `wasm32v1-none` target | `rust-toolchain.toml` |
| `soroban-sdk` | 29.0.1 | `Cargo.toml` (`=29.0.1`) and `Cargo.lock` |
| `stellar-cli` | 30.0.1 | this file; check with `stellar --version` |

## Set up (macOS)

```bash
brew install rustup stellar-cli
```

Put `$(brew --prefix rustup)/bin` on your `PATH` (Homebrew's rustup is keg-only),
then run anything from this folder: rustup reads `rust-toolchain.toml` and
installs the pinned Rust and wasm target on first use. It reads that file only
from the directory cargo runs in, so run cargo here, not with `--manifest-path`
from the repo root.

Elsewhere, `cargo install --locked stellar-cli@30.0.1`.

## Test and build

```bash
npm run contracts:test     # cargo test --workspace --locked
npm run contracts:build    # stellar contract build --locked
```

`soroban-sdk` 29 refuses a plain `cargo build --target wasm32v1-none`: build wasm
with `stellar contract build`. Output lands in
`target/wasm32v1-none/release/<crate>.wasm`.

`cargo test` is part of the merge gate: the last steps of the `build` job in
`.github/workflows/ci.yml`, and of `scripts/ci-local.sh`.

## Deploy to testnet

```bash
stellar keys generate deployer --network testnet --fund
stellar contract deploy --wasm target/wasm32v1-none/release/centient_smoke.wasm \
  --source-account deployer --network testnet
stellar contract invoke --id <CONTRACT_ID> --source-account deployer --network testnet -- ping
```

For the escrow, upload the wasm and deploy it with its constructor arguments
(see `docs/escrow-runbook.md` for the exact command and the live IDs):

```bash
stellar contract upload --wasm target/wasm32v1-none/release/centient_escrow.wasm \
  --source-account deployer --network testnet
stellar contract deploy --wasm-hash <WASM_HASH> --source-account deployer --network testnet \
  -- --admin <PAYOUT_ACCOUNT> --token <USDC_SAC> --payout <PAYOUT_ACCOUNT>
```

A deployer key made this way is for testnet only and lives in the CLI's own key
store. Never use a payout signer (platform, ops, policy, cold reserve) as a
deployer or as a SEP-10/SEP-7 key.

## Talking to the chain from the app

Server code reads Soroban state through `lib/stellar/rpc.ts`, which settles the
RPC URL (`STELLAR_RPC_URL`), the per-call timeout (`STELLAR_RPC_TIMEOUT_MS`) and
one error type, `StellarRpcError`. `/api/health/rpc` shows whether a deployment
reaches its RPC on the right network.
