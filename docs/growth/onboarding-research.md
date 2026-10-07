# Onboarding and daily-use research

Research behind the [contributor onboarding and gamification plan](onboarding-gamification-plan.md). Researched on 7 October 2026, the day after the Instawards sprint closed. Everything still runs on Stellar **testnet** (D-7).

Outside figures are point-in-time, and some come from secondary reporting or search summaries rather than primary sources. Claims that need checking before anyone quotes them externally are listed under [Verification](#verification).

## Summary

* **The hardest step comes before any value.** A first-time crypto user has to install Freighter, create a wallet, save a recovery phrase and sign twice before they see a task they can answer. Typical apps lose about 75% of users in the first three days, and Centient asks for its biggest effort exactly then. On phones, the path has only been tested on iOS, while 88% of Filipino phones run Android.
* **Nothing asks a contributor to come back tomorrow.** There is no daily goal, streak, progress or reminder. Wallet-first accounts have no email address, so once the tab closes Centient has no way to reach them.
* **The quality rule is harsh on beginners.** After three gold checks, accuracy under 50% triggers a 24-hour cooldown, and the counters are lifetime. A newcomer who misses two of their first three checks loses day one, and a day-one break is exactly what kills a new habit.
* **Testnet removes the main motivation by design.** Test USDC has no cash value, and the brand forbids implying otherwise. Tester incentives have to be real, separate from task rewards, and labelled plainly.
* **The evidence favours forgiving daily streaks, small daily goals, weekly leagues and referral squads,** as long as rewards follow verified quality rather than raw volume. Quest and points programmes that reward easy actions attract farmers and lose most users once the reward is paid.
* **The Philippines already has a direct analog.** YGG's GIG Rewards pays Smart and TNT mobile load for "AI quests" that include rating AI responses. Demand for AI gig work is proven locally. Centient's difference is per-answer pay that anyone can verify on a public ledger.
* **A daily habit needs daily task supply.** If the task pool runs dry, "You've done them all" becomes a broken streak. Gamifying daily use without guaranteed tasks would backfire.

## 1. Where onboarding stands today

### The funnel, as built

Read from `app/page.tsx` (its `Screen` states) and the components each one renders.

| # | Step | Screen or place | What the contributor does | Tracked in PostHog today |
| --- | --- | --- | --- | --- |
| 1 | Land | `login` (the landing page doubles as sign-in) | Reads the page and watches the non-interactive answer walkthrough (`AnswerJourney`) | Page view |
| 2 | Get a wallet | Outside Centient | Installs the Freighter extension or app, creates a wallet, saves the recovery phrase | Nothing |
| 3 | Sign in | `WalletSignIn`, `FreighterPairing` | Signs one challenge (SEP-53), on desktop or over WalletConnect | `wallet_connect_failed` only on failure |
| 4 | Payout setup | `payout_setup` | Signs a second time for the sponsored USDC trustline, or picks **Continue for now** | `payout_ready`, `payout_setup_skipped` |
| 5 | Demographics | `onboarding` ("Before you start") | Country and age range (required), gender (optional) | `onboarding_completed` |
| 6 | In-app landing | `landing` | Sees **Total earned** (0 for a new account), the FAQ and **Start Earning** | Nothing |
| 7 | Answer | `task`, then `success`, `quality_passed` or `quality_failed` | Picks A or B, writes a reason of at least 10 characters, submits. At most one answer per 15 seconds and five per minute (`lib/rate-limit.ts`) | `task_presented`, `submission_approved`, `submission_blocked`, `submission_quality_check_passed` / `_failed` |
| 8 | Pool empty | `no_tasks` | "You've done them all", come back later | Nothing |

### Gaps, ranked by impact on daily use

| # | Gap | Where it shows | Why it matters |
| --- | --- | --- | --- |
| F1 | **Value comes after the hardest step.** Wallet install, recovery phrase and two signatures all happen before the first answer | Steps 2–4 | The steepest drop in any app is the first three days. A contributor who never answers once never sees the payment that is the product's promise |
| F2 | **Mobile sign-in is proven on iOS only.** Freighter Mobile over WalletConnect passed QA on iOS; Android is an accepted, untested residual | ADR-0003 amendment, risk R-6 | Android ran on 88% of Filipino phones in June 2026 (StatCounter), and the audience is "mobile-first on mid-range phones" (`PRODUCT.md`). The platform most contributors hold is the one QA has not covered |
| F3 | **Demographics before the first task.** Two required fields stand between a new account and its first answer | `components/OnboardingScreen.tsx` | It delays first value with the most sensitive data Centient asks for |
| F4 | **No goal or next step.** A new contributor sees "0.00 USDC", an FAQ and one button | `components/InAppLanding.tsx` | There is no target to aim at, no sense of progress and no plan for a session |
| F5 | **No reason, and no channel, to return.** No streak, daily goal or reminder. Wallet-first accounts carry no email or phone | `User` model; email only exists on legacy accounts | Even a perfect habit design can't send the cue that starts the next session |
| F6 | **Beginners can be paused on day one.** `evaluateBanRule` cools an account down once lifetime gold accuracy is under 50% after three checks. Repeats escalate to 72 hours, then a permanent ban within 30 days (`computeCooldownBan`). A failed check shows no explanation | `lib/admin-data.ts`, `app/api/submit/route.ts` | With 10% gold, the third check arrives around answer 30, inside the first session. Lifetime counters mean early misses weigh on every later check |
| F7 | **Testnet removes the core motivation.** Test USDC has no cash value, and "be plain about testnet" is a product principle | `PRODUCT.md` | Testers are effectively volunteers until mainnet. Something real has to stand in for pay |
| F8 | **Task supply is finite.** The platform's own question bank holds 111 rows plus 119 fallback rows | `docs/campaigns/centient/` | 200 people answering 10 a day is 2,000 answers a day: about 670 new tasks a day at three judgments each |
| F9 | **A daily payout ceiling.** The co-signer's cap defaults to 100 USDC per UTC day | `COSIGNER_DAILY_CAP_UNITS` in `.env.local.example` | That is 2,000 answers a day at 0.05 USDC, or 400 at the 0.25 USDC used in D3 QA. On testnet it is a config change, but it must be raised before scaling, not during |

## 2. What the research says

### 2.1 How habits form

* **Habits take weeks, and one missed day barely matters.** In the UCL study led by Phillippa Lally, the median time to near-automaticity was 66 days, with a range of 18 to 254. Missing one day lowered automaticity by a very small amount with no lasting effect. Lally has since stressed that 66 days is an average, not a rule. For Centient that means a streak can forgive a missed day without breaking the habit it builds.
* **Repetition in a stable context builds the cue.** The same time and the same place each day is what makes the cue trigger the action. A reminder at a time the contributor picks, plus a short fixed session, fits that.
* **Endowed progress.** In Nunes and Drèze (2006), car-wash customers given a 10-stamp card with two stamps already filled completed it more often than customers given an empty 8-stamp card, although both needed eight purchases. Counting wallet setup as progress ("2 of 5 steps done") uses the same effect.
* **Goal gradient.** Effort rises as a goal gets closer (Hull, 1934). A visible ring for "answers today against your goal" puts this to work in every session.

### 2.2 Duolingo, the best-documented daily habit app

| Mechanic | Reported effect | Source |
| --- | --- | --- |
| 7-day streak | Learners who reach a 7-day streak are 3.6× more likely to finish their course | Duolingo blog |
| Streak Freeze, up to two equipped | +0.38% daily active learners | Duolingo blog |
| Animation when a streak is extended | +1.7% of new learners still active at day 7 | Duolingo blog |
| Leagues (weekly, tiered leaderboards) | +17% learning time | Deconstructor of Fun, StriveCloud |
| The engagement system as a whole | DAU grew about 4.5× over four years, reaching 52.7 million by the end of 2025; one analysis puts churn falling from 47% to 28% | Deconstructor of Fun, StriveCloud (secondary) |

The caveat: the share of apps showing streak screens rose from 6.8% in 2023 to 14.0% in 2024, then fell back to 8.1% in 2025. Copying a streak is not enough. Streaks work when the daily action is short and worth doing for its own sake. Centient's daily action, about ten answers in five to seven minutes that each pay, fits that well.

### 2.3 Retention benchmarks

| | Day 1 | Day 7 | Day 30 |
| --- | --- | --- | --- |
| Cross-industry average, 2025–26 | 25–26% | 11–13% | 5–7% |
| "Good" | 35–40% | 22–28% | 14–20% |
| "Excellent" | 45%+ | 30%+ | 25%+ |
| Pushwoosh 2025, iOS / Android | — | 6.89% / 5.15% | 3.10% / 2.82% |

Day 1 measures onboarding, day 7 early habit and day 30 lasting value. The plan sets its targets against the "good" row.

### 2.4 Gamified crowdsourcing

* Points, badges, levels, progress bars and leaderboards are the standard toolkit in gamified crowdsourcing. The literature finds they raise participation, but the effect on quality is mixed and hard to isolate.
* One platform that made accuracy the central metric, reinforced with a "Sharpshooter" badge, saw total accuracy rise by about 1% month over month. A small gain, but in the right direction.
* **Lesson:** the game has to reward accuracy, not volume. Centient already has the instruments to measure accuracy: hidden gold tasks, inter-annotator agreement (`Task.agreementScore`), reason-spam and repetition checks, and the left-bias guard.

### 2.5 Web3 quests, points and airdrops

* Quest platforms (Galxe, Zealy, Layer3, QuestN) structure campaigns as tiers of social actions, engagement and product use, with XP and leaderboards. They call themselves "the loyalty layer".
* Points programmes get users to "farm" for months in the hope of a later reward. Research finds that keeping users engaged **after** an airdrop is difficult, and that artificial engagement is common.
* Questing platforms are tuned to grow metrics with tasks bots can complete, such as follows and basic on-chain actions, which don't move real KPIs. Sybil protection works best when identity checks are tested early, during testnet, before scaling.
* **Lesson:** no token or airdrop framing (Centient's brand already rules out a speculative token). Reward only product actions that pass quality checks, and gate anything with real value behind a quality tier.

### 2.6 The Philippines

* **Crypto adoption.** 9th in the Chainalysis 2025 Global Crypto Adoption Index, down from a peak of 2nd in 2022. TRM Labs' 2025 index puts it 4th. About 10% of Filipinos engage with crypto.
* **Stablecoin rails are live.** In 2025 Coins.ph partnered with BCRemit on a remittance rail that moves transfers as USDC or USDT and cashes out to pesos within minutes, cutting fees by about 80%.
* **Play-to-earn already happened here.** The country was at the centre of the 2021 play-to-earn boom and its collapse. Yield Guild Games (YGG) sunset its game publishing arm, YGG Play, by 1 August 2026 and pivoted to the AI data economy as "YGG 3.0".
* **GIG Rewards is the direct local analog.** Built by BreederDAO, YGG Pilipinas and ED3N Ventures, it gives points for quests, redeemable for Smart and TNT load. Its "AI quests" include recording video and audio, labelling images and **rating AI responses**, and Smart advertises up to ₱750 of free load. YGG's AI Alerts board, which matches Filipinos with remote AI training jobs, reportedly drew 27,000 applications in its first five days.
* **Trust is the wedge.** At least 10,000 Filipinos worked on Scale AI's Remotasks. Workers reported delayed, reduced or withheld pay, and rates on some projects fell from $10 a task to under 1 cent. Remotasks scored 1 out of 10 on the Oxford Internet Institute's Fairwork ratings in 2023. "Show the payment, don't promise it" answers this history directly.
* **Promotions are regulated.** Raffles, contests, games, premiums and rewards need a DTI sales promotion permit before they start. Filing lead times are 15–30 days, and raffles and competitions wait 10 working days. Penalties under RA 7394 run from ₱500 to ₱5,000, imprisonment, or both. The Internet Transactions Act of 2023 also applies online.
* **Small real rewards are easy to pay.** Xendit disburses to GCash, Maya, Coins, GrabPay and Starpay by API or by batch upload of up to 10,000 rows, 7am to 11pm every day.

### 2.7 Referrals and community

* **Referred customers stay longer.** In a study of about 10,000 customers of a German bank over almost three years, referred customers were worth at least 16% more and churned about 18% more slowly (Schmitt, Skiera and Van den Bulte, 2011). The follow-up study found the lower churn held **only while the referrer stayed**. Referrals should therefore bind people into small groups that stay active together.
* **Mission and language pride recruit contributors.** Cohere's Aya project drew about 3,000 collaborators from 119 countries, producing 204,000 human-annotated pairs across 65 languages. Hugging Face's FineWeb-C has annotations in 114 languages, includes a language once it reaches 1,000 annotations, and runs language communities on Discord. "Put Filipino on the map" is a motive Centient can use alongside pay.
* **Filipino is underserved.** On FilBench (EMNLP 2025), the best model, GPT-4o, scored 72.23%, and the best Southeast Asian model, SEA-LION v3 70B, scored 61.07%. Generation and reading comprehension were the weak spots. Contributors' Filipino judgments are scarce and valuable, and they can be told so.

## 3. Design principles for Centient

1. **Reward verified quality, never raw volume.** XP, league rank and real incentives all follow accepted answers, weighted by quality. A failed gold check, a blocked answer or a repetitive reason earns nothing.
2. **Show value before asking for effort.** Let people try a sample task before they set up a wallet, and get them to a first paid answer within minutes of signing in.
3. **Make the habit small and forgiving.** A daily goal of about ten answers, a streak that survives a missed day with a freeze, and no guilt-trip copy.
4. **Be plain about testnet.** XP is a progress stat, not money and not a token. Real incentives are separate, budgeted and labelled. Test USDC is never presented as spendable.
5. **Make it social and local.** Squads, campus chapters and language goals, so contributors return for each other as well as for themselves.
6. **Resist Sybil attacks by construction.** Real rewards unlock at a quality tier, reuse the existing banned-identity and ban gates, and pass operator review before payment. ADR-0004 records that one person holding many funded wallets is not detected today, so real rewards also need one payout identity per person, checked when a prize is claimed.
7. **Show every reward.** Each payment links to the ledger, and each prize is announced with its rules. This is "show the payment" applied to incentives.
8. **Never let the pool run dry.** Daily-use mechanics ship only alongside a guaranteed daily supply of tasks.
9. **Keep the brand.** Plain words, verbs first, no emoji in UI copy, gold reserved for money, and the owl as guide rather than nag.

## Verification

Check these before using them outside the team:

* Duolingo's churn figures (47% to 28%) and the +17% league effect come from secondary analyses, not Duolingo itself.
* The 52.7 million DAU figure and the 4.5× DAU growth are reported by analysts. Use Duolingo's investor reports for exact numbers.
* GIG Rewards' "up to ₱750" comes from a Smart post on X. The 27,000 AI Alerts applications come from a games-industry news summary.
* DTI filing lead times differ between sources (15 days, 30 days, 10 working days). Confirm with DTI or counsel for each promotion.
* App-retention benchmarks vary by vendor and category. Treat them as ranges, not targets.

## Sources

* Duolingo, [How the Duolingo streak builds habit](https://blog.duolingo.com/how-duolingo-streak-builds-habit)
* Deconstructor of Fun, [Duolingo: how the $15B app uses gaming principles to supercharge DAU growth](https://www.deconstructoroffun.com/blog/2025/4/14/duolingo-how-the-15b-app-uses-gaming-principles-to-supercharge-dau-growth)
* StriveCloud, [Gamification examples: Duolingo](https://www.strivecloud.io/blog/blog-gamification-examples-boost-user-retention-duolingo)
* Lazyweb, [Are streak features still spreading beyond Duolingo?](https://www.lazyweb.com/research/are-streaks-still-spreading-beyond-duolingo)
* Silicon Canals, [UCL habit automaticity: 18–254 days, 66 median](https://siliconcanals.com/t-ucl-habit-automaticity-18-254-66-days/)
* Renascence, [Endowed progress effect](https://www.renascence.io/us/behavioral-biases/endowed-progress-effect) and [Goal gradient effect](https://www.renascence.io/us/behavioral-biases/goal-gradient-effect)
* Pushwoosh, [App retention benchmarks](https://www.pushwoosh.com/blog/increase-user-retention-rate); Sonar, [App user retention benchmarks](https://trysonar.app/blog/app-user-retention-benchmarks-and-what-moves-it.md)
* Turku/FAU, [Gamified crowdsourcing: conceptualization, literature review, and future agenda](https://research.utu.fi/converis/portal/detail/Publication/26304743?lang=en_US)
* Constellation Research, [Lukas Biewald, CrowdFlower](https://constellationr.com/node/553)
* ICODA, [DeFi marketing growth hacks](https://icoda.io/blog/defi-marketing-growth-hacks-2025/)
* arXiv 2501.18810, [Airdrops and user engagement](https://arxiv.org/html/2501.18810v2); Snag Solutions, [Bot farms](https://www.snagsolutions.io/blog/bot-farms)
* Human Passport, [How Human Passport protected Story Protocol's airdrop from Sybil attacks](https://passport.human.tech/blog/how-human-passport-protected-story-protocol-s-airdrop-from-sybil-attacks)
* BitPinas, [Philippines ranked 9th in the 2025 Global Crypto Adoption Index](https://bitpinas.com/feature/ph-chainalysis-2025/) and [TRM Labs 2025 index](https://bitpinas.com/feature/trm-labs-2025-country-crypto-adoption-index)
* Crypto for Innovation, [Transformation under way in the Philippines](https://cryptoforinnovation.org/transformation-under-way-in-philippines-as-crypto-market-matures/)
* BitPinas, [YGG to sunset YGG Play, pivot to the AI data economy](https://bitpinas.com/feature/ygg-play-sunset/); eGamers, [YGG 3.0 recasts the guild as an AI labor layer](https://egamers.io/yield-guild-games-switches-on-ygg-3-0-recasting-the-guild-as-an-ai-labor-layer/)
* BitPinas, [GIG Rewards launch](https://bitpinas.com/business/gig-rewards-launch/); [GIG Rewards](https://gigrewards.ph/); Smart on X, [AI quests for free load](https://x.com/LiveSmart/status/2090333216624501140)
* Washington Post via Pixel Envy, [Behind the AI boom, an army of workers in digital sweatshops](https://pxlnv.com/linklog/ai-boom-digital-sweatshops/); [Scale AI](https://wikipedia.com/wiki/Scale_AI)
* NDV Law, [What rules govern social media giveaways and online raffles?](https://ndvlaw.com/what-rules-govern-social-media-giveaways-and-online-raffles/); DTI, [Sales promotion permits](https://dti.gov.ph/regions/region-4a/region-4a-news/2023-massive-year-sales-promotion); PIA, [DTI Albay on sales promotion permits](https://mirror.pia.gov.ph/news/2023/02/22/dti-albay-urges-business-establishments-to-get-sales-promotion-permit)
* Xendit, [Disbursements](https://docs.xendit.co/xendisburse)
* StatCounter, [Mobile OS market share, Philippines](https://gs.statcounter.com/os-market-share/mobile/philippines)
* Schmitt, Skiera and Van den Bulte, [Referral programs and customer value](https://faculty.wharton.upenn.edu/wp-content/uploads/2012/04/Schmitt-Skiera-vandenBulte-2011-Referral-Programs-Customer-Value.pdf); Van den Bulte et al., [How customer referral programs turn social capital into economic capital](https://faculty.wharton.upenn.edu/wp-content/uploads/2017/07/VdB-et-al.-JMR-2018.pdf)
* Cohere Labs, [Aya Dataset](https://arxiv.org/pdf/2402.06619); Hugging Face, [FineWeb-C](https://huggingface.co/datasets/data-is-better-together/fineweb-c/commit/90c2ab847f2ccfb61b4d8b9c60fd7d379b68c828) and [communications pack](https://data-is-better-together-fineweb-communications-pack.static.hf.space/index.html)
* Miranda et al., [FilBench: Can LLMs understand and generate Filipino?](https://arxiv.org/pdf/2508.03523) (EMNLP 2025)
