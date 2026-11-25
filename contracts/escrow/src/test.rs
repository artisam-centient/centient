#![cfg(test)]
// Amounts are whole USDC, then its 7 decimal places: 100_0000000 is 100 USDC.
#![allow(clippy::inconsistent_digit_grouping)]
//! Happy paths for every entry point, plus the contract's own rules. The full
//! authorization-path suite (who may NOT call what) is M2-T1 (#250).

use super::*;
use soroban_sdk::{
    testutils::{Address as _, AuthorizedFunction, Events as _, Ledger},
    token::{StellarAssetClient, TokenClient},
    Address, BytesN, Env, Event, IntoVal, String, Symbol,
};

const DAY: u64 = RELEASE_DELAY_SECS;

/// The contract's error as the client's `try_` calls report it.
fn err(e: Error) -> soroban_sdk::Error {
    e.into()
}

/// Whether the escrow's last invocation emitted `event`.
fn emitted(s: &Setup, event: &impl Event) -> bool {
    s.env
        .events()
        .all()
        .filter_by_contract(&s.escrow.address)
        .events()
        .contains(&event.to_xdr(&s.env, &s.escrow.address))
}

struct Setup<'a> {
    env: Env,
    escrow: CampaignEscrowClient<'a>,
    usdc: TokenClient<'a>,
    admin: Address,
    payout: Address,
    funder: Address,
    campaign: String,
}

fn setup<'a>() -> Setup<'a> {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(1_800_000_000);

    let issuer = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(issuer);
    let admin = Address::generate(&env);
    let payout = Address::generate(&env);
    let funder = Address::generate(&env);
    StellarAssetClient::new(&env, &sac.address()).mint(&funder, &1_000_0000000);

    let id = env.register(CampaignEscrow, (&admin, &sac.address(), &payout));
    Setup {
        escrow: CampaignEscrowClient::new(&env, &id),
        usdc: TokenClient::new(&env, &sac.address()),
        campaign: String::from_str(&env, "8a6f2c1e-4b7d-4e2a-9c3f-1d5e6f7a8b9c"),
        env,
        admin,
        payout,
        funder,
    }
}

fn later(env: &Env, secs: u64) {
    env.ledger().set_timestamp(env.ledger().timestamp() + secs);
}

// ---- constructor / config ------------------------------------------------------

#[test]
fn constructor_fixes_admin_token_and_payout() {
    let s = setup();
    let config = s.escrow.config();
    assert_eq!(config.admin, s.admin);
    assert_eq!(config.token, s.usdc.address);
    assert_eq!(config.payout, s.payout);
}

// ---- fund ----------------------------------------------------------------------

#[test]
fn fund_moves_usdc_into_escrow_and_records_the_funder() {
    let s = setup();
    let b = s
        .escrow
        .fund(&s.campaign, &s.funder, &100_0000000, &25_0000000);
    // The funder authorized both the call and the token transfer under it.
    let auths = s.env.auths();
    assert_eq!(auths.len(), 1);
    assert_eq!(auths[0].0, s.funder);
    assert_eq!(
        auths[0].1.function,
        AuthorizedFunction::Contract((
            s.escrow.address.clone(),
            Symbol::new(&s.env, "fund"),
            (
                s.campaign.clone(),
                s.funder.clone(),
                100_0000000_i128,
                25_0000000_i128
            )
                .into_val(&s.env),
        ))
    );

    assert_eq!(
        b,
        Balance {
            escrowed: 100_0000000,
            released: 0
        }
    );
    assert_eq!(s.usdc.balance(&s.escrow.address), 100_0000000);
    assert_eq!(s.usdc.balance(&s.funder), 900_0000000);

    let c = s.escrow.campaign(&s.campaign);
    assert_eq!(c.funder, s.funder);
    assert_eq!(c.tranche_cap, 25_0000000);
    assert!(!c.closed);
}

#[test]
fn fund_again_adds_to_the_campaign_and_resets_the_cap() {
    let s = setup();
    s.escrow
        .fund(&s.campaign, &s.funder, &100_0000000, &25_0000000);
    let b = s
        .escrow
        .fund(&s.campaign, &s.funder, &50_0000000, &10_0000000);
    assert_eq!(b.escrowed, 150_0000000);
    assert_eq!(s.escrow.campaign(&s.campaign).tranche_cap, 10_0000000);
}

