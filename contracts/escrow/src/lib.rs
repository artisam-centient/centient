//! Centient campaign escrow (#246, SOW feature 2, ADR-0014).
//!
//! A partner funds a campaign in USDC through the Stellar Asset Contract. The
//! money leaves only three ways:
//!
//! - **Release:** the payout account (2-of-3: ops key + policy co-signer)
//!   queues a tranche, at most the funder's cap and at most one a day. Anyone
//!   can execute it 24 h later. It is paid to the payout destination fixed at
//!   deploy, never anywhere else.
//! - **Refund:** the payout account returns the unreleased balance, only to the
//!   funder.
//! - **Reclaim:** the funder alone takes the unreleased balance back at any
//!   time. No Centient key is involved. A queued tranche that hasn't executed
//!   is cancelled.
//!
//! Refund and reclaim close the campaign: no more funding or releases. A new
//! round of funding uses a new campaign id.
//!
//! The admin, token and payout destination are fixed by the constructor and
//! nothing can change them. There is **no upgrade function**: a fix is a fresh
//! deployment, and the old contract stays refundable and reclaimable.
//!
//! Every write emits an event for the indexer (#252) and extends the TTL of the
//! entries it touches.
#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error, token,
    Address, BytesN, Env, String,
};

/// A tranche waits this long between `queue_release` and `execute_release`.
/// Only one tranche can be queued at a time, so releases are at least this far
/// apart: at most one a day.
pub const RELEASE_DELAY_SECS: u64 = 24 * 60 * 60;

/// Campaign and export ids are Centient's UUIDs (36 characters). The bound
/// keeps storage keys small.
pub const MAX_ID_LEN: u32 = 64;

// Ledgers close about every 5 s, so a day is about 17,280 ledgers. Every write
// pushes the entries it touches out to ~30 days once they fall under ~15 days.
// #263 runs the scheduled upkeep for anything quieter than that.
const DAY_IN_LEDGERS: u32 = 17_280;
const TTL_THRESHOLD: u32 = 15 * DAY_IN_LEDGERS;
const TTL_EXTEND_TO: u32 = 30 * DAY_IN_LEDGERS;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    /// An amount or tranche cap is zero or negative.
    InvalidAmount = 1,
    /// A campaign or export id is empty or longer than `MAX_ID_LEN`.
    InvalidId = 2,
    /// No campaign has been funded under this id.
    CampaignNotFound = 3,
    /// The campaign was refunded or reclaimed, so it takes no more funding or releases.
    CampaignClosed = 4,
    /// Only the campaign's original funder can add to it.
    WrongFunder = 5,
    /// The tranche is above the funder's cap.
    AboveTrancheCap = 6,
    /// The tranche is above what the campaign still holds.
    AboveBalance = 7,
    /// A tranche is already queued; execute it first. With the 24 h delay
    /// this is what keeps releases to at most one a day.
    ReleasePending = 8,
    /// Nothing is queued for this campaign.
    NothingQueued = 9,
    /// The queued tranche's 24 h delay hasn't passed yet.
    StillLocked = 10,
    /// This export already has a root; roots are write-once.
    AlreadyAnchored = 11,
    /// No root is anchored for this export.
    NotAnchored = 12,
}

/// Everything the contract knows about one campaign.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Campaign {
    /// The wallet that paid in. Refunds and reclaims go here and nowhere else.
    pub funder: Address,
    /// The largest tranche the payout account may queue. Set by the funder on every `fund`.
    pub tranche_cap: i128,
    /// Total paid in.
    pub funded: i128,
    /// Total paid out to the payout destination.
    pub released: i128,
    /// Total returned to the funder (refund or reclaim).
    pub returned: i128,
    /// The tranche waiting for its 24 h delay, or 0 when none is queued.
    pub queued: i128,
    /// Ledger timestamp (seconds) when `queued` was queued; 0 when none is.
    pub queued_at: u64,
    /// Set by refund or reclaim. A closed campaign holds nothing and takes nothing.
    pub closed: bool,
}

impl Campaign {
    /// What the contract still holds for this campaign.
    pub fn escrowed(&self) -> i128 {
        self.funded - self.released - self.returned
    }
}

/// What `balance` reports.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Balance {
    /// Still held by the contract, queued tranche included.
    pub escrowed: i128,
    /// Paid out to the payout destination so far.
    pub released: i128,
}

/// The settings fixed at deploy.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Config {
    /// The 2-of-3 payout account. Authorizes queue_release, refund and anchor.
    pub admin: Address,
    /// The USDC Stellar Asset Contract.
    pub token: Address,
    /// Where released tranches go.
    pub payout: Address,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Config,
    Campaign(String),
    Anchor(String, String),
}

