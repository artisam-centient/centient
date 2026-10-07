# Contributor onboarding and gamification plan

**Status:** proposal for the owner's review, 7 October 2026. Nothing here is built yet.
**Network:** Stellar testnet only (D-7). Test USDC has no cash value, and this plan never presents it as money.
**Evidence:** [onboarding research](onboarding-research.md) for the behavioural and market evidence, and [campaign design partners](campaign-design-partners.md) for the AI startups that would supply the tasks.

## The plan on one page

**Goal.** Contributors who come back every day and do careful work, measured as **Daily Quality Contributors** (DQC).

**Seven moves:**

1. **Value before effort.** An interactive sample task on the landing page, a setup checklist that counts the wallet as progress, Android sign-in tested, and demographics moved after the third answer. Target: a first paid answer within two minutes of signing in.
2. **A small, forgiving daily habit.** A daily goal the contributor picks (5, 10 or 20 answers), a streak counted in Manila days, streak freezes, and a rule that an empty task pool never breaks a streak.
3. **A game that rewards accuracy.** XP comes only from accepted answers and is weighted by quality-check accuracy, with a daily cap. Levels track effort. Tiers (Regular, Trusted, Expert, Mentor) track quality and unlock better work.
4. **Social pull.** Weekly leagues by nickname, squads of three to eight people, referrals that pay out only once the new contributor proves quality, and community goals such as "Get Cebuano to 1,000 answers".
5. **Honest tester incentives.** A Founding Contributor programme for the testnet seasons: status, a tier that carries over to mainnet, mobile load for streak milestones, league prizes, bug bounties, and a fixed mainnet welcome bonus. About ₱187,000 (roughly $3,200) for a six-week season.
6. **A daily-use engine.** Opt-in reminders by web push, a fixed daily drop of new tasks, and a guaranteed supply of tasks from an evergreen pool and design-partner campaigns.
7. **Seasons.** A two-week closed Season 0 in November, then a six-week public Season 1 from 11 January 2027 with themed weeks, ending with Founding Contributor certification.