#[test]
fn fund_refuses_another_funder_bad_amounts_and_bad_ids() {
    let s = setup();
    s.escrow
        .fund(&s.campaign, &s.funder, &100_0000000, &25_0000000);

    let other = Address::generate(&s.env);
    StellarAssetClient::new(&s.env, &s.usdc.address).mint(&other, &10_0000000);
    assert_eq!(
        s.escrow.try_fund(&s.campaign, &other, &1, &1),
        Err(Ok(err(Error::WrongFunder)))
    );
    assert_eq!(
        s.escrow.try_fund(&s.campaign, &s.funder, &0, &1),
        Err(Ok(err(Error::InvalidAmount)))
    );
    assert_eq!(
        s.escrow.try_fund(&s.campaign, &s.funder, &1, &0),
        Err(Ok(err(Error::InvalidAmount)))
    );
    assert_eq!(
        s.escrow.try_fund(&s.campaign, &s.funder, &-5, &1),
        Err(Ok(err(Error::InvalidAmount)))
    );

    let empty = String::from_str(&s.env, "");
    let long = String::from_str(&s.env, "x".repeat(65).as_str());
    assert_eq!(
        s.escrow.try_fund(&empty, &s.funder, &1, &1),
        Err(Ok(err(Error::InvalidId)))
    );
    assert_eq!(
        s.escrow.try_fund(&long, &s.funder, &1, &1),
        Err(Ok(err(Error::InvalidId)))
    );
}

// ---- queue_release + execute_release ---------------------------------------------

#[test]
fn a_tranche_releases_to_the_payout_account_after_24_hours() {
    let s = setup();
    s.escrow
        .fund(&s.campaign, &s.funder, &100_0000000, &25_0000000);

    let queued_at = s.env.ledger().timestamp();
    let executable_at = s.escrow.queue_release(&s.campaign, &25_0000000);
    assert_eq!(executable_at, queued_at + DAY);
    // queue_release is the payout account's call.
    assert_eq!(s.env.auths()[0].0, s.admin);

    later(&s.env, DAY - 1);
    assert_eq!(
        s.escrow.try_execute_release(&s.campaign),
        Err(Ok(err(Error::StillLocked)))
    );

    later(&s.env, 1);
    let b = s.escrow.execute_release(&s.campaign);
    // Anyone may execute: no authorization was asked for.
    assert!(s.env.auths().is_empty());
    assert_eq!(
        b,
        Balance {
            escrowed: 75_0000000,
            released: 25_0000000
        }
    );
    assert_eq!(s.usdc.balance(&s.payout), 25_0000000);
    assert_eq!(s.usdc.balance(&s.escrow.address), 75_0000000);
    assert_eq!(s.escrow.campaign(&s.campaign).queued, 0);
}

#[test]
fn queue_release_holds_to_the_cap_the_balance_and_one_a_day() {
    let s = setup();
    s.escrow
        .fund(&s.campaign, &s.funder, &30_0000000, &25_0000000);

    assert_eq!(
        s.escrow.try_queue_release(&s.campaign, &25_0000001),
        Err(Ok(err(Error::AboveTrancheCap)))
    );
    assert_eq!(
        s.escrow.try_queue_release(&s.campaign, &0),
        Err(Ok(err(Error::InvalidAmount)))
    );

    s.escrow.queue_release(&s.campaign, &20_0000000);
    assert_eq!(
        s.escrow.try_queue_release(&s.campaign, &1),
        Err(Ok(err(Error::ReleasePending)))
    );
    later(&s.env, DAY);
    s.escrow.execute_release(&s.campaign);

    // 10 left: a tranche above it is refused even though it's under the cap.
    assert_eq!(
        s.escrow.try_queue_release(&s.campaign, &10_0000001),
        Err(Ok(err(Error::AboveBalance)))
    );
    s.escrow.queue_release(&s.campaign, &10_0000000);
    later(&s.env, DAY);
    s.escrow.execute_release(&s.campaign);
    assert_eq!(
        s.escrow.balance(&s.campaign),
        Balance {
            escrowed: 0,
            released: 30_0000000
        }
    );
}

