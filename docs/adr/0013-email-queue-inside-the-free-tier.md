# ADR-0013: Contributor email goes through one idempotent queue, inside Resend's free tier

- **Status:** Accepted — 2026-11-25
- **Scope:** Contributor email notices (Month 2, D3): the send queue, the send log, the `funded_work_available` event and the unfinished-task reminder.
- **Relates to:** [#260](https://github.com/webnxt-2030/Centient/issues/260) (this change), [#248](https://github.com/webnxt-2030/Centient/issues/248) (opt-in, verification, unsubscribe), [#253](https://github.com/webnxt-2030/Centient/issues/253) (emits the event on a tranche release), [#261](https://github.com/webnxt-2030/Centient/issues/261) (deep links).

## Context

D3 sends three kinds of email to contributors who opted in through #248:
the address verification link, a notice when new funded work opens, and one
reminder about an unfinished task. The SOW measures two things: **0 duplicate
sends per person per event**, and **0 days above Resend's free-tier limit**
(100 emails a day, 3,000 a month).

Three facts shaped the design:

- Contributors are mostly in the Philippines. A notice at 2 a.m. is worse
  than one at 8 a.m.
- Week 1 fires the funded-work notice from an admin publish; Week 2's escrow
  indexer (#253) fires it from a tranche release. The queue must not change
  between them.
- Nothing recorded which task a contributor was served but didn't answer.

## Decision

**One table is both the queue and the send log.** `email_sends` holds one row
per (person, kind, event), enforced by a unique `dedupeKey`
`<userId>:<kind>:<eventKey>`. Enqueueing is `INSERT … ON CONFLICT DO NOTHING`,
so the same event fired twice, or by two processes at once, makes one row and
one send. A row moves `queued → sent`, or ends `skipped` (preferences changed,
unsubscribed, capped) or `failed` (after 3 attempts). Nothing is deleted: the
table is the evidence for the duplicate metric.

**Verification is sent at once, logged, and never queued.** The link's raw
token exists only in the email, so it is never stored to send later. The
request sends immediately and writes a `verification` row (eventKey = the
token hash) to the log, which counts toward the daily limit.

**Verification goes first by reservation.** The daily limit (`EMAIL_DAILY_LIMIT`,
default 100, Resend's free tier) counts every `sent` row since 00:00 UTC, when
Resend's day resets. Notices may use only the limit minus a verification
reserve (`EMAIL_VERIFICATION_RESERVE`, default 20). A verification is refused
(`daily_limit`) only when the whole limit is spent. A notice that doesn't fit
today stays `queued` for tomorrow: deferred, never dropped.

**Quiet hours defer, they don't drop.** Notices are never sent between 21:00
and 08:00 Asia/Manila; a row due then gets `notBefore` = the next 08:00.
Verification ignores quiet hours, because the contributor just asked for it.

**A per-person cap.** At most one funded-work notice per person per Manila day.
The cap is checked at send time, so a second event that day is
logged `skipped` with reason `capped`: the first
notice already says new paid work is open. A reminder is once per task, ever.

**Preferences are checked twice.** At enqueue (only verified addresses with
that notice on) and again at send, so an unsubscribe between the two wins:
the row is `skipped` with reason `unsubscribed` or `preference_off`.

**`funded_work_available` is the only trigger for new-work notices.**

```ts
type FundedWorkAvailable = {
  campaignId: string;
  source: "admin_publish" | "tranche_release";
  // The id that makes the event unique within its source: the upload job or
  // task id for admin_publish, the release tx hash for tranche_release.
  sourceId: string;
  taskCount: number;       // tasks the event opened
  occurredAt: string;      // ISO 8601
};
```

`eventKey` = `<source>:<sourceId>`, so re-emitting the same release is a no-op.
It fans out to every contributor with a verified address, the notice on, not
banned, and a tier the campaign admits. Week 1 emits it when an admin's CSV upload
job completes on a campaign that isn't paused and whose balance covers at least
one reward (`sourceId` = the job id, `taskCount` = rows upserted). The
single-task admin route is left out: it creates a placeholder whose responses
are filled in by a later CSV. #253 emits it with
`source: "tranche_release"` and changes nothing else.

**"Unfinished" means served, not answered, for 24 hours.** `GET /api/task`
records the task it serves (`users.lastServedTaskId`, `lastServedAt`). A
contributor whose last served task is 24 h to 7 days old, still unanswered by
them, and still open, gets one reminder (eventKey = the task id).

**A cron route drains the queue.** `POST /api/cron/email-queue` enqueues due
reminders, then sends due rows in order (verification never waits here),
oldest first, up to the notice budget. It runs every 10 minutes from a Railway
cron service in `.railway/railway.ts`, like the other crons (#222).

**No address leaves the server.** Rows hold the `userId`, not the address; it
is read at send time. Logs and Sentry get Resend's error name only.

## Consequences

- The duplicate metric is a query: `GROUP BY userId, kind, eventKey HAVING
  count(*) > 1` over `email_sends` is empty by construction, and the evidence
  for #268 is that query plus the day's counts.
- At 100 a day, a large campaign launch reaches up to 80 people the first day
  and the rest the next morning. Raising the limit is an env change once
  Centient pays for Resend.
- A reminder can't know whether a served task was seen on screen; serving it
  is the signal. Once per task bounds the cost of a wrong guess.
- The cron is the only sender of notices: if it stops, notices wait in the
  queue (verification still works).
