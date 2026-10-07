# Campaign design partners: AI startups for the first campaigns

Which AI startups and teams Centient should approach to **fund the first campaigns** and become its first campaign customers. Researched on 7 October 2026. Companion to the [onboarding and gamification plan](onboarding-gamification-plan.md), whose daily habit depends on a steady supply of real tasks.

Facts about other companies come from public reporting found by web search. Several came from news summaries rather than the companies' own pages. Verify each one, and find a real contact, before outreach ([Verification](#verification)). No contact names are invented here.

## Summary

* **Both sides of the marketplace need the same thing now.** Testers need real, meaningful tasks every day, and Centient needs named customers and case studies. A design-partner programme solves both.
* **On testnet, Centient can fund the campaigns itself.** Campaign balances are test USDC, so a "data grant" costs Centient nothing in real money beyond the tester incentives it pays anyway. The partner gets a human preference dataset for free. In return Centient gets real tasks, feedback, a case study and a letter of intent for a paid mainnet pilot.
* **Start with Filipino-language AI.** Filipino and Taglish are where global models are weakest (the best model scored 72.23% on FilBench, the best Southeast Asian model 61.07%), where Centient's crowd is strongest, and where the platform's own question bank already holds Taglish banking conversations.
* **Recommended first cohort:** Proto (Taglish customer-service AI), the FilBench researchers and DOST-ASTI (Filipino evaluation as a public good), GradeChum (AI grading), Stellar-ecosystem AI builders (fast, on-brand) and Kollab, which acquired Senti AI (Tagalog and Bisaya generative AI). Crypto-native open-model labs (Sentient, Nous Research) come next, once mainnet is close.
* **Watch the competition:** YGG's GIG Rewards already pays Filipinos load for rating AI responses, and Sapien runs a gamified labelling network. Centient's answer is per-answer dollars on a public ledger, plus quality data on every campaign.

## 1. Two ways to fund a first campaign

| | **A. Data grant (Centient funds)** | **B. Paid pilot (the partner funds)** |
| --- | --- | --- |
| When | Now, on testnet | At mainnet |
| Who pays contributors | Centient, in test USDC from the campaign balance | The partner, in USDC, prepaid into the campaign balance |
| Partner gives | Prompts and response pairs free of personal data, a 30-minute feedback call, permission to be named (or an anonymised case study), a letter of intent for a paid pilot | Prepaid USDC |
| Partner gets | A preference dataset with reasons, exported as JSON, CSV or text with train, validation and test splits (`/api/admin/campaigns/[id]/export`), plus a quality report | The same, at production scale |
| Centient gets | Real tasks for testers, a named first customer, product feedback | Revenue |

Every testnet dataset is labelled with its provenance: a testnet crowd, motivated by the Founding Contributor programme, with the usual quality guards in force.

### The Founding Campaign Partner package (data grant)

* **Size:** up to 1,000 pairs × 3 judgments (3,000 answers), delivered within two weeks of upload. Larger by agreement.
* **Delivered:** choice, written reason and timestamp for each judgment. Per-pair agreement (`Task.agreementScore`, `Task.majorityAnswer`). Quality-check accuracy of the contributor pool. Aggregate contributor demographics only (country and age range, never per person).
* **Partner commits to:** no personal data in prompts or responses, the right to show the content to an anonymous crowd, a feedback call, and a decision on a paid mainnet pilot within 30 days of delivery.
* **Centient commits to:** the quality guards, a named contact, and deleting the partner's raw task content on request after export.

### Pricing on mainnet

With today's defaults, the partner pays the reward plus the platform fee for each answer: 0.05 USDC + 0.15 USDC (`PLATFORM_FEE_UNITS`) = **0.20 USDC an answer**. A 1,000-pair campaign with three judgments each costs 600 USDC. The pitch deck cites labs paying $1–$10 for a human preference datapoint, so this is far cheaper.

**Owner decision:** with those defaults the platform keeps 75% of what the customer pays. The pitch deck benchmarks peers at 35–43% and leans on fair pay as an ethics wedge. Settle the pricing before quoting a mainnet pilot. One option is pricing by quality tier: single judgment, consensus, expert.