// ---- events (topics: the event name, then the campaign id) -------------------

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Funded {
    #[topic]
    pub campaign: String,
    pub funder: Address,
    pub amount: i128,
    pub tranche_cap: i128,
    pub escrowed: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ReleaseQueued {
    #[topic]
    pub campaign: String,
    pub amount: i128,
    pub executable_at: u64,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Released {
    #[topic]
    pub campaign: String,
    pub to: Address,
    pub amount: i128,
    pub escrowed: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Refunded {
    #[topic]
    pub campaign: String,
    pub to: Address,
    pub amount: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Reclaimed {
    #[topic]
    pub campaign: String,
    pub to: Address,
    pub amount: i128,
    /// The queued tranche this cancelled, or 0.
    pub cancelled: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Anchored {
    #[topic]
    pub campaign: String,
    pub export: String,
    pub root: BytesN<32>,
}

// ---- contract ----------------------------------------------------------------

#[contract]
pub struct CampaignEscrow;

#[contractimpl]
impl CampaignEscrow {
    /// Runs once, inside the deploy transaction. Nothing can change these later.
    pub fn __constructor(env: Env, admin: Address, token: Address, payout: Address) {
        let config = Config {
            admin,
            token,
            payout,
        };
        env.storage().instance().set(&DataKey::Config, &config);
        bump_instance(&env);
    }

    /// Move `amount` USDC from `funder` into escrow for `campaign`, and set the
    /// largest tranche the payout account may queue. The first call creates the
    /// campaign; later calls must come from the same funder.
    pub fn fund(
        env: Env,
        campaign: String,
        funder: Address,
        amount: i128,
        tranche_cap: i128,
    ) -> Balance {
        funder.require_auth();
        check_id(&env, &campaign);
        if amount <= 0 || tranche_cap <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }

        let key = DataKey::Campaign(campaign.clone());
        let mut state = match env.storage().persistent().get::<_, Campaign>(&key) {
            Some(existing) => {
                if existing.closed {
                    panic_with_error!(&env, Error::CampaignClosed);
                }
                if existing.funder != funder {
                    panic_with_error!(&env, Error::WrongFunder);
                }
                existing
            }
            None => Campaign {
                funder: funder.clone(),
                tranche_cap,
                funded: 0,
                released: 0,
                returned: 0,
                queued: 0,
                queued_at: 0,
                closed: false,
            },
        };
        state.funded += amount;
        state.tranche_cap = tranche_cap;
        save(&env, &key, &state);

        let config = config(&env);
        token::Client::new(&env, &config.token).transfer(
            &funder,
            env.current_contract_address(),
            &amount,
        );

        Funded {
            campaign,
            funder,
            amount,
            tranche_cap,
            escrowed: state.escrowed(),
        }
        .publish(&env);
        balance_of(&state)
    }

    /// Queue a tranche of `amount` for release in 24 h. Needs the payout
    /// account's authorization (its two signatures). At most the funder's cap,
    /// at most what the campaign holds, one queued at a time (so one a day).
    pub fn queue_release(env: Env, campaign: String, amount: i128) -> u64 {
        let config = config(&env);
        config.admin.require_auth();
        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }

        let key = DataKey::Campaign(campaign.clone());
        let mut state = load(&env, &key);
        if state.closed {
            panic_with_error!(&env, Error::CampaignClosed);
        }
        if state.queued > 0 {
            panic_with_error!(&env, Error::ReleasePending);
        }
        if amount > state.tranche_cap {
            panic_with_error!(&env, Error::AboveTrancheCap);
        }
        if amount > state.escrowed() {
            panic_with_error!(&env, Error::AboveBalance);
        }
        let now = env.ledger().timestamp();
        state.queued = amount;
        state.queued_at = now;
        save(&env, &key, &state);

        let executable_at = now + RELEASE_DELAY_SECS;
        ReleaseQueued {
            campaign,
            amount,
            executable_at,
        }
        .publish(&env);
        executable_at
    }

    /// Pay the queued tranche to the payout destination. Anyone can call it,
    /// once 24 h have passed since it was queued.
    pub fn execute_release(env: Env, campaign: String) -> Balance {
        let key = DataKey::Campaign(campaign.clone());
        let mut state = load(&env, &key);
        // Refund and reclaim clear the queue, so a closed campaign lands here too.
        let amount = state.queued;
        if amount == 0 {
            panic_with_error!(&env, Error::NothingQueued);
        }
        if env.ledger().timestamp() < state.queued_at + RELEASE_DELAY_SECS {
            panic_with_error!(&env, Error::StillLocked);
        }
        if amount > state.escrowed() {
            panic_with_error!(&env, Error::AboveBalance);
        }

        state.released += amount;
        state.queued = 0;
        state.queued_at = 0;
        save(&env, &key, &state);

        let config = config(&env);
        token::Client::new(&env, &config.token).transfer(
            &env.current_contract_address(),
            &config.payout,
            &amount,
        );

        Released {
            campaign,
            to: config.payout,
            amount,
            escrowed: state.escrowed(),
        }
        .publish(&env);
        balance_of(&state)
    }

    /// Return the unreleased balance to the funder and close the campaign.
    /// Needs the payout account's authorization (its two signatures).
    pub fn refund(env: Env, campaign: String) -> i128 {
        let config = config(&env);
        config.admin.require_auth();

        let key = DataKey::Campaign(campaign.clone());
        let mut state = load(&env, &key);
        if state.closed {
            panic_with_error!(&env, Error::CampaignClosed);
        }
        let amount = close(&env, &key, &mut state, &config);

        Refunded {
            campaign,
            to: state.funder,
            amount,
        }
        .publish(&env);
        amount
    }

    /// The funder takes the unreleased balance back and ends releases. Only the
    /// funder signs; no Centient key is involved. A queued tranche is cancelled.
    pub fn reclaim(env: Env, campaign: String) -> i128 {
        let key = DataKey::Campaign(campaign.clone());
        let mut state = load(&env, &key);
        state.funder.require_auth();
        if state.closed {
            panic_with_error!(&env, Error::CampaignClosed);
        }
        let cancelled = state.queued;
        let amount = close(&env, &key, &mut state, &config(&env));

        Reclaimed {
            campaign,
            to: state.funder,
            amount,
            cancelled,
        }
        .publish(&env);
        amount
    }

    /// Store an export's Merkle root (#258) so anyone can read it back (#264).
    /// Needs the payout account's authorization. Roots are write-once.
    pub fn anchor(env: Env, campaign: String, export: String, root: BytesN<32>) {
        let config = config(&env);
        config.admin.require_auth();
        check_id(&env, &export);
        let campaign_key = DataKey::Campaign(campaign.clone());
        if !env.storage().persistent().has(&campaign_key) {
            panic_with_error!(&env, Error::CampaignNotFound);
        }

        let key = DataKey::Anchor(campaign.clone(), export.clone());
        if env.storage().persistent().has(&key) {
            panic_with_error!(&env, Error::AlreadyAnchored);
        }
        env.storage().persistent().set(&key, &root);
        bump(&env, &key);
        bump(&env, &campaign_key);
        bump_instance(&env);

        Anchored {
            campaign,
            export,
            root,
        }
        .publish(&env);
    }

    // ---- reads ---------------------------------------------------------------

    /// What the campaign still holds and what it has released.
    pub fn balance(env: Env, campaign: String) -> Balance {
        balance_of(&load(&env, &DataKey::Campaign(campaign)))
    }

    /// The campaign's full state: funder, cap, totals, queued tranche.
    pub fn campaign(env: Env, campaign: String) -> Campaign {
        load(&env, &DataKey::Campaign(campaign))
    }

    /// The root anchored for an export.
    pub fn anchored(env: Env, campaign: String, export: String) -> BytesN<32> {
        match env
            .storage()
            .persistent()
            .get(&DataKey::Anchor(campaign, export))
        {
            Some(root) => root,
            None => panic_with_error!(&env, Error::NotAnchored),
        }
    }

    /// The admin, token and payout destination fixed at deploy.
    pub fn config(env: Env) -> Config {
        config(&env)
    }
}

// ---- helpers -------------------------------------------------------------------

fn config(env: &Env) -> Config {
    env.storage().instance().get(&DataKey::Config).unwrap()
}

fn check_id(env: &Env, id: &String) {
    if id.is_empty() || id.len() > MAX_ID_LEN {
        panic_with_error!(env, Error::InvalidId);
    }
}

fn load(env: &Env, key: &DataKey) -> Campaign {
    match env.storage().persistent().get(key) {
        Some(state) => state,
        None => panic_with_error!(env, Error::CampaignNotFound),
    }
}

fn save(env: &Env, key: &DataKey, state: &Campaign) {
    env.storage().persistent().set(key, state);
    bump(env, key);
    bump_instance(env);
}

/// Send everything still held back to the funder, clear the queue and close.
/// State is written before the transfer.
fn close(env: &Env, key: &DataKey, state: &mut Campaign, config: &Config) -> i128 {
    let amount = state.escrowed();
    state.returned += amount;
    state.queued = 0;
    state.queued_at = 0;
    state.closed = true;
    save(env, key, state);
    if amount > 0 {
        token::Client::new(env, &config.token).transfer(
            &env.current_contract_address(),
            &state.funder,
            &amount,
        );
    }
    amount
}

fn balance_of(state: &Campaign) -> Balance {
    Balance {
        escrowed: state.escrowed(),
        released: state.released,
    }
}

fn bump(env: &Env, key: &DataKey) {
    let to = TTL_EXTEND_TO.min(env.storage().max_ttl());
    env.storage()
        .persistent()
        .extend_ttl(key, TTL_THRESHOLD.min(to), to);
}

fn bump_instance(env: &Env) {
    let to = TTL_EXTEND_TO.min(env.storage().max_ttl());
    env.storage()
        .instance()
        .extend_ttl(TTL_THRESHOLD.min(to), to);
}

#[cfg(test)]
mod test;
