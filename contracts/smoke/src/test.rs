#![cfg(test)]

use super::{Smoke, SmokeClient};
use soroban_sdk::{testutils::Ledger, Env};

#[test]
fn ping_counts_calls_and_reads_the_ledger() {
    let env = Env::default();
    env.ledger().set_sequence_number(1_234);
    let id = env.register(Smoke, ());
    let client = SmokeClient::new(&env, &id);

    assert_eq!(client.pings(), 0);
    assert_eq!(client.ping(), (1, 1_234));

    env.ledger().set_sequence_number(1_235);
    assert_eq!(client.ping(), (2, 1_235));
    assert_eq!(client.pings(), 2);
}

#[test]
fn each_deployment_keeps_its_own_count() {
    let env = Env::default();
    let a = SmokeClient::new(&env, &env.register(Smoke, ()));
    let b = SmokeClient::new(&env, &env.register(Smoke, ()));

    a.ping();
    a.ping();
    b.ping();

    assert_eq!(a.pings(), 2);
    assert_eq!(b.pings(), 1);
}