#[test]
fn releases_are_at_most_one_a_day() {
    let s = setup();
    s.escrow
        .fund(&s.campaign, &s.funder, &100_0000000, &10_0000000);
    let first = s.env.ledger().timestamp();
    s.escrow.queue_release(&s.campaign, &10_0000000);

    // A second tranche can't be queued while the first waits out its day...
    later(&s.env, DAY - 1);
    assert_eq!(
        s.escrow.try_queue_release(&s.campaign, &1),
        Err(Ok(err(Error::ReleasePending)))
    );

    // ...so the next one is queued, and paid, a full day after the first.
    later(&s.env, 1);
    s.escrow.execute_release(&s.campaign);
    let second = s.escrow.queue_release(&s.campaign, &10_0000000) - DAY;
    assert!(second >= first + DAY);
    later(&s.env, DAY);
    assert_eq!(s.escrow.execute_release(&s.campaign).released, 20_0000000);
}

#[test]
fn execute_release_needs_a_queued_tranche() {
    let s = setup();
    s.escrow
        .fund(&s.campaign, &s.funder, &100_0000000, &10_0000000);
    assert_eq!(
        s.escrow.try_execute_release(&s.campaign),
        Err(Ok(err(Error::NothingQueued)))
    );
}

// ---- refund ----------------------------------------------------------------------

#[test]
fn refund_returns_the_unreleased_balance_to_the_funder_and_closes() {
    let s = setup();
    s.escrow
        .fund(&s.campaign, &s.funder, &100_0000000, &25_0000000);
    s.escrow.queue_release(&s.campaign, &25_0000000);
    later(&s.env, DAY);
    s.escrow.execute_release(&s.campaign);

    assert_eq!(s.escrow.refund(&s.campaign), 75_0000000);
    assert_eq!(s.env.auths()[0].0, s.admin);
    assert_eq!(s.usdc.balance(&s.funder), 975_0000000);
    assert_eq!(s.usdc.balance(&s.escrow.address), 0);

    let c = s.escrow.campaign(&s.campaign);
    assert!(c.closed);
    assert_eq!(
        s.escrow.balance(&s.campaign),
        Balance {
            escrowed: 0,
            released: 25_0000000
        }
    );
    assert_eq!(
        s.escrow.try_refund(&s.campaign),
        Err(Ok(err(Error::CampaignClosed)))
    );
    assert_eq!(
        s.escrow.try_fund(&s.campaign, &s.funder, &1, &1),
        Err(Ok(err(Error::CampaignClosed)))
    );
    assert_eq!(
        s.escrow.try_queue_release(&s.campaign, &1),
        Err(Ok(err(Error::CampaignClosed)))
    );
}

// ---- reclaim ---------------------------------------------------------------------

#[test]
fn reclaim_returns_everything_held_and_cancels_the_queued_tranche() {
    let s = setup();
    s.escrow
        .fund(&s.campaign, &s.funder, &100_0000000, &25_0000000);
    s.escrow.queue_release(&s.campaign, &25_0000000);

    assert_eq!(s.escrow.reclaim(&s.campaign), 100_0000000);
    // Only the funder signed.
    let auths = s.env.auths();
    assert_eq!(auths.len(), 1);
    assert_eq!(auths[0].0, s.funder);
    assert_eq!(s.usdc.balance(&s.funder), 1_000_0000000);

    later(&s.env, DAY);
    assert_eq!(
        s.escrow.try_execute_release(&s.campaign),
        Err(Ok(err(Error::NothingQueued)))
    );
    assert_eq!(s.usdc.balance(&s.payout), 0);
    assert_eq!(
        s.escrow.try_reclaim(&s.campaign),
        Err(Ok(err(Error::CampaignClosed)))
    );
}

// ---- anchor ----------------------------------------------------------------------

