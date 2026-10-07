# Campaign design partners: small AI companies for the first campaigns

Which AI startups Centient should approach to **fund the first campaigns** and become its first campaign customers. Researched on 7 October 2026. Companion to the [onboarding and gamification plan](onboarding-gamification-plan.md), whose daily habit depends on a steady supply of real tasks.

**Small companies first** (owner direction, 7 October 2026). Here, small means roughly 50 people or fewer, at pre-seed to Series A (about $10 million raised or less), where a founder can say yes. Bigger organisations wait until Centient has case studies to show them ([§4.4](#44-later-bigger-organisations)).

Facts about other companies come from public reporting found by web search. Several came from news summaries rather than the companies' own pages. Verify each one, and find a real contact, before outreach ([Verification](#verification)). No contact names are invented here beyond founders named in public reporting.

## Summary

* **Small companies decide in days.** The founder is the buyer, they feel the evaluation problem directly, they can't afford Scale or Surge, and a free dataset matters to them. They also become the case studies that win bigger customers later.
* **On testnet, Centient can fund the campaigns itself.** Campaign balances are test USDC, so a "data grant" costs Centient nothing in real money beyond the tester incentives it pays anyway. The partner gets a human preference dataset for free. In return Centient gets real tasks, feedback, a case study and a letter of intent for a paid mainnet pilot.
* **Start with Filipino-language AI products.** Filipino and Taglish are where global models are weakest (the best model scored 72.23% on FilBench, the best Southeast Asian model 61.07%), where Centient's crowd is strongest, and where the platform's own question bank already holds Taglish banking conversations.
* **Recommended first cohort, all small:** Proto (Taglish customer-service AI, about 35 people), Anycase.ai (Philippine legal AI, founder-led), GradeChum (AI grading, ₱15 million seed), Educato (YC-backed exam prep, Philippine civil service included) and a Stellar-ecosystem AI builder (StellarGPT or StroopyAI). Alternates: Lex Pilipinas, KARTILYA.PH, AregLaw.ai, EDGE Tutor and the Stellar AI Agent Kit.
* **Bigger organisations come later,** once there are case studies: Kollab (Senti AI), Thinking Machines (Temus), AI Singapore, Cohere, Sarvam, Sentient, Nous Research, Prime Intellect and Arena.
* **Watch the competition:** YGG's GIG Rewards already pays Filipinos load for rating AI responses, and Sapien runs a gamified labelling network. Centient's answer is per-answer dollars on a public ledger, plus quality data on every campaign.

## 1. Why small companies first

| | Small company | Big organisation |
| --- | --- | --- |
| Who decides | The founder, often on the first call | A procurement and security review |
| Time to a yes | Days to weeks | Months |
| Why they care | Evaluation is a daily pain and they can't hire a data vendor | They already have vendors and in-house teams |
| What a free dataset means | A real gift | A rounding error |
| What Centient gets | Fast feedback, a named case study, a likely paid pilot | Credibility, much later |

## 2. Two ways to fund a first campaign

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

With today's defaults, the partner pays the reward plus the platform fee for each answer: 0.05 USDC + 0.15 USDC (`PLATFORM_FEE_UNITS`) = **0.20 USDC an answer**. A 1,000-pair campaign with three judgments each costs 600 USDC. The pitch deck cites labs paying $1–$10 for a human preference datapoint, so this is far cheaper, which matters to a small company's budget.

**Owner decision:** with those defaults the platform keeps 75% of what the customer pays. The pitch deck benchmarks peers at 35–43% and leans on fair pay as an ethics wedge. Settle the pricing before quoting a mainnet pilot. One option is pricing by quality tier: single judgment, consensus, expert.

## 3. How candidates were scored

Every candidate below passed the small-company filter first. Each is then scored 1–5 on five criteria. The scores are judgment calls from public information, meant to set an order for outreach, not a ranking of the companies.

| Criterion | 5 means |
| --- | --- |
| **Fit** | Needs text preference or evaluation data in Filipino, Taglish or English that fits Centient's one-prompt, two-responses, one-reason task |
| **Need** | Building or evaluating AI answers now, where human judgment is a known bottleneck |
| **Access** | A warm path exists (DOST, Stellar, founders' networks, universities) |
| **Speed** | Can say yes in days: a founder-led team |
| **Strategic value** | A good case study, an ecosystem story (SCF), or a channel to more customers |

## 4. The candidates

### 4.1 Filipino-language AI products

| Candidate | What they do | Why they need Centient | Fit | Need | Access | Speed | Value | Total |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Anycase.ai** | Philippine legal research AI. Co-founders Beato Bongco (CEO, formerly Document AI technical lead at Thinking Machines) and Gio Tiongson. Built a "Legal Intelligence Layer" of Philippine legal materials and an AI Answer system. The only Philippine startup among five Southeast Asian startups at OpenAI Founder Day in Singapore | Its pitch is reliable legal answers. "Which answer explains the law more clearly and stays true to its sources?" is a judgment law students can make as an expert track | 4 | 5 | 4 | 5 | 4 | **22** |
| **Proto** (proto.cx) | An AI customer-experience platform (AICX) for emerging markets, with about 35 people and about $8 million raised (a $5.6 million Series A in 2024). Launched Tagalog voice AI in May 2025 with Canada's Scale AI innovation cluster (not the US company Scale AI) and the Gates Foundation. Deployed with the DTI, government agencies, eTap kiosks, Manila Express and GoodTech chat banking | Its assistants answer Filipinos in Tagalog and Taglish about money and government services. Judging which reply is clearer, more correct and more polite is exactly Centient's task, and the platform's `bank-ph` question bank already has this shape | 5 | 4 | 3 | 4 | 5 | **21** |
| **GradeChum** | AI grading of handwritten and digital student assessments, tuned for Filipino scripts. ₱15 million seed. Backed by DOST-TAPI. One of seven Philippine startups at GITEX AI Asia 2026 | Feedback to students has to be clear and fair. "Which feedback helps the student more?" suits an education expert track | 4 | 4 | 4 | 4 | 4 | **20** |
| **Educato** | YC-backed exam prep built by three former Palantir AI engineers, covering medicine, law, engineering, high school and civil service exams in several countries, the Philippines included. Reports 10 exams live and 5,000+ students | AI-written questions and explanations need checking. "Which explanation would help you pass?" is a judgment millions of Filipino exam-takers can make | 4 | 4 | 3 | 5 | 4 | **20** |
| **KARTILYA.PH** | A free "AI-native archive" of Philippine law that answers everyday-language questions and checks citations against the source before answering | Plain-language legal answers for ordinary Filipinos can be judged by the whole crowd, not only law students | 4 | 4 | 3 | 4 | 3 | **18** |
| **LexAI Solutions** (Lex Pilipinas) | Generative AI for Philippine legal research, case digests, drafting and legal education. Founded 2024, Makati City | Case digests and drafts need human preference data to improve | 4 | 4 | 3 | 4 | 3 | **18** |
| **AregLaw.ai** | Philippine legal research with citation-backed answers, case digests, drafting and document Q&A. Founded 2025, Tacloban City | The same need, from a very early team outside Metro Manila | 4 | 4 | 3 | 4 | 3 | **18** |
| **EDGE Tutor** | A Philippine online tutoring company. $1 million pre-Series A in 2025 after an $800,000 seed, investing in AI for teacher training, quality control, curriculum and lesson delivery | AI lesson content and teacher feedback can be judged A/B, but its AI work is earlier than the others' | 3 | 3 | 3 | 4 | 3 | **16** |

### 4.2 Stellar-ecosystem AI builders

All three are funded by the Stellar Community Fund, so they are reachable through the SCF community and make an SCF story for Centient.

| Candidate | What they do | Why they need Centient | Fit | Need | Access | Speed | Value | Total |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **StellarGPT** | A multilingual search and answer tool over Stellar docs, APIs, videos and dApps, built because Stellar's material is mostly in English. Awarded $25,000 in SCF #20 | Its answers in other languages need checking by native speakers; Filipino is a natural first one | 3 | 3 | 5 | 5 | 4 | **20** |
| **StroopyAI** | A Stellar assistant chatbot with social integrations. Awarded $21,400 in SCF #20 | "Which answer about Stellar is right and helpful?" also teaches testers about Stellar | 3 | 2 | 5 | 5 | 4 | **19** |
| **Stellar AI Agent Kit** | A toolkit that lets AI agents use Stellar accounts, Soroban contracts and assets over MCP. A one-person team awarded $108,000 by SCF | Agents that explain what they are about to do with someone's money need those explanations judged | 2 | 3 | 5 | 5 | 4 | **19** |

### 4.3 Allies, not customers

Non-profit and research groups that cost nothing to work with and lend credibility. Approach them alongside the small companies, but don't count them as customers.

| Ally | What they offer |
| --- | --- |
| **FilBench researchers** (Miranda, Aco, Manuel, Cruz, Imperial; EMNLP 2025) | A Filipino generation evaluation run as a public-good community quest, published as an open dataset and a co-authored paper |
| **DOST-ASTI** (iTanong, Filipino language models) | Credibility, a public-good evaluation, and DOST's grant programmes |
| **Hugging Face, Data is Better Together** | A Filipino or Cebuano annotation sprint run as a Centient community quest |

### 4.4 Later: bigger organisations

Approach these once the first cohort has produced case studies and quality reports.

| Organisation | Why later |
| --- | --- |
| **Kollab (Senti AI)** | A cloud services firm that acquired Senti AI in September 2025. Strong Tagalog and Bisaya fit, but an enterprise sale |
| **Thinking Machines** (now Temus) | Acquired in 2026; an OpenAI partner with 110+ enterprise clients. A channel to banks and retailers, not a startup buyer |
| **AI Singapore** (SEA-LION) | A national programme with long cycles. Worth it once a Filipino evaluation set exists |
| **Cohere Labs, Sarvam AI** | Large labs; Sarvam is also outside the Philippines (pitch deck phase 2) |
| **Sentient, Nous Research, Prime Intellect, Arena** | Well-funded labs and platforms ($50 million to $150 million rounds). Sentient's near-identical name is a scam risk to manage either way |
| **Sanas, Philippine enterprise customer service** | Need audio tasks or enterprise sales, which Centient doesn't offer yet |

### 4.5 Competitors to watch

| Who | What | Centient's answer |
| --- | --- | --- |
| **YGG 3.0 and GIG Rewards** | YGG pivoted from games to the AI data economy in 2026. GIG pays Smart and TNT load for AI quests, including rating AI responses. AI Alerts matches Filipinos with remote AI training jobs | Dollars paid per answer on a public ledger, rather than points for load. List on AI Alerts for reach |
| **Sapien** | A gamified, points-based labelling network that raised $5 million, citing enterprise customers such as Alibaba, Baidu and Midjourney | Real USDC, no token, and a quality report on every campaign |

## 5. The first cohort

| Order | Partner | First campaign | Size | Contributors |
| --- | --- | --- | --- | --- |
| 1 | **Proto** | **Taglish help desk:** a customer message about banking or a government service, two candidate replies, "Which reply would you trust, and why?" | 500 pairs × 3 | Everyone. A Taglish badge track |
| 2 | **Anycase.ai** | **Which answer explains the law better?** A legal question with two AI answers, judged for clarity and for staying true to the cited source. Not legal advice: the judgment is about the answer's quality | 300 pairs × 5 | Law-student expert track |
| 3 | **GradeChum** | **Which feedback helps the student?** A student answer with two AI-written feedback variants | 300 pairs × 5 | Education expert track |
| 4 | **Educato** | **Which explanation would help you pass?** A Philippine civil service exam question with two AI-written explanations | 500 pairs × 3 | Everyone |
| 5 | **StellarGPT or StroopyAI** | **Ask about Stellar:** a question about Stellar with two assistant answers | 200 pairs × 3 | Everyone. Also teaches testers about Stellar |

That is 6,600 answers. At Season 1's target of 1,800 answers a day it is three to four days of supply, so the evergreen platform pool still carries most days ([plan §5](onboarding-gamification-plan.md#task-supply-the-precondition)). Partner campaigns are the work testers will care most about, so use them for themed weeks and daily drops.

**Alternates:** if a first-cohort company declines, go to KARTILYA.PH (plain-language legal answers suit the whole crowd), Lex Pilipinas or AregLaw.ai, EDGE Tutor, or the Stellar AI Agent Kit. **Allies** (FilBench and DOST-ASTI) can run their public-good Filipino evaluation alongside, as Taglish week's community quest.

## 6. Outreach

### Warm paths

* **DOST-TAPI:** backs GradeChum and the GITEX AI Asia 2026 cohort.
* **The Stellar ecosystem:** StellarGPT, StroopyAI and the Agent Kit are SCF-funded, so the SCF community, the Instawards Philippines chapter lead and SCF 7.0's referral system all reach them.
* **Founders' networks:** Anycase.ai's CEO worked at Thinking Machines; Educato is in the YC network and hiring in the Philippines.
* **Law schools and education programmes:** the same students who would join the legal and education expert tracks, and the campus-chapter audience.
* **Cold, through company channels:** Proto, KARTILYA.PH, Lex Pilipinas, AregLaw.ai, EDGE Tutor.

### Timeline

| Week | Step | Done when |
| --- | --- | --- |
| 1 (12–18 Oct) | One-pager, a live demo campaign built from the `bank-ph` question bank, a target list with verified contacts | One-pager approved |
| 2–3 | First messages to the 11 small companies, warm paths first | 11 sent |
| 3–5 | Founder calls. Each partner sends 20 sample pairs, and Centient shows them answered on testnet within 48 hours | Five calls, three agreed |
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
> We're choosing five small teams for free first campaigns. You send up to 1,000 prompt and response pairs, and you get back three judgments per pair with written reasons, agreement scores and a quality report, in about two weeks.
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
* **Expert tracks for law and education:** the qualification step in the plan's tiers ([plan §3.4](onboarding-gamification-plan.md#34-tiers)), needed by the Anycase.ai and GradeChum campaigns.

## 7. Who funds the incentive budget

The plan's incentive values are TBD ([plan §4](onboarding-gamification-plan.md#4-tester-incentives-the-founding-contributor-programme)). Once they are set, possible sources are:

* **Stellar Community Fund:** Build and Integration awards, with SCF 7.0's referral route.
* **Instawards follow-on support** from the Philippines chapter.
* **Sponsors in kind:** telcos for load prizes (Smart already sponsors GIG's), anchors or exchanges for league prizes.
* **Design partners:** a paid mainnet pilot can carry a contributor bonus pool.

## Verification

Check before outreach or external use:

* Funding amounts come from news and database summaries. Sources disagree on Proto's size (35 people in one, 101–500 in another); its funding totals agree.
* Anycase.ai's funding is not public in the sources found. Its founders and OpenAI Founder Day appearance come from its own blog and Philippine press.
* Lex Pilipinas and AregLaw.ai founding years and cities come from Stanford's legal tech index. KARTILYA.PH is described from press coverage.
* Educato's Philippine presence comes from its YC profile and a Philippine job listing. Its student and exam counts are the company's own.
* StellarGPT, StroopyAI and the Stellar AI Agent Kit award amounts come from SCF project pages. Check each project is still active.
* Proto's partner list and its May 2025 Tagalog launch come from Proto's own news pages.

## Sources

* Anycase.ai, [OpenAI Founder Day talk](https://anycase.ai/blog/openai-founder-day-talk) and [About](https://anycase.ai/about); Newsbytes.PH, [Fragmented legal data holds back AI for Philippine law](https://newsbytes.ph/2026/06/26/pinoy-startup-says-fragmented-legal-data-holds-back-ai-for-ph-law/); Daily Tribune, [How a PHL startup is making legal AI more reliable](https://tribune.net.ph/2026/07/24/how-a-phl-startup-is-making-legal-ai-more-reliable)
* Newsbytes.PH, [Startup taps AI to make PH laws searchable in plain language](https://newsbytes.ph/2026/07/21/startup-taps-ai-to-make-ph-laws-searchable-in-plain-language/); Stanford CodeX, [LexAI Solutions](https://techindex.law.stanford.edu/companies/16566) and [AregLaw.ai Technologies](https://techindex.law.stanford.edu/companies/areglaw-ai-technologies)
* Proto, [Series A](https://proto.cx/resource/proto-raises-5-6m-series-a-to-accelerate-global-expansion), [Tagalog voice AI](https://www.proto.cx/resource/mabuhay-proto-voice-ai-assistants-now-speak-tagalog), [DTI deploys Proto's AICX chatbot](https://proto.cx/news/philippines-dti-deploys-protos-aicx-chatbot), [eTap](https://www.proto.cx/resource/etap-deploys-proto-ai-assistant-across-the-largest-payment-kiosk-network-in-the-philippines), [GoodTech chat banking](https://proto.cx/resource/goodtech-deploys-philippines-chat-banking-with-protos-aicx-technology); Craft, [Proto](https://craft.co/proto-global)
* Newsbytes.PH, [7 Pinoy AI startups at GITEX AI Asia](https://newsbytes.ph/2026/03/18/7-pinoy-ai-startups-to-showcase-solutions-at-sg-event/); Philippine Embassy in Singapore, [Seven startups join GITEX AI Asia 2026](https://www.philippine-embassy.org.sg/showcasing-filipino-innovation-seven-startups-and-innovators-join-gitex-ai-asia-2026/); Nucamp, [AI startups to watch in the Philippines](https://www.nucamp.co/blog/coding-bootcamp-philippines-phl-philippiness-top-10-startups-that-tech-professionals-should-watch-out-for-in-2025)
* Y Combinator, [Educato](https://www.ycombinator.com/companies/educato); Educato, [About](https://www.educato.com/about)
* TechNode Global, [EDGE Tutor raises $1M pre-Series A](https://technode.global/2025/02/21/philippines-edtech-firm-edge-tutor-raises-1m-in-pre-a-round-to-expand-in-the-americas-and-emea/)
* Stellar Community Fund, [StellarGPT](https://communityfund.stellar.org/project/stellargpt), [StroopyAI](https://communityfund.stellar.org/project/stroopyai), [Stellar AI Agent Kit](https://communityfund.stellar.org/project/stellar-ai-agent-kit-mr6); Blockchain.news, [SCF 7.0 grant system](https://blockchain.news/news/stellar-scf-7-grant-system-ai-screening-referrals)
* Miranda et al., [FilBench](https://arxiv.org/pdf/2508.03523); BitPinas, [DOST's local chatbot](https://bitpinas.com/ai/dost-local-chatgpt/); Hugging Face, [FineWeb-C](https://huggingface.co/datasets/data-is-better-together/fineweb-c/commit/90c2ab847f2ccfb61b4d8b9c60fd7d379b68c828)
* Later list: Malaya, [Kollab acquires Senti AI](https://malaya.com.ph/weekly-features/infotech/kollab-acquires-sentiai); Manila Bulletin, [Temus and Thinking Machines](https://mb.com.ph/2026/08/07/temus-backs-filipina-founded-thinking-machines-to-scale-enterprise-ai-across-southeast-asia); AI Singapore, [Project SEALD](https://aisingapore.org/aiproducts/southeast-asian-languages-in-one-network-data-seald); The Block, [Sentient Foundation](https://www.theblock.co/amp/post/390484/sentient-foundation-launches-as-global-nonprofit-to-ensure-agi-remains-open-source-and-aligned-with-humanity) and [Nous Research](https://www.theblock.co/amp/post/352000/paradigm-leads-50-million-usd-round-decentralized-ai-project-nous-research); Intel Capital, [Prime Intellect](https://intelcapital.com/prime-intellect-raises-130m-series-a-to-build-the-open-superintelligence-stack); The Next Web, [LMArena](https://thenextweb.com/news/lmarena-raises-150m-in-series-a-round)
* Competitors: BitPinas, [YGG Play sunset](https://bitpinas.com/feature/ygg-play-sunset/) and [GIG Rewards launch](https://bitpinas.com/business/gig-rewards-launch/); The Block, [Sapien raises $5 million](https://www.theblock.co/amp/post/287560/sapien-raises-5-million-for-data-labeling-with-ai-applications)
