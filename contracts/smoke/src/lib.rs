//! A trivial contract that keeps the Soroban toolchain honest (#244).
//!
//! It holds no funds and no state worth keeping. It exists so `cargo test` in
//! the CI gate exercises the real SDK, the contract macros and the test host
//! from day one, before the escrow (#246) arrives.
#![no_std]

use soroban_sdk::{contract, contractimpl, symbol_short, Env, Symbol};

const PINGS: Symbol = symbol_short!("PINGS");

#[contract]
pub struct Smoke;

#[contractimpl]
impl Smoke {
    /// Count this call and return the new total with the current ledger.
    pub fn ping(env: Env) -> (u32, u32) {
        let pings: u32 = env.storage().instance().get(&PINGS).unwrap_or(0) + 1;
        env.storage().instance().set(&PINGS, &pings);
        (pings, env.ledger().sequence())
    }

    /// How many times `ping` has run.
    pub fn pings(env: Env) -> u32 {
        env.storage().instance().get(&PINGS).unwrap_or(0)
    }
}

#[cfg(test)]
mod test;