#[test]
fn anchor_stores_a_root_once_and_reads_it_back() {
    let s = setup();
    s.escrow
        .fund(&s.campaign, &s.funder, &100_0000000, &25_0000000);
    let export = String::from_str(&s.env, "export-v2-0001");
    let root = BytesN::from_array(&s.env, &[7; 32]);

    s.escrow.anchor(&s.campaign, &export, &root);
    assert_eq!(s.env.auths()[0].0, s.admin);
    assert_eq!(s.escrow.anchored(&s.campaign, &export), root);

    let other = BytesN::from_array(&s.env, &[9; 32]);
    assert_eq!(
        s.escrow.try_anchor(&s.campaign, &export, &other),
        Err(Ok(err(Error::AlreadyAnchored)))
    );
    let unknown = String::from_str(&s.env, "nope");
    assert_eq!(
        s.escrow.try_anchored(&s.campaign, &unknown),
        Err(Ok(err(Error::NotAnchored)))
    );
    assert_eq!(
        s.escrow.try_anchor(
            &String::from_str(&s.env, "no-such-campaign"),
            &export,
            &root
        ),
        Err(Ok(err(Error::CampaignNotFound)))
    );
}

#[test]
fn anchor_works_on_a_closed_campaign() {
    let s = setup();
    s.escrow
        .fund(&s.campaign, &s.funder, &10_0000000, &10_0000000);
    s.escrow.refund(&s.campaign);
    let export = String::from_str(&s.env, "final");
    s.escrow
        .anchor(&s.campaign, &export, &BytesN::from_array(&s.env, &[1; 32]));
}

// ---- balance ---------------------------------------------------------------------

#[test]
fn balance_reads_escrowed_and_released_and_refuses_unknown_campaigns() {
    let s = setup();
    assert_eq!(
        s.escrow.try_balance(&s.campaign),
        Err(Ok(err(Error::CampaignNotFound)))
    );
    s.escrow
        .fund(&s.campaign, &s.funder, &40_0000000, &40_0000000);
    assert_eq!(
        s.escrow.balance(&s.campaign),
        Balance {
            escrowed: 40_0000000,
            released: 0
        }
    );
}

// ---- events and TTL ----------------------------------------------------------------

#[test]
fn every_write_emits_an_event() {
    let s = setup();
    s.escrow
        .fund(&s.campaign, &s.funder, &100_0000000, &25_0000000);
    assert!(emitted(
        &s,
        &Funded {
            campaign: s.campaign.clone(),
            funder: s.funder.clone(),
            amount: 100_0000000,
            tranche_cap: 25_0000000,
            escrowed: 100_0000000,
        }
    ));

    let at = s.escrow.queue_release(&s.campaign, &25_0000000);
    assert!(emitted(
        &s,
        &ReleaseQueued {
            campaign: s.campaign.clone(),
            amount: 25_0000000,
            executable_at: at
        }
    ));

    later(&s.env, DAY);
    s.escrow.execute_release(&s.campaign);
    assert!(emitted(
        &s,
        &Released {
            campaign: s.campaign.clone(),
            to: s.payout.clone(),
            amount: 25_0000000,
            escrowed: 75_0000000,
        }
    ));

    let export = String::from_str(&s.env, "e1");
    let root = BytesN::from_array(&s.env, &[3; 32]);
    s.escrow.anchor(&s.campaign, &export, &root);
    assert!(emitted(
        &s,
        &Anchored {
            campaign: s.campaign.clone(),
            export,
            root
        }
    ));

    s.escrow.refund(&s.campaign);
    assert!(emitted(
        &s,
        &Refunded {
            campaign: s.campaign.clone(),
            to: s.funder.clone(),
            amount: 75_0000000
        }
    ));
}

#[test]
fn reclaim_emits_what_it_returned_and_cancelled() {
    let s = setup();
    s.escrow
        .fund(&s.campaign, &s.funder, &100_0000000, &25_0000000);
    s.escrow.queue_release(&s.campaign, &20_0000000);
    s.escrow.reclaim(&s.campaign);
    assert!(emitted(
        &s,
        &Reclaimed {
            campaign: s.campaign.clone(),
            to: s.funder.clone(),
            amount: 100_0000000,
            cancelled: 20_0000000,
        }
    ));
}

#[test]
fn writes_extend_the_campaign_entry_ttl() {
    use soroban_sdk::testutils::storage::Persistent as _;
    let s = setup();
    s.escrow
        .fund(&s.campaign, &s.funder, &10_0000000, &10_0000000);
    let ttl = s.env.as_contract(&s.escrow.address, || {
        s.env
            .storage()
            .persistent()
            .get_ttl(&DataKey::Campaign(s.campaign.clone()))
    });
    assert!(
        ttl >= TTL_THRESHOLD,
        "campaign TTL {ttl} below the threshold"
    );
}
