# ADR-0012: The weekly board ranks careful labor and shows no money; event codes give a stamp, never a place

- **Status:** Accepted — 2026-10-12
- **Scope:** The weekly board, display names and event codes (epic [#200](https://github.com/webnxt-2030/Centient/issues/200), issue 3 of 3, first PR). Quests and invites follow in a second PR.
- **Relates to:** [#203](https://github.com/webnxt-2030/Centient/issues/203) (this change), [ADR-0010](0010-xp-is-never-money.md) (XP is never money), [ADR-0011](0011-tiers-gate-access-never-pay.md) (tiers, floors from enough history).

## Context

#203 adds the social layer: a weekly board, names on it, and codes handed out
at booths and webinars. The first contributor webinar is Thursday 15 Oct, so
codes have to work on staging that day. Three things needed deciding: what the
board may show, what it ranks, and how a code can and can't be used.

Two facts shaped the rules:

- Gold checks are about 10% of serves, so most labelers see 0–2 quality checks
  in a week. A strict weekly 80% floor would judge them on one answer.
- Nothing in the app runs on a schedule. Cron routes exist, but whoever
  schedules them sits outside the repo.

## Decision

**The board shows no money and no identity.** A row is a rank, a name or null
("Hidden labeler"), a tier and XP. No wallet, no earnings, no user id reaches
the browser; the route test asserts on the raw body. Names are opt-in:
nothing shows until the labeler sets a name and turns "Show my name" on.

**Names are unique, filtered and retired when hidden.** 3–20 characters,
`[a-z0-9._]`, starting with a letter, stored lowercase so uniqueness ignores
case. An in-repo blocklist (English and Filipino profanity and slurs, and
reserved words such as admin, centient and hidden labeler) catches long words
anywhere, through dots, underscores and digit swaps, and short ones only as a
whole word, so "batangas" and "peacock" pass. No dependency. An admin hide
retires the name for everyone (`retired_display_names`), clears it, and asks
its owner for another; the hide is audit-logged as `displayName.hide`.

**The board ranks labor, Monday to Sunday in Manila.** XP from the ledger for
the week's `weekKey`, every kind except `EVENT_CODE`, so a booth code can't buy
a place (it still counts toward tiers). Ties go to whoever reached the total
first. To place, quality checks that week must be 80% or better, counted from
3 checks; under 3, XP alone places, as ADR-0011's floors do. Checks are counted
by time within the Manila week, since a failed check writes no XP row. The top
20 show, with the caller's own row below them when they're further down.

**A week closes lazily, once.** The first board read of a new week records each
placed labeler's finish (`weekly_results`, for "Best: #6") and awards the Top 3
stamp to those who don't hold it. `POST /api/cron/weekly-board` does the same
as a backstop. The week's `board_weeks` row is inserted in the same
transaction, `ON CONFLICT DO NOTHING`, so racing reads close it once. A week
still running is never closed.

**An event code gives its own stamp and 25 XP, once per account, on its days.**
Each code carries a stamp title and an icon from an allow-list, and awards
`event:<codeId>`; the fixed Event slot stays open for the next event, so the
stamp count grows with each one. A code needs a bound Stellar wallet (the
`/api/task` gate), is refused while banned, matches case-insensitively, and is
open on its Manila days `startsDay..endsDay` inclusive. Every attempt counts
toward 10 an hour per labeler, so a code can't be found by trying. The
redemption row's key (code, account) refuses a second one; the stamp and the
`EVENT_CODE` XP row (`event:<codeId>:<userId>`) carry their own unique keys as
a second guard. Creating a code is audit-logged as `eventCode.create`.

**A booth link never redeems on its own.** `?code=` is kept in the tab's
sessionStorage through sign-in and onboarding, stripped from the address bar,
and opens Progress with the code on the Event code card. The labeler taps Add.
The card doesn't name the stamp before redeeming: that would need a lookup
outside the guess limit.

## Consequences

- The labeler UI ships behind `NEXT_PUBLIC_GAMIFICATION`. The admin
  Gamification tab doesn't, so codes can be created on staging before the flag
  turns on. Server writes run from merge.
- The XP backfill should run before the flag turns on: the first board read
  closes last week, and a week closed on partial XP stays closed.
- `event_code_redeemed`, `display_name_set` and `stamp_awarded` (Top 3 and
  event stamps) are sent from the server; `board_viewed` from the browser.
- No late window for BlockQuest Fiesta (10–12 Oct): codes are valid only
  inside their dates. An admin can record a past event's code; it can't be
  redeemed.
- Watch the board for name abuse and the guess rate on codes in the first
  week.