## 2. How candidates were scored

Each candidate is scored 1–5 on five criteria. The scores are judgment calls from public information, meant to set an order for outreach, not a ranking of the companies.

| Criterion | 5 means |
| --- | --- |
| **Fit** | Needs text preference or evaluation data in Filipino, Taglish or English that fits Centient's one-prompt, two-responses, one-reason task |
| **Need** | Building or evaluating models now, where human judgment is a known bottleneck |
| **Access** | A warm path exists (DOST, Stellar, universities, Hugging Face community) |
| **Speed** | Can say yes in weeks: a small team or an open-research culture |
| **Strategic value** | Name, credibility, ecosystem story (SCF), or a channel to more customers |

## 3. The candidates

### Tier A: Filipino-language AI (start here)

| Candidate | What they do | Why they need Centient | Fit | Need | Access | Speed | Value | Total |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Proto** (proto.cx) | An AI customer-experience platform (AICX) for emerging markets. Launched Tagalog voice AI in May 2025, funded through a partnership with Canada's Scale AI innovation cluster (not the US company Scale AI) and the Gates Foundation. Deployed with the DTI, more than 30 government agencies, eTap payment kiosks, Manila Express remittances and GoodTech chat banking | Its assistants answer Filipinos in Tagalog and Taglish about money and government services. Judging which reply is clearer, more correct and more polite is exactly Centient's task, and the platform's `bank-ph` question bank already has this shape | 5 | 4 | 3 | 4 | 5 | **21** |
| **FilBench researchers** (Miranda, Aco, Manuel, Cruz, Imperial; EMNLP 2025) | A Filipino benchmark covering cultural knowledge, classical NLP, reading comprehension and generation in Filipino, Tagalog and Cebuano. Leaderboard on Hugging Face | Generation is the weak spot (best model 72.23%), and generation quality is best judged by people. A human preference set for Filipino would be new | 4 | 4 | 4 | 5 | 4 | **21** |
| **GradeChum** | AI grading of handwritten and digital student assessments. ₱15 million seed. Backed by DOST-TAPI. One of seven Philippine startups at GITEX AI Asia 2026 | Feedback to students has to be clear and fair. "Which feedback helps the student more?" is an A/B task that education students and teachers can judge as an expert track | 4 | 4 | 4 | 4 | 4 | **20** |
| **Stellar-ecosystem AI builders** (for example StroopyAI, a Stellar assistant chatbot awarded $21.4K in SCF #20, and builders of x402 agent payments on Stellar) | AI assistants and agents inside the Stellar ecosystem | Small budgets, but a fast yes. "Which answer about Stellar is right and helpful?" also teaches testers about Stellar, and makes a strong SCF story | 3 | 2 | 5 | 5 | 4 | **19** |
| **Kollab (Senti AI)** | Senti AI, building Filipino NLP since the 2010s with Tagalog and Bisaya datasets and clients among banks, telcos, government, Unilever and SM Supermalls, was acquired by Kollab in September 2025. It now forms Kollab's AI and Data Analytics division | Generative AI for customer experience in Philippine languages needs evaluation at scale. As a services firm, Kollab could also resell evaluation to its own clients | 5 | 3 | 3 | 3 | 4 | **18** |
| **DOST-ASTI** (iTanong, Filipino language models) | Government work on a Filipino chatbot and models for Filipino, Taglish and other Philippine languages, with Tagalog models published on Hugging Face | A partner rather than a customer: a public-good evaluation campaign, credibility, and DOST's grant programmes | 4 | 4 | 3 | 2 | 5 | **18** |
| **Thinking Machines** (now part of Temus) | Founded in Manila in 2015 by Stephanie Sy. More than 110 enterprise clients. An OpenAI Advanced Partner and the sole ChatGPT Enterprise reseller in the Philippines. Acquired by Temus in 2026 | A channel, not a startup customer: its bank and retail deployments need Taglish evaluation before go-live | 4 | 3 | 3 | 2 | 4 | **16** |

### Tier B: regional and multilingual model builders

| Candidate | What they do | Why they need Centient | Fit | Need | Access | Speed | Value | Total |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **AI Singapore** (SEA-LION) | Southeast Asian language models. Project SEALD with Google Research collects data in nine regional languages, Filipino included. SEA-HELM evaluation used native speakers | SEA-LION trails on Filipino (61.07% on FilBench). Native-speaker judgments in Filipino are an input it already pays attention to | 4 | 4 | 2 | 2 | 5 | **17** |
| **Hugging Face, Data is Better Together** (FineWeb-C) | Community annotation sprints: 114 languages, with a language included once it reaches 1,000 annotations | A Filipino or Cebuano sprint run as a Centient community quest. Mission-driven, unpaid, and good for credibility | 3 | 3 | 3 | 4 | 4 | **17** |
| **Cohere Labs** (Aya) | Open-science multilingual work: about 3,000 collaborators in 119 countries and 204,000 human-annotated pairs in 65 languages | A Filipino preference subset contributed to open science | 3 | 3 | 2 | 3 | 5 | **16** |
| **Sarvam AI** | Indian-language models (Sarvam-30B, Sarvam-105B) across 22 languages. A $234 million Series B led by HCLTech in June 2026 | A large paying customer for Indic preference data, but only once the crowd extends past the Philippines (pitch deck phase 2) | 2 | 3 | 1 | 2 | 3 | **11** |

### Tier C: open and crypto-native AI labs

| Candidate | What they do | Why they need Centient | Fit | Need | Access | Speed | Value | Total |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Sentient** | Open, community-built AI. An $85 million seed in 2024 (Founders Fund, Pantera, Framework). The Sentient Foundation, a nonprofit with a grants mandate, launched on 19 February 2026. Its Dobby models improve from community feedback | Community human feedback paid transparently on-chain matches its own pitch. Comfortable with USDC. The near-identical name is a scam risk worth turning into a partnership, or at least a clear FAQ line | 3 | 3 | 2 | 3 | 4 | **15** |
| **Nous Research** | Open-weight Hermes models. Psyche, a decentralised training network on Solana. A $50 million Series A led by Paradigm in April 2025 at a $1 billion valuation, and reportedly raising again in 2026 | Open chat models need human preference data on helpfulness and persona, and a Filipino slice is something nobody else offers. Crypto-native | 3 | 3 | 2 | 3 | 4 | **15** |
| **Prime Intellect** | Infrastructure for training, reinforcement learning, environments and evaluations. A $130 million Series A led by Radical Ventures. About 6,000 customers, among them Arcee, Character.AI and NVIDIA | An integration partner: human preference packaged as an evaluation environment its customers can buy | 3 | 3 | 2 | 2 | 4 | **14** |
| **Arena** (formerly LMArena) | Crowdsourced pairwise model comparisons: more than 50 million votes and about 5 million monthly users. A $150 million Series A at about $1.7 billion in January 2026 | A long shot. Paid, verified, demographically tagged Filipino votes are something an open crowd can't guarantee | 2 | 2 | 1 | 1 | 5 | **11** |

### Tier D: later, when Centient supports audio

| Candidate | What they do | Why later |
| --- | --- | --- |
| **Sanas** | Real-time accent translation for call centres, used by more than 30,000 agents in India and the Philippines. Raised $65 million | The judgments it needs are about audio. Centient's task is text today |
| **Philippine enterprise customer service** (ePLDT's Taglish Talkbot, banks and e-wallets) | Taglish chatbots in production | Enterprises, not startups. Reach them through Kollab or Thinking Machines once case studies exist |

### Competitors to watch

| Who | What | Centient's answer |
| --- | --- | --- |
| **YGG 3.0 and GIG Rewards** | YGG pivoted from games to the AI data economy in 2026. GIG pays Smart and TNT load for AI quests, including rating AI responses. AI Alerts matches Filipinos with remote AI training jobs | Dollars paid per answer on a public ledger, rather than points for load. List on AI Alerts for reach |
| **Sapien** | A gamified, points-based labelling network that raised $5 million, citing enterprise customers such as Alibaba, Baidu and Midjourney | Real USDC, no token, and a quality report on every campaign |

## 4. The first cohort

| Order | Partner | First campaign | Size | Contributors |
| --- | --- | --- | --- | --- |
| 1 | **Proto** | **Taglish help desk:** a customer message about banking or a government service, two candidate replies, "Which reply would you trust, and why?" | 500 pairs × 3 | Everyone. A Taglish badge track |
| 2 | **FilBench researchers and DOST-ASTI** | **Filipino generation evaluation:** Filipino prompts answered by two open models, judged for correctness and naturalness. Published as an open dataset and a co-authored paper | 1,000 pairs × 3 | Everyone. The headline community quest for Taglish week |
| 3 | **GradeChum** | **Which feedback helps the student?** A student answer with two AI-written feedback variants | 300 pairs × 5 | Education expert track |
| 4 | **Stellar AI builders** | **Ask about Stellar:** a question about Stellar with two assistant answers | 200 pairs × 3 | Everyone. Also teaches testers about Stellar |
| 5 | **Kollab (Senti AI)** | **Tagalog and Bisaya customer experience:** generated replies judged for tone and accuracy | 500 pairs × 3 | Cebuano track |

That is 8,100 answers. At Season 1's target of 1,800 answers a day it is four to five days of supply, so the evergreen platform pool still carries most days ([plan §5](onboarding-gamification-plan.md#task-supply-the-precondition)). Partner campaigns are the work testers will care most about, so use them for themed weeks and daily drops.

**Next wave, closer to mainnet:** Sentient and Nous Research (English plus a Filipino slice, paid in USDC), AI Singapore (Filipino evaluation for SEA-LION), Hugging Face (a Filipino or Cebuano annotation sprint).

## 5. Outreach

### Warm paths

* **DOST-TAPI:** backs GradeChum and the GITEX AI Asia 2026 cohort.
* **DOST-ASTI:** the iTanong and Filipino language-model team.
* **The Stellar ecosystem:** the Instawards Philippines chapter lead, SDF contacts, and SCF 7.0's referral system, which lets trusted ecosystem participants vouch for teams.
* **The Hugging Face community:** FilBench's leaderboard and the Data is Better Together organisers.
* **Universities:** Philippine NLP research groups whose students are also the campus-chapter audience.
* **Cold, through company channels:** Proto, Kollab, Sentient, Nous Research.

### Timeline

| Week | Step | Done when |
| --- | --- | --- |
| 1 (12–18 Oct) | One-pager, a live demo campaign built from the `bank-ph` question bank, a target list with verified contacts | One-pager approved |
| 2–3 | First messages to 15 organisations, warm paths first | 15 sent |
| 3–5 | Discovery calls. Each partner sends 20 sample pairs, and Centient shows them answered on testnet within 48 hours | Five calls, three agreed |
| 6–9 | Partner content checked, campaigns loaded, Season 0 testers run the first one | Two or three campaigns loaded |
| Season 1 | Partner campaigns used for themed weeks and daily drops | Datasets delivered |
| Season 1 end | Case studies, quality reports, letters of intent | Two LOIs for paid mainnet pilots |

### The one-pager

1. **The offer:** a free human preference dataset in Filipino, Taglish or English, judged by verified contributors in the Philippines.
2. **The task:** one prompt, two responses, one choice and one written reason. Show a real example.
3. **Quality:** hidden quality checks (10% of tasks), agreement scores, spam, repetition and bias guards, accuracy-gated tiers.
4. **Transparency:** every contributor payment is a public Stellar transaction, and the partner can verify the people behind its data were paid.
5. **Deliverables:** JSON or CSV with splits, plus a quality report.
6. **What we ask in return:** feedback, a case study, and a decision on a paid pilot.
7. **Testnet note:** contributors currently earn test USDC. The programme moves to mainnet in 2027.

### First message (template)

> **Subject:** Free Filipino human-preference data for [product]
>
> Hi [name],
>
> I build Centient, a platform where people in the Philippines compare two AI responses, pick the better one and write a short reason. Each answer is paid on Stellar, and every payment is public.
>
> We're choosing five teams for free first campaigns. You send up to 1,000 prompt and response pairs, and you get back three judgments per pair with written reasons, agreement scores and a quality report, in about two weeks.
>
> [Product] answers people in Taglish, which is where models are weakest: the best model scores 72% on FilBench. Could I show you 20 of your own pairs answered by our contributors this week?
>
> Carl Macabales, Centient (centient.work)

Personalise the third paragraph for each partner, using the "Why they need Centient" column above.

### What to build for partners

Most of the campaign side exists: campaigns funded from a balance, CSV upload, progress, export with splits. The programme adds:

* **A quality report export:** per-campaign agreement distribution, accuracy of the contributor pool, blocked-answer rate, aggregate demographics.
* **A content checklist at upload:** no personal data, the right to show the content to a crowd, a content warning flag.
* **A partner preview:** a read-only link to sample results before the full export.

## 6. Who funds the incentive budget

The plan's Season 1 incentives cost about ₱187,000 ([plan §4](onboarding-gamification-plan.md#season-1-budget)). Possible sources:

* **Stellar Community Fund:** Build and Integration awards, with SCF 7.0's referral route.
* **Instawards follow-on support** from the Philippines chapter.
* **Sponsors in kind:** telcos for load prizes (Smart already sponsors GIG's), anchors or exchanges for league prizes.
* **Design partners:** a paid mainnet pilot can carry a contributor bonus pool.

## Verification

Check before outreach or external use:

* All funding amounts and valuations (Sentient, Nous Research, Prime Intellect, Arena, Sarvam, Sanas, GradeChum, Sapien) come from news and database summaries.
* Proto's partner list and its May 2025 Tagalog launch come from Proto's own news pages, reached through search summaries.
* Kollab's acquisition of Senti AI (September 2025) and Temus's acquisition of Thinking Machines (2026): confirm current team structure and the right contact.
* Search summaries disagreed on whether Senti AI raised a round in 2025 or was only acquired. The acquisition is the better-sourced fact.
* GITEX AI Asia 2026: only three of the seven DOST-TAPI startups were named in the sources found.
* StroopyAI's SCF award and status: check that the project is still active.

## Sources

* Proto, [Tagalog voice AI](https://www.proto.cx/resource/mabuhay-proto-voice-ai-assistants-now-speak-tagalog), [DTI deploys Proto's AICX chatbot](https://proto.cx/news/philippines-dti-deploys-protos-aicx-chatbot), [eTap](https://www.proto.cx/resource/etap-deploys-proto-ai-assistant-across-the-largest-payment-kiosk-network-in-the-philippines), [Manila Express](https://proto.cx/resource/manila-express-deploys-protos-aicx-platform-for-remittances-to-the-philippines), [GoodTech chat banking](https://proto.cx/resource/goodtech-deploys-philippines-chat-banking-with-protos-aicx-technology)
* Miranda et al., [FilBench](https://arxiv.org/pdf/2508.03523); [FilBench leaderboard](https://huggingface.co/spaces/filbench/filbench-leaderboard/commit/10516090a35de364c40568071a5d4081fe56c4ff)
* Newsbytes.PH, [7 Pinoy AI startups to showcase solutions at a Singapore event](https://newsbytes.ph/2026/03/18/7-pinoy-ai-startups-to-showcase-solutions-at-sg-event/); Nucamp, [AI startups to watch in the Philippines in 2026](https://www.nucamp.co/blog/coding-bootcamp-philippines-phl-philippiness-top-10-startups-that-tech-professionals-should-watch-out-for-in-2025)
* Stellar Community Fund, [StroopyAI](https://communityfund.stellar.org/project/stroopyai); Blockchain.news, [SCF 7.0 grant system](https://blockchain.news/news/stellar-scf-7-grant-system-ai-screening-referrals); Stellar, [x402 on Stellar](https://stellar.org/blog/foundation-news/x402-on-stellar)
* Malaya, [Kollab acquires Senti AI](https://malaya.com.ph/weekly-features/infotech/kollab-acquires-sentiai); Inquirer, [Kollab boosts AI presence with Senti AI acquisition](https://technology.inquirer.net/140114/kollab-boosts-ai-presence-in-ph-with-senti-ai-acquisition/amp); WIPO, [Human-like AI customer service for multilingual users](https://www.wipo.int/en/web/ip-advantage/w/stories/human-like-ai-customer-service-for-multilingual-users)
* BitPinas, [DOST's local chatbot](https://bitpinas.com/ai/dost-local-chatgpt/); Hugging Face, [DOST-ASTI BERT-tl](https://huggingface.co/dost-asti/BERT-tl-cased)
* Manila Bulletin, [Temus backs Thinking Machines](https://mb.com.ph/2026/08/07/temus-backs-filipina-founded-thinking-machines-to-scale-enterprise-ai-across-southeast-asia); Newsbytes.PH, [OpenAI taps Thinking Machines as ChatGPT Enterprise reseller](https://newsbytes.ph/2026/08/16/openai-deepens-ph-push-taps-thinking-machines-as-chatgpt-enterprise-reseller/)
* AI Singapore, [Project SEALD](https://aisingapore.org/aiproducts/southeast-asian-languages-in-one-network-data-seald); [SEA-HELM](https://arxiv.org/pdf/2502.14301); Computer Weekly, [AI Singapore and Google to build a regional dataset](https://www.computerweekly.com/news/366572893/AI-Singapore-Google-to-build-regional-dataset-for-LLMs)
* Hugging Face, [FineWeb-C](https://huggingface.co/datasets/data-is-better-together/fineweb-c/commit/90c2ab847f2ccfb61b4d8b9c60fd7d379b68c828); Cohere Labs, [Aya Dataset](https://arxiv.org/pdf/2402.06619)
* Inc42, [Sarvam AI funding](https://inc42.com/buzz/sarvam-ai-in-talks-to-raise-250-mn-at-1-5-bn-valuation-report/); Let's Data Science, [Sarvam AI raises at a $1.5B valuation](https://letsdatascience.com/news/sarvam-ai-raises-300m-at-15b-valuation-6770af09)
* The Block, [Sentient Foundation launches](https://www.theblock.co/amp/post/390484/sentient-foundation-launches-as-global-nonprofit-to-ensure-agi-remains-open-source-and-aligned-with-humanity); CoinEx, [Sentient SENT airdrop guide](https://www.coinex.com/en/academy/detail/3453-sentient-sent-airdrop-guide-free-token-how-to-participate)
* The Block, [Paradigm leads $50M round for Nous Research](https://www.theblock.co/amp/post/352000/paradigm-leads-50-million-usd-round-decentralized-ai-project-nous-research); Runtime Wire, [Nous Research nears a $75M round](https://runtimewire.com/article/nous-research-75-million-round-1-5-billion-valuation)
* Intel Capital, [Prime Intellect raises $130M Series A](https://intelcapital.com/prime-intellect-raises-130m-series-a-to-build-the-open-superintelligence-stack)
* The Next Web, [LMArena raises $150M](https://thenextweb.com/news/lmarena-raises-150m-in-series-a-round); [LMArena](https://en.wikipedia.org/wiki/LMArena)
* Signalbase, [Sanas Series B](https://www.trysignalbase.com/news/funding/sanas-secures-65m-series-b-funding-to-empower-global-voices-with-real-time-accent-translation); Outsource Accelerator, [AI accent neutralisation in Philippine BPO](https://news.outsourceaccelerator.com/ai-accent-neutralization-philippine-bpo/)
* Microsoft Marketplace, [ePLDT Talkbot](https://marketplace.microsoft.com/id-id/product/epldtinc1587002514726.sol-20240401-etbot)
* BitPinas, [YGG Play sunset](https://bitpinas.com/feature/ygg-play-sunset/) and [GIG Rewards launch](https://bitpinas.com/business/gig-rewards-launch/); eGamers, [YGG 3.0](https://egamers.io/yield-guild-games-switches-on-ygg-3-0-recasting-the-guild-as-an-ai-labor-layer/)
* The Block, [Sapien raises $5 million](https://www.theblock.co/amp/post/287560/sapien-raises-5-million-for-data-labeling-with-ai-applications); Bitrue, [What is Sapien](https://www.bitrue.com/blog/what-is-sapien-crypto)
