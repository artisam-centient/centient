# Soroban contracts

Centient's Soroban contracts, in one Cargo workspace. Testnet only (D-7).

| Crate | What it is |
|---|---|
| `smoke` | A trivial contract (`ping`, `pings`) that proves the toolchain builds, tests and deploys. It holds nothing. |

The campaign escrow (#246) joins `members` in `Cargo.toml` next to `smoke`.

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

A deployer key made this way is for testnet only and lives in the CLI's own key
store. Never use a payout signer (platform, ops, policy, cold reserve) as a
deployer or as a SEP-10/SEP-7 key.

## Talking to the chain from the app

Server code reads Soroban state through `lib/stellar/rpc.ts`, which settles the
RPC URL (`STELLAR_RPC_URL`), the per-call timeout (`STELLAR_RPC_TIMEOUT_MS`) and
one error type, `StellarRpcError`. `/api/health/rpc` shows whether a deployment
reaches its RPC on the right network.