**What it needs:** four epics and 16 issues, built one at a time on the existing stack, plus owner decisions on budget, legal review and the mainnet bonus (see [§12](#12-decisions-for-the-owner)).

---

## 1. Goal and measurement

### North star: Daily Quality Contributors

A **DQC** is a contributor who, on a Manila calendar day, meets their daily goal (at least five accepted answers) while their quality-check accuracy is at least 70%, the same bar as `WITHDRAWAL_MIN_GOLD_RATE`.

Raw daily actives would count drive-by visits, and raw answer counts would reward grinding. DQC counts what the product and its customers need: people who return and do careful work.

### Metric tree and Season 1 targets

Today's baseline is 25 unique wallets in the instant-payout window (the #49 volume proof). Nobody measures day-1 or day-7 retention yet, so Epic 1 establishes the baseline first. Retention targets sit in the "good" band from the research.

| Layer | Metric | Definition | Season 1 target |
| --- | --- | --- | --- |
| Acquisition | Wallet setup completion | Signed in ÷ started connecting | ≥ 60% |
| Activation | First answer | Accepted answer within 24 h of first sign-in | ≥ 70% |
| Activation | Day-0 goal | New contributors who meet their goal on their first day | ≥ 40% |
| Retention | D1 / D7 / D30 | Active on day *n* after first sign-in | ≥ 40% / ≥ 25% / ≥ 15% |
| Habit | Stickiness | DAU ÷ MAU | ≥ 30% |
| Habit | Streak share | Weekly actives holding a streak of 7+ days | ≥ 35% |
| Scale | Activated contributors | At least one accepted answer during the season | 400 (floor 200) |
| Scale | DQC | Daily average in the final week | 120 (floor 60) |
| Social | Referred share | New contributors who arrived by invite | ≥ 25% |
| Quality guardrail | Accuracy | Median quality-check accuracy | ≥ 80% |
| Quality guardrail | Agreement | Share of answers matching the majority on resolved tasks (`Task.majorityAnswer`) | No drop of more than 3 points from the Season 0 baseline |
| Quality guardrail | Blocked answers | Spam, repetition and bias rejections ÷ submissions | ≤ 5% |
| Quality guardrail | Early pauses | New contributors cooled down in their first week | ≤ 5% |
| Cost | Incentive cost per DQC | Season incentive spend ÷ final-week DQC | ≤ ₱1,600 |

If a quality guardrail fails for a week, incentives tied to volume (league prizes, streak load) pause until it recovers.

## 2. The contributor journey, redesigned

### Stages

| Stage | Contributor's goal | What changes | Owl |
| --- | --- | --- | --- |
| **Discover** | "Is this real, and can I do it?" | **Try a sample task** on the landing page: one real-looking pair, answered in the browser with nothing stored and no account. The receipt reads "That's the whole task. Set up a wallet to get paid for the next one," with the testnet note | `owl-think` |
| **Set up** | A wallet in under five minutes | A **setup checklist** with progress counted from the first step ("Step 2 of 4"). Separate guides for Chrome, Android and iOS, in English and Filipino. Help at campus sessions and in the community chat. **Android QA** of Freighter Mobile before Season 0 | `owl-laptop` |
| **First answer** | A first payment, fast | Demographics move after the **third accepted answer**, as an optional "Help us check AI for fairness" card. The first tasks come from a clear-cut **welcome set**. The first payment gets its own moment: "Your first payment is on the ledger", with the transaction link. Then **pick a daily goal** | `owl-wave` |
| **Learn** | Know what "better" means here | The first three quality checks are **training checks** that explain the right answer and don't count toward the pause rule ([§3.9](#39-coaching-and-beginner-safe-quality)). Tips on writing reasons, inside the task | `owl-idea` |
| **Habit** | Come back daily | Goal ring, streak and freezes, reminders, daily quests, weekly league, squad | `owl-laptop` |
| **Mastery** | Grow | Trusted and Expert tiers open better-paid and specialist campaigns. Mentors run squads and sessions. Founding Contributor status and a season certificate | `owl-chart` |

The sample task asks for **less** than a wallet signature, so it keeps the "the wallet is the account" principle. Nothing is saved, and nothing is paid.

### The first 30 days

| Day | What the contributor sees | What brings them back |
| --- | --- | --- |
| 0 | Sample task, wallet setup, first answer, first payment receipt, daily goal picked, goal met, streak at 1 | Opt-in reminder at a time they choose |
| 1 | Reminder, then goal met and streak at 2. Daily quests appear | Quests, streak |
| 2 | Training checks finished, with explanations. "Sharp eye" badge progress | Learning |
| 3 | Invitation to start or join a squad | Friends |
| 4–6 | First weekly league placement after Monday's reset | Rank |
| 7 | **7-day milestone**: a streak freeze, the "Week one" badge and, once Regular, a ₱50 load claim | A real reward |
| 14 | Halfway to Trusted. First weekly "Your impact" summary | Progress, meaning |
| 21 | Invitation to an expert track (Filipino writing, Cebuano, education, coding) | Better work |
| 30 | **30-day milestone**: "Month one" badge, ₱200 load claim. Founding Contributor status locks once Trusted | Status, a real reward |

## 3. The game system

### 3.1 XP

XP is a **progress stat**. It is not money and not a token. It can't be transferred, traded or cashed out, and it never converts into anything. That rule gets its own ADR ([§8.5](#85-adrs-to-write)).

| Event | XP |
| --- | --- |
| Accepted answer | 10 × quality multiplier |
| Passed quality check | 15 × quality multiplier |
| Failed quality check, blocked answer (spam, repetition, rate limit, bias) | 0 |
| Daily goal met | +20, once a day |
| Daily or weekly quest | +10 to +50 |
| Streak milestone at 7 / 14 / 30 / 50 / 100 days | +100 / +150 / +300 / +500 / +1,000 |
| Invited contributor reaches Regular | +200 for the inviter, +100 for the new contributor |

**Quality multiplier.** It is taken from quality-check accuracy with a starting prior, so the first checks don't swing it wildly: (correct + 4) ÷ (attempted + 5).

| Accuracy | Multiplier |
| --- | --- |
| 90% or more | 1.25 |
| 80–89% | 1.0 |
| 70–79% | 0.8 |
| Under 70% | 0.5 |

Show the contributor their **band** ("Excellent", "Good", "Needs work"), not the exact percentage. ADR-0004 keeps working values out of logs so nobody can see how close an account is to a threshold, and the UI should follow the same logic.

**Daily cap.** XP from answers stops at 400 a day, about 35 answers. Later answers still count toward the goal and are still paid. The cap keeps leagues about consistency rather than binges, and it limits farming.

### 3.2 Daily goal and streak

* **Goal:** Light (5), Regular (10, the default) or Serious (20). The contributor picks one after their first answer and can change it once a day. At 30–40 seconds an answer, ten answers is a five-to-seven-minute session.
* **Day:** the Asia/Manila calendar day. The payout cap keeps its UTC day; the two are separate.
* **Streak:** +1 for each day the goal is met.
* **Streak freeze:** covers one missed day. One is earned at each 7-day milestone, or bought for 200 XP. At most two can be held, as in Duolingo, where allowing two raised daily actives by 0.38%.
* **Streak repair:** a missed day with no freeze can be repaired by meeting double the goal the next day.
* **Supply protection:** if Centient had no task to serve when the contributor asked for one, that day can't break their streak. An empty pool is Centient's failure, not theirs.
* **Quality pause:** a cooldown doesn't protect the streak automatically, but held freezes still apply.

### 3.3 Levels

Levels show effort and unlock cosmetic things such as badge frames and quest variety. They never change pay.

| Level | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Total XP | 0 | 100 | 300 | 600 | 1,000 | 1,500 | 2,200 | 3,000 | 4,000 | 5,500 |

At ten answers a day (about 150 XP with the goal bonus and quests), level 5 takes about a week and level 10 about five weeks: one season.

### 3.4 Tiers

Tiers show **quality** and unlock work and real rewards. A coin flip scores 50% on an A/B quality check, so every tier gate sits well above chance.

| Tier | Requirements | Unlocks |
| --- | --- | --- |
| **Starter** | Signed in, wallet bound | Platform tasks, daily goal, XP |
| **Regular** | 50 accepted answers, accuracy ≥ 70%, account at least 24 h old. These match the existing `WITHDRAWAL_MIN_*` recommendations | League prizes, referral rewards, streak load rewards, all general campaigns |
| **Trusted** | 200 accepted answers, accuracy ≥ 85%, active on 14 different days, no cooldown in the last 30 days | Higher-reward campaigns (`Campaign.minTier`), Founding Contributor qualification |
| **Expert** (per domain or language) | Trusted, plus a 20-question qualification at ≥ 90% | Expert campaigns at a higher reward (`Campaign.rewardUnits` already varies per campaign) |
| **Mentor** | Trusted, plus operator approval | Run squads and onboarding sessions, a season stipend, and later, dispute review |

Tiers are re-checked weekly. A contributor who falls below a gate gets two weeks' grace before dropping a tier.

### 3.5 Weekly leagues

* Monday 00:00 to Sunday 23:59, Manila time.
* Groups of up to 30 contributors in the same division, formed as people earn their first XP of the week.
* Five divisions. Suggested names follow the owl, from Owlet to Sage; avoid "Gold", because gold is reserved for money and a "gold task" is already a hidden check.
* Rank by league XP. Ties go to the higher accuracy.
* The top seven move up and the bottom five move down. A contributor needs at least one goal day to keep their place.
* Others see a **nickname only**, filtered for abuse and never a wallet address. Anyone can hide from the public board and still see their own rank.
* Prizes go to the top three in each group of the top division ([§4](#4-tester-incentives-the-founding-contributor-programme)).

### 3.6 Quests

| Kind | Examples | Reward |
| --- | --- | --- |
| Daily (three, rotating) | Meet your goal. Pass a quality check. Answer five tasks in one category (`Task.category`). Finish a session before noon | +10 to +30 XP |
| Weekly | Meet your goal on five days. Answer 20 Taglish tasks. Help your squad reach its goal | +50 XP, a badge step |
| Community (season-wide, shared) | "25,000 answers from the Philippines this week". "Get Cebuano to 1,000 answers" | A badge for everyone who took part, and a progress bar on the landing page |

Community quests borrow from Aya and FineWeb-C: contributors come back for their language as well as for themselves.

### 3.7 Badges

| Badge | Earned by | Owl |
| --- | --- | --- |
| First answer | First accepted answer | `owl-wave` |
| On the ledger | First payment confirmed | `owl-chart` |
| Week one / Month one | 7-day and 30-day streaks | `owl-laptop` |
| Sharp eye | 20 quality checks passed in a row | `owl-think` |
| Taglish voice, Cebuano voice | 200 accepted answers in that language | `owl-idea` |
| Squad starter | Started a squad that met its weekly goal | `owl-wave` |
| Bug finder | An accepted bug report | `owl-think` |
| Founding Contributor | Trusted during Season 1 | `owl-chart` |

Progress and badges use the deep-green primary. The warm gold secondary stays reserved for money, as `brand.md` requires.

### 3.8 Squads and referrals

* **Squad:** three to eight people. Any Regular contributor can start one, and others join by link or code. If every member meets their goal on four or more days in a week, each earns a squad badge step and +50 XP.
* **Invite link:** `centient.work/?ref=CODE`. The code is random and never a wallet address. A newcomer sees "Invited by *nickname*" and joins the inviter's squad, and can leave it.
* **Referral reward:** only when the newcomer reaches **Regular**. Then both get XP, and the inviter gets ₱25 of load, capped at ten a month.
* **Why squads:** referred customers churn about 18% more slowly, but only while their referrer stays. Squads keep both of them coming back.

### 3.9 Coaching and beginner-safe quality

The current rule pauses a contributor once lifetime accuracy is under 50% after three checks (`evaluateBanRule`), and repeats escalate (`computeCooldownBan`). A newcomer meets their third check around answer 30, in the first session, with no explanation of what they got wrong.

Proposed, as one small change with its own ADR:

1. **Training checks.** A contributor's first three quality checks come from a separate **training set** (`Task.isTraining`), and each one shows its explanation (`Task.explanation`). They are scored for coaching but don't count toward the pause rule. Training tasks are never drawn from the hidden gold set, so coaching never reveals it.
2. **The pause rule reads hidden checks only.** The threshold doesn't change. It simply starts after training, at the third **hidden** check.
3. **Every failed check explains itself.** Training checks show the reasoning. Hidden checks say the other response was better and give a category tip, without revealing which future tasks are checks.
4. **Reasons get taught.** Short examples of good reasons appear inside the task ("Names a specific difference", "Says why it matters to the person asking"). The reasons are part of what customers buy.
5. **Weekly "Your impact".** Answers, accuracy band, streak, languages, and the campaigns their work went into.

### 3.10 Guardrails against gaming

| Risk | Guard |
| --- | --- |
| Farming XP with low-effort answers | XP for accepted answers only, the quality multiplier, the daily cap, and the existing spam, repetition, rate-limit and bias guards |
| Many accounts chasing prizes | Prizes need Regular or Trusted, then operator review. **One payout identity per person**: a mobile or GCash number can claim for only one account. ADR-0004 records that one person with many funded wallets is not detected today, so this check closes the gap where money changes hands |
| Referral rings | Rewards only at Regular, a monthly cap, and review for anyone with more than five referrals a week |
| Coaching leaking the gold set | Training tasks are a separate set |
| Leaderboard pressure or privacy | Nicknames only, opt-out, and no wallet shown |
| Compulsion and burnout | Daily XP cap, freezes, quiet hours, at most two reminders a day, no guilt-trip copy |
| Streaks broken by Centient's own supply | Supply protection |

## 4. Tester incentives: the Founding Contributor programme

On testnet, the product's core promise of getting paid is deliberately absent. The programme gives testers something real while keeping two rules: **never imply test USDC is money**, and **never promise a token**.

### Incentive menu

| # | Incentive | What it is | Who qualifies | Notes |
| --- | --- | --- | --- | --- |
| 1 | **Founding Contributor status** | A permanent badge and profile label, plus an opt-in public list | Trusted during Season 1 | Costs nothing. Status |
| 2 | **Tier carries over to mainnet** | Tier and accuracy history carry over, so a Trusted tester starts mainnet with access to Trusted-only campaigns | Every tier | A Stellar address is the same on both networks, so the identity carries over naturally. This is real earning power, not speculation |
| 3 | **Mainnet welcome bonus** | A fixed amount of real USDC, the same for everyone who qualifies (for example 3 USDC), paid when mainnet launches | Trusted at the end of Season 1, after review | Announced in advance and capped. Based on tier, never on XP. Paid as its own job type on the existing rail. Needs legal review |
| 4 | **Streak milestone load** | ₱50 at 7 days, ₱200 at 30 days | Regular | Load or e-wallet credit. GIG Rewards has shown load works as a reward in the Philippines |
| 5 | **League prizes** | ₱500 / ₱300 / ₱200 to the top three in each top-division group, every week | Regular, after review | A contest of skill, so it needs a DTI permit |
| 6 | **Bug and UX bounties** | ₱100–₱1,000 per confirmed bug, by severity. ₱300 for a 30-minute recorded interview | Anyone signed in | Pay for work: the simplest legally. Feeds the QA gate |
| 7 | **Campus chapter stipend** | ₱2,000 per season for each active chapter lead, plus merch | Mentor | |
| 8 | **Merch and certificate** | Owl stickers and shirts. A digital certificate of contribution for students' resumes | Founding Contributors and top contributors | Ask partner schools whether the work could count toward practicum hours |

**Not recommended for Season 1:** raffles and loot-box rewards. They run on chance, need permits, attract farmers, and sit badly next to paid work.

### Season 1 budget

Assumes 400 activated contributors, 120 DQC in the final week, and ₱58 to the US dollar. Check the rate when the budget is approved.

| Item | Basis | ₱ |
| --- | --- | ---: |
| 7-day streak load | 200 × ₱50 | 10,000 |
| 30-day streak load | 80 × ₱200 | 16,000 |
| League prizes | ₱2,000 a week × 6 | 12,000 |
| Referral load | 100 × ₱25 | 2,500 |
| Bug bounties and interviews | ₱15,000 pool + 20 × ₱300 | 21,000 |
| Chapter stipends | 5 × ₱2,000 | 10,000 |
| Merch | Stickers and about 50 shirts | 30,000 |
| Onboarding sessions | 5 × ₱4,000 (venue, snacks) | 20,000 |
| DTI permits and legal review | Estimate | 15,000 |
| **Subtotal, paid during the season** | | **136,500** |
| Mainnet welcome bonus | 150 × 3 USDC = 450 USDC, owed at mainnet launch | 26,100 |
| Contingency | 15% | 24,390 |
| **Total** | | **≈ 187,000 (≈ $3,200)** |

That is about ₱1,560 per final-week DQC for the whole season. Sponsors could cover parts of it: telcos for load (Smart already does for GIG), anchors or exchanges for prizes, or SCF and Instawards follow-on funding.

### Programme rules

* **One person, one account.** Real rewards need the tier shown, pass operator review in the admin console, and are paid to one payout identity per person.
* **Claim details are collected only at claim time.** The mobile or e-wallet number is stored apart from the account, never sent to analytics, and deleted 90 days after payment. Publish a short programme privacy note, like the [analytics notice](../instawards/reference/privacy.md), and check Data Privacy Act obligations.
* **Published mechanics.** Each promotion has a rules page with dates, prizes, eligibility and, where required, the DTI permit number.
* **Every payout is visible.** A public, anonymised list (nickname, prize, date) applies "show the payment" to incentives.
* **Fixed budgets.** Each reward has a weekly cap, and the programme says plainly that it ends when the budget is spent.

## 5. The daily-use engine

### The loop

| Part | What Centient provides |
| --- | --- |
| **Cue** | A reminder at a time the contributor chooses, a streak-saver at 8 pm if the goal isn't met yet, a fixed **daily drop** of new tasks (for example 7 pm), squad nudges |
| **Routine** | A five-to-ten-minute session that fills the goal ring |
| **Reward** | The payment receipt for every answer (real money on mainnet), XP, the ring filling, the streak animation (Duolingo saw +1.7% day-7 retention from its animation alone), quest completion |
| **Investment** | Streak, tier progress, squad, league position, Founding Contributor status |

### Reminder channels

Wallet-first accounts have no email or phone, so the reminder channel has to be opt-in.

| Channel | Reach | Personal data | Build cost | Recommendation |
| --- | --- | --- | --- | --- |
| **Web push (PWA)** | Android browsers. iOS 16.4+ only after Add to Home Screen | None beyond the push subscription | Medium: service worker, VAPID keys, opt-in UI. `public/site.webmanifest` already declares a standalone app | **First** |
| Telegram bot and community | The crypto-savvy part of the audience | Telegram ID | Low to medium | Second. It doubles as the community space |
| Facebook Messenger | Very widely used in the Philippines | Messenger ID | High: Meta app review | Later |
| Email opt-in | Lower engagement for this audience. Resend is already wired | Email | Low | Optional |
| SMS | Everyone | Phone number | Per-message cost | Not now |

**Reminder rules:** one daily reminder at the chosen time; one streak-saver at 8 pm Manila time only if the goal isn't met and the streak is at least three days; quiet hours from 10 pm to 8 am; back off for a week after three ignored reminders in a row; one-tap opt-out.

### Task supply: the precondition

A daily habit needs daily tasks. Season 1's target load is about 120 DQC × 15 answers, or **1,800 answers a day**. At three judgments a task, that is **600 new tasks a day**.

1. **Evergreen platform pool.** Grow `docs/campaigns/centient` from 230 rows into at least 5,000 reviewed pairs across Taglish customer service, education, coding and general questions, and refresh it weekly. It is funded with test USDC on testnet.
2. **Design-partner campaigns.** Real data for real AI teams (see [campaign design partners](campaign-design-partners.md)). They give testers meaningful work and give Centient its first customers.
3. **Daily drop.** New tasks are published at a fixed time, which gives the habit its cue.
4. **Per-contributor daily allocation.** For example, at most 60 platform tasks per contributor per day, so heavy users don't drain the pool.
5. **Supply protection.** If the pool is empty for someone, their streak holds.
6. **Capacity before Season 1.** 1,800 answers a day at 0.05 USDC is 90 USDC a day, close to the co-signer's 100 USDC cap. Raise `DAILY_PAYOUT_CAP_UNITS` and `COSIGNER_DAILY_CAP_UNITS` on testnet to 1.5 × the forecast. Each answer debits reward plus `PLATFORM_FEE_UNITS` (0.20 test USDC with the defaults), so fund about 360 test USDC a day of campaign balance and size the hot and cold float to match.

## 6. Growing the tester base

| Channel | Why it fits | Motion | Season 1 target |
| --- | --- | --- | --- |
| **Campus chapters** (computing, IT and education organisations in Metro Manila, Cebu, Davao, Iloilo, Baguio) | Students have time, English, phones, and value certificates | Five chapters. In-person onboarding sessions with live wallet setup | 200 activated |
| **Stellar Philippines** (Instawards chapter, SCF network, ambassadors) | Already crypto-literate, often already on Freighter | Announcements, workshops | 50 |
| **Freelancer and BPO communities** (Facebook groups, Discord) | Gig-savvy, English-fluent, flexible hours | Content and referral codes | 100 |
| **Crypto communities** (BitPinas readers, local Telegram groups) | Wallets already set up | AMAs, an explainer article | 50 |
| **Referrals and squads** | Lower churn | Invite links | 25% of new contributors |
| **YGG's AI Alerts** | 27,000 applications in five days shows the demand | List Centient as an opportunity | Opportunistic |

**YGG and GIG.** GIG competes for the same contributors, pays in load, and YGG also courts data buyers. Recommended stance: list on AI Alerts now for reach. Consider GIG quests only on clear terms, because a points-for-load economy blurs the "paid per answer, verifiably" position. On mainnet, compete on dollars paid per answer on a public ledger.

**Content.** Short videos in Filipino and Taglish, written by native speakers: "Set up Freighter in three minutes", "What makes a good reason", "Find your payment on the ledger". Every piece carries the testnet note.

## 7. Seasons

### Season 0: closed beta

Two weeks, about 50 testers: the Instawards alpha testers plus two campus groups. It validates the daily loop, sets the retention baseline, and tunes XP, goals and the training set before anything is public. Rewards are handled by hand.

### Season 1: public testnet

Six weeks, each with a theme:

| Week | Theme | Focus |
| --- | --- | --- |
| 1 | Learn the ropes | Training checks, the push to Regular |
| 2 | Taglish week | Community quest on Taglish answers |
| 3 | Squad week | Squad goals, the referral push |
| 4 | Expert week | Domain qualifications: Filipino writing, education, coding |
| 5 | Quality week | Accuracy weighted extra in leagues, Sharp eye badges |
| 6 | Finale | Founding Contributor lock, certificates, impact report |

Leagues reset each week. Tiers and badges persist into the next season.

### Proposed calendar

| When | What |
| --- | --- |
| 12–25 Oct 2026 | Epic 1 (activation and analytics). Design-partner outreach starts. Chapter leads recruited |
| 26 Oct – 15 Nov | Epic 2 (daily loop) |
| 16–29 Nov | **Season 0**. Epic 3 starts |
| December | Epics 3 and 4. DTI permits filed at least 30 days before Season 1. First design-partner campaigns loaded. Chapter recruiting |
| **11 Jan – 21 Feb 2027** | **Season 1**, after the holidays, with classes back and student organisations active |
| Week of 22 Feb | Season review and a mainnet readiness decision |

Development is manual, with one implementation issue in flight at a time and one QA gate per epic. If the schedule slips, Season 1 can still start with leagues and rewards run by hand.

## 8. Build plan

### 8.1 Epics and issues

| # | Issue | Needed for |
| --- | --- | --- |
| **E1** | **Activation** | |
| 1 | Funnel analytics: new events (§8.4) and PostHog funnel and cohort dashboards | Season 0 |
| 2 | **Try a sample task** on the landing page: client-only, no API, nothing stored | Season 0 |
| 3 | Wallet setup guide for Chrome, Android and iOS, plus Android QA of Freighter Mobile (closes the R-6 residual) | Season 0 |
| 4 | Progressive profiling: demographics after the third accepted answer, behind a flag | Season 0 |
| 5 | Beginner-safe quality: training set, explanations, pause rule on hidden checks (ADR) | Season 0 |
| **E2** | **Daily loop** | |
| 6 | Progress model and XP ledger: migration, XP awarded in the submit transaction, idempotent per submission | Season 0 |
| 7 | Daily goal, streak, freezes, supply protection, the header ring, the goal-met screen | Season 0 |
| 8 | Levels and the first badges | Season 0 |
| 9 | Reminders: PWA service worker, web push opt-in, daily-drop notification | Season 0 |
| **E3** | **Social and rewards** | |
| 10 | Nicknames and weekly leagues (cron) | Season 1 |
| 11 | Referrals and squads | Season 1 |
| 12 | Reward grants: ledger, admin approval queue, claim flow, privacy note | Season 1 (manual operations as a fallback) |
| 13 | Daily, weekly and community quests | Season 1 |
| **E4** | **Supply and mastery** | |
| 14 | Evergreen task pipeline, daily drop, per-contributor daily allocation | Season 1 |
| 15 | Tiers with `Campaign.minTier`, expert qualifications | During Season 1 |
| 16 | Season framework, Founding Contributor certificate, impact report | Season 1, week 6 |

### 8.2 Data model sketch

A starting point for review, not a final schema. Money stays in `BigInt` units as everywhere else.

```prisma
model ContributorProgress {
  userId            String    @id
  displayName       String?   @unique // nickname for leagues; never a wallet address
  leaderboardOptOut Boolean   @default(false)
  timezone          String    @default("Asia/Manila")
  dailyGoal         Int       @default(10)
  xpTotal           Int       @default(0)
  level             Int       @default(1)
  tier              String    @default("starter") // starter | regular | trusted | mentor
  currentStreak     Int       @default(0)
  longestStreak     Int       @default(0)
  streakFreezes     Int       @default(0)
  lastGoalDay       DateTime? @db.Date
  referralCode      String    @unique
  referredById      String?
  squadId           String?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("contributor_progress")
}

/// Append-only. `sourceKey` makes every award idempotent, the way a
/// submission id keys its payout: "answer:<submissionId>", "goal:<userId>:<day>".
model XpEvent {
  id        String   @id @default(uuid())
  userId    String
  kind      String   // answer_accepted | check_passed | goal_met | quest | milestone | referral
  amount    Int
  sourceKey String   @unique
  createdAt DateTime @default(now())

  @@index([userId, createdAt])
  @@map("xp_events")
}

/// One row per contributor per Manila day.
model DailyActivity {
  userId          String
  day             DateTime @db.Date
  acceptedAnswers Int      @default(0)
  checksPassed    Int      @default(0)
  checksFailed    Int      @default(0)
  xpFromAnswers   Int      @default(0) // enforces the daily XP cap
  goalMet         Boolean  @default(false)
  servedEmpty     Boolean  @default(false) // asked for a task and none existed
  protectedBy     String?  // "freeze" | "supply"

  @@id([userId, day])
  @@map("daily_activity")
}

/// A real-world incentive. Never paid without an operator's approval.
model RewardGrant {
  id         String   @id @default(uuid())
  userId     String
  kind       String   // streak_7 | streak_30 | league_prize | referral | bounty | founding_bonus
  amount     BigInt   // centavos for PHP; seven-decimal units for USDC
  currency   String   // PHP_LOAD | PHP_EWALLET | USDC_MAINNET
  status     String   @default("pending_review") // pending_review | approved | rejected | paid
  sourceKey  String   @unique
  reviewedBy String?
  paidRef    String?
  createdAt  DateTime @default(now())

  @@index([status, createdAt])
  @@map("reward_grants")
}
```

Also needed: `UserBadge`, `LeagueMembership` (week, division, group, league XP, outcome), `Squad`, a claim-details table kept apart from `User` and deleted on schedule, and new fields `Task.isTraining`, `Task.explanation` and `Campaign.minTier`.

### 8.3 Where it touches the code

| Area | Change |
| --- | --- |
| `app/api/submit/route.ts` | In the transaction that accepts an answer: write `XpEvent` keyed `answer:<submissionId>`, update `DailyActivity`, goal and streak. A failed check only counts in `DailyActivity` |
| `app/api/task/route.ts` | Serve training checks first, enforce the daily allocation, set `servedEmpty` when nothing is available |
| `lib/admin-data.ts` | `evaluateBanRule` counts hidden checks only |
| `app/api/me/route.ts`, new `app/api/me/progress` | Return goal, streak, XP, level, tier, quests |
| `app/page.tsx` | Goal ring in the task header beside `EarningsBadge` and `WalletChip`. New `goal_select` and `goal_met` screens. `onboarding` moves after the third answer |
| `components/InAppLanding.tsx` | Becomes "today": goal ring, streak, quests, league place, **Start** |
| `components/AccountSheet.tsx` | Tier, badges, nickname, reminder settings, invite link |
| `app/api/cron/` | `streak-rollover` at Manila midnight (applies freezes and supply protection), `league-weekly`, `reminders`, all behind `lib/cron-auth.ts` |
| `app/admin/(protected)/` | A `rewards` approval queue. Progress on the user profile |
| Landing components | The interactive sample task, built from `LandingPhone`'s sample |

### 8.4 Analytics events

Ids only. Never wallet addresses, nicknames, phone numbers or demographics, per the [analytics notice](../instawards/reference/privacy.md).

`landing_sample_started`, `landing_sample_completed`, `wallet_setup_guide_opened`, `wallet_connect_started`, `wallet_connected`, `first_answer_accepted`, `profile_prompt_shown`, `profile_prompt_completed`, `daily_goal_selected`, `daily_goal_met`, `streak_extended`, `streak_freeze_used`, `streak_protected_no_tasks`, `streak_broken`, `level_up`, `tier_changed`, `badge_earned`, `quest_completed`, `league_joined`, `league_result`, `squad_joined`, `referral_link_shared`, `referral_activated`, `reminder_opt_in`, `reminder_opened`, `reward_claimed`, `reward_paid`.

Experiments run on PostHog feature flags.

### 8.5 ADRs to write

* **XP is a progress stat, not money.** No transfer, no cash-out, no conversion, kept apart from payouts.
* **Real-world incentives sit off the task-payout rail and need operator approval.** The mainnet welcome bonus uses its own job type.
* **Training checks are separate from the hidden gold set, and the pause rule reads hidden checks only.** This amends the behaviour ADR-0004 lists under "Gold scoring, ban rule".
* **The contributor day is the Asia/Manila calendar day.**

### 8.6 Configuration

* Raise `DAILY_PAYOUT_CAP_UNITS` and `COSIGNER_DAILY_CAP_UNITS` on testnet before Season 1.
* Fund the evergreen campaign balance for reward plus `PLATFORM_FEE_UNITS` per answer.
* Keep `GOLD_TASK_RATIO=0.1`.
* New: VAPID keys for web push, `XP_DAILY_CAP`, `DEFAULT_DAILY_GOAL`, `REMINDER_QUIET_HOURS`.

## 9. Experiments

With a few hundred contributors, small effects won't reach significance. Treat results as directional, favour changes with large expected effects, and roll out in sequence rather than testing many things at once.

| # | Hypothesis | Variant vs control | Primary metric | Guardrail |
| --- | --- | --- | --- | --- |
| X-1 | Trying a task first raises setup completion | Interactive sample vs the walkthrough | Wallet setup completion | — |
| X-2 | Moving demographics later raises first answers without losing the data | After the third answer vs before the first | First answer within 24 h | Profile completion by day 7 ≥ 80% of control |
| X-3 | Choosing a goal beats a default | Goal picker vs a fixed 10 | D7 retention | Answers per active day |
| X-4 | Freezes protect habits | Freeze at day 7 vs none | D14 retention | Accuracy |
| X-5 | A chosen reminder time beats a fixed one | Picker vs 7 pm | D7 retention | Opt-out rate |
| X-6 | Prizes add to leagues | Leagues with prizes vs without | Active days a week | Accuracy, cost per DQC |
| X-7 | Load adds to referral XP | ₱25 and XP vs XP only | Referred contributors reaching Regular | Referral flags in review |

## 10. Risks

| Risk | Mitigation |
| --- | --- |
| Farming and Sybil accounts | Tier gates, one payout identity per person, operator review, caps ([§3.10](#310-guardrails-against-gaming)) |
| Quality falls as volume rises | Guardrail metrics, accuracy-weighted XP. Volume incentives pause if median accuracy drops below 75% |
| Testers mistake test USDC for money | A testnet note on every reward surface, in the FAQ and in all content |
| **Confusion with "Sentient"** | Sentient, an open-AGI project, has a token and has run airdrops. Scammers can exploit the near-identical name. Add an FAQ line: "Centient has no token and will never ask for your recovery phrase." |
| Promotions law and tax | DTI permits filed early. Counsel checks prize tax treatment and the programme's privacy obligations |
| Task supply falls short | Evergreen pool, design-partner campaigns, daily allocation, supply protection |
| Compulsion and burnout | Daily XP cap, freezes, quiet hours, reminder limits, no guilt-trip copy |
| One builder | Strict priorities. Season 1 can start with rewards handled by hand |
| Android untested | QA before Season 0 |
| Payout cap or float runs out | Raise the caps and size the float before Season 1 (§5) |
| YGG and GIG compete for contributors | Differentiate on verifiable per-answer pay. List on AI Alerts for reach |

## 11. UI copy examples

Verbs first, plain words, no emoji, testnet stated plainly. Native speakers should write the Filipino versions.

| Moment | Copy |
| --- | --- |
| Sample task done | "That's the whole task. Set up a wallet to get paid for the next one." *On testnet, rewards are test USDC with no cash value.* |
| Setup progress | "Step 2 of 4: connect Freighter" |
| First payment | "Your first payment is on the ledger." Button: **View transaction** |
| Goal picker | "How many answers a day suits you?" **5, Light** · **10, Regular** · **20, Serious** |
| Goal met | "Today's goal is done. Come back tomorrow to make it a 4-day streak." |
| Streak-saver reminder | "Ten answers keep your 6-day streak going." |
| Supply protection | "No tasks right now, so your streak is safe today." |
| Freeze used | "A streak freeze covered yesterday. You have 1 left." |
| Failed training check | "Response B was better here: it answers the question that was asked. Checks like this one keep the data useful." |
| Tier up | "You're now Trusted. Higher-reward campaigns are open to you." |
| Rewards page | "Founding Contributor rewards are real and listed below. Test USDC is not money." |

## 12. Decisions for the owner

1. **North star and targets:** adopt DQC and the Season 1 targets in §1?
2. **Budget:** approve about ₱187,000 for Season 1, and decide whether to seek sponsors for load and prizes.
3. **Mainnet promises:** commit to tier carry-over and a fixed welcome bonus? Once announced, both are public promises.
4. **Legal:** counsel review of DTI permits, prize tax and Data Privacy Act obligations before anything is announced.
5. **Beginner-safe quality:** accept training checks and moving the pause rule to hidden checks, as a new ADR.
6. **Reminders:** web push first, Telegram second?
7. **YGG and GIG:** list on AI Alerts, partner, or stay apart?
8. **Dates:** Season 1 from 11 January 2027, or earlier in December?
9. **Names:** league division names and the nickname policy.
10. **Pricing for partners:** see [campaign design partners](campaign-design-partners.md#pricing-on-mainnet).
