import { randomUUID } from "node:crypto";
import { Prisma } from "@/app/generated/prisma/client";
import prisma from "./prisma";
import { REWARDED_STATUSES } from "./constants";
import { isNotifiable, type NoticeKind } from "./contact-email";
import {
  fundedWorkMessage,
  reminderMessage,
  sendContactEmail,
  type ContactMessage,
  type SendResult,
} from "./contact-email-send";
import { gatingOn } from "./gamification/flag";
import { effectiveTier } from "./gamification/tiers";

// The contributor email queue and send log (#260, ADR-0013).
//
// One row per (person, kind, event) in email_sends; a unique dedupeKey makes
// enqueueing idempotent. Verification is sent at once and only logged here.
// Notices wait for the cron drain, which applies Asia/Manila quiet hours, a
// per-person cap and a daily budget that always leaves room for verification.

export type EmailKind = "verification" | "funded_work" | "task_reminder" | "customer_verification";

type NoticeEmailKind = "funded_work" | "task_reminder";

const NOTICE_OF: Record<NoticeEmailKind, NoticeKind> = {
  funded_work: "newWork",
  task_reminder: "reminders",
};

/** Resend's free tier: 100 emails a day. */
export function dailyLimit(): number {
  const n = Number(process.env.EMAIL_DAILY_LIMIT);
  return Number.isInteger(n) && n > 0 ? n : 100;
}

/** Resend's free tier: 3,000 emails a month. */
export function monthlyLimit(): number {
  const n = Number(process.env.EMAIL_MONTHLY_LIMIT);
  return Number.isInteger(n) && n > 0 ? n : 3000;
}

/** Sends held back from notices each day so verification always fits. */
export function verificationReserve(): number {
  const n = Number(process.env.EMAIL_VERIFICATION_RESERVE);
  return Number.isInteger(n) && n >= 0 ? Math.min(n, dailyLimit()) : Math.min(20, dailyLimit());
}

export const MAX_ATTEMPTS = 3;
/** A row left in "sending" this long was cut off mid-send (ADR-0013). */
export const STRANDED_AFTER_MS = 15 * 60 * 1000;
export const RETRY_BACKOFF_MS = 15 * 60 * 1000;
export const REMINDER_AFTER_MS = 24 * 60 * 60 * 1000;
export const REMINDER_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------- time ----

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000; // UTC+8, no daylight saving
const QUIET_START_HOUR = 21;
const QUIET_END_HOUR = 8;

/** True between 21:00 and 08:00 Asia/Manila. */
export function inQuietHours(at: Date): boolean {
  const hour = new Date(at.getTime() + MANILA_OFFSET_MS).getUTCHours();
  return hour >= QUIET_START_HOUR || hour < QUIET_END_HOUR;
}

/** `at` itself outside quiet hours, else the next 08:00 Manila. */
export function nextSendableAt(at: Date): Date {
  if (!inQuietHours(at)) return at;
  const local = new Date(at.getTime() + MANILA_OFFSET_MS);
  const day = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  const morning = local.getUTCHours() >= QUIET_START_HOUR ? day + 24 * 60 * 60 * 1000 : day;
  // 08:00 Manila is 00:00 UTC of the same calendar date.
  return new Date(morning + QUIET_END_HOUR * 60 * 60 * 1000 - MANILA_OFFSET_MS);
}

/** 00:00 UTC, when Resend's daily quota resets. */
export function utcDayStart(at: Date): Date {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
}

/** 00:00 UTC on the 1st, when Resend's monthly quota resets. */
export function utcMonthStart(at: Date): Date {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));
}

/** 00:00 Asia/Manila of `at`'s Manila day. */
export function manilaDayStart(at: Date): Date {
  const local = new Date(at.getTime() + MANILA_OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - MANILA_OFFSET_MS);
}

// ------------------------------------------------------------- budget ----

/**
 * Sends that count against Resend's day: sent, in flight, and "unknown" (cut
 * off mid-send, so Resend may have taken it). `sentAt` is stamped when a row
 * is claimed and cleared if the provider refuses it.
 */
export async function sentToday(now: Date): Promise<number> {
  return prisma.emailSend.count({
    where: { status: { in: ["sent", "sending", "unknown"] }, sentAt: { gte: utcDayStart(now) } },
  });
}

const BUDGET_LOCK = "email-budget";

type Tx = Prisma.TransactionClient;

/**
 * Reserve one of today's sends before calling the provider (ADR-0013). Under
 * one advisory lock: count the day's sends and, below `capacity`, run `write`,
 * which inserts or claims a row as "sending" with `sentAt` = now, so it counts
 * at once. "full" when there is no room; "lost" when `write` found nothing.
 */
async function reserve(
  now: Date,
  room: { day: number; month: number },
  write: (tx: Tx) => Promise<boolean>,
): Promise<"ok" | "full" | "lost"> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${BUDGET_LOCK}))`;
    const counted = { status: { in: ["sent", "sending", "unknown"] } };
    const [day, month] = await Promise.all([
      tx.emailSend.count({ where: { ...counted, sentAt: { gte: utcDayStart(now) } } }),
      tx.emailSend.count({ where: { ...counted, sentAt: { gte: utcMonthStart(now) } } }),
    ]);
    if (day >= room.day || month >= room.month) return "full";
    return (await write(tx)) ? "ok" : "lost";
  });
}

/** Verifications may use the whole day and month. */
const verificationRoom = () => ({ day: dailyLimit(), month: monthlyLimit() });
/** Notices stop short of both by the verification reserve. */
const noticeRoom = () => ({
  day: dailyLimit() - verificationReserve(),
  month: monthlyLimit() - verificationReserve(),
});

/** Reserve a slot for a send that happens right now, outside the queue. */
async function reserveImmediate(
  kind: "verification" | "customer_verification",
  userId: string | null,
  now: Date,
): Promise<string | null> {
  const id = randomUUID();
  const eventKey = randomUUID();
  const outcome = await reserve(now, verificationRoom(), async (tx) => {
    await tx.emailSend.create({
      data: {
        id,
        userId,
        kind,
        eventKey,
        dedupeKey: `${userId ?? "customer"}:${kind}:${eventKey}`,
        status: "sending",
        attempts: 1,
        notBefore: now,
        sentAt: now,
      },
    });
    return true;
  });
  return outcome === "ok" ? id : null;
}

/**
 * A contributor's verification email: the whole daily limit, reserve included.
 * Null when the day is spent. Pass the id to `finishSend` after sending.
 */
export function reserveVerification(userId: string, now: Date = new Date()): Promise<string | null> {
  return reserveImmediate("verification", userId, now);
}

/**
 * An admin's customer verification email (lib/email.ts): same Resend key, same
 * day, same limit. No user row: customers are admin accounts.
 */
export function reserveCustomerVerification(now: Date = new Date()): Promise<string | null> {
  return reserveImmediate("customer_verification", null, now);
}

/** How a provider call ended. */
export type SendOutcome = "sent" | "refused" | "unknown" | "not_sent";

/**
 * Settle a reserved row. "refused" (Resend said no) and "not_sent" (we never
 * called it) give the slot back; "unknown" (no answer) keeps it and is never
 * retried, since Resend may have taken the message.
 */
export async function finishSend(id: string, outcome: SendOutcome, now: Date = new Date()): Promise<void> {
  const data =
    outcome === "sent"
      ? { status: "sent", sentAt: now }
      : outcome === "unknown"
        ? { status: "unknown", reason: "ambiguous" }
        : { status: outcome === "refused" ? "failed" : "skipped", reason: outcome, sentAt: null, lastError: outcome === "refused" ? "refused" : null };
  await prisma.emailSend.update({ where: { id }, data });
}

// ------------------------------------------------------------ enqueue ----

/**
 * `funded_work_available` (ADR-0013): new paid work opened on a campaign.
 * Week 1 emits it when an admin's CSV upload completes on a funded campaign;
 * #253 emits it when the indexer confirms an escrow tranche release.
 */
export interface FundedWorkAvailable {
  campaignId: string;
  source: "admin_publish" | "tranche_release";
  /** Unique within its source: the upload job id, or the release tx hash. */
  sourceId: string;
  /** Tasks the event opened. */
  taskCount: number;
  /** ISO 8601. */
  occurredAt: string;
}

export function fundedWorkEventKey(event: FundedWorkAvailable): string {
  return `${event.source}:${event.sourceId}`;
}

/** Contributors with a verified address and `notice` on, not banned. */
async function noticeAudience(notice: NoticeKind, minTier: number) {
  const rows = await prisma.contactEmail.findMany({
    where: {
      address: { not: null },
      verifiedAt: { not: null },
      unsubscribedAt: null,
      ...(notice === "newWork" ? { notifyNewWork: true } : { notifyReminders: true }),
      user: { isBanned: false },
    },
    select: { userId: true, user: { select: { tier: true, tierOnHold: true } } },
  });
  if (!gatingOn() || minTier <= 0) return rows.map((r) => r.userId);
  return rows.filter((r) => effectiveTier(r.user.tier, r.user.tierOnHold) >= minTier).map((r) => r.userId);
}

/**
 * Fan `funded_work_available` out to everyone who opted in and can work the
 * campaign. Idempotent: re-emitting the same event adds no rows. Returns how
 * many rows it added.
 */
export async function emitFundedWorkAvailable(event: FundedWorkAvailable, now: Date = new Date()): Promise<number> {
  if (event.taskCount <= 0) return 0;
  const campaign = await prisma.campaign.findUnique({
    where: { id: event.campaignId },
    select: { pausedAt: true, minTier: true, rewardUnits: true, balance: { select: { balanceUnits: true } } },
  });
  // Funded means the balance covers at least one reward; a paused campaign serves nothing.
  if (!campaign || campaign.pausedAt) return 0;
  if ((campaign.balance?.balanceUnits ?? 0n) < campaign.rewardUnits) return 0;

  const eventKey = fundedWorkEventKey(event);
  const userIds = await noticeAudience("newWork", campaign.minTier);
  if (userIds.length === 0) return 0;

  const notBefore = nextSendableAt(now);
  const payload = { campaignId: event.campaignId, source: event.source, taskCount: event.taskCount };
  const { count } = await prisma.emailSend.createMany({
    data: userIds.map((userId) => ({
      userId,
      kind: "funded_work",
      eventKey,
      dedupeKey: `${userId}:funded_work:${eventKey}`,
      notBefore,
      payload,
    })),
    skipDuplicates: true,
  });
  return count;
}

/** SQL: task `t` is still open (not disabled, campaign not paused, target not met). */
const TASK_OPEN = Prisma.sql`
  t.disabled = false
  AND (c.id IS NULL OR c."pausedAt" IS NULL)
  AND (
    COALESCE(t."responseTarget", c."defaultResponseTarget") IS NULL
    OR (
      SELECT COUNT(*) FROM submissions s2
      WHERE s2."taskId" = t.id
        AND s2."payoutStatus" IN (${Prisma.join([...REWARDED_STATUSES])})
        AND s2."isGoldCheck" = false
    ) < COALESCE(t."responseTarget", c."defaultResponseTarget")
  )`;

/** Whether `taskId` is still open and unanswered by `userId`. Rechecked at send time. */
export async function taskStillUnfinished(userId: string, taskId: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ ok: number }[]>`
    SELECT 1 AS ok FROM tasks t LEFT JOIN campaigns c ON c.id = t."campaignId"
    WHERE t.id = ${taskId} AND ${TASK_OPEN}
      AND NOT EXISTS (SELECT 1 FROM submissions s WHERE s."userId" = ${userId} AND s."taskId" = t.id)`;
  return rows.length > 0;
}

/**
 * One reminder per unfinished task: the contributor's last served task, served
 * 24 h to 7 days ago, still unanswered by them and still open.
 */
export async function enqueueReminders(now: Date = new Date()): Promise<number> {
  const due = await prisma.$queryRaw<{ userId: string; taskId: string }[]>`
    SELECT u.id AS "userId", u."lastServedTaskId" AS "taskId"
    FROM users u
    JOIN contact_emails ce ON ce."userId" = u.id
    JOIN tasks t ON t.id = u."lastServedTaskId"
    LEFT JOIN campaigns c ON c.id = t."campaignId"
    WHERE u."lastServedAt" <= ${new Date(now.getTime() - REMINDER_AFTER_MS)}
      AND u."lastServedAt" > ${new Date(now.getTime() - REMINDER_WINDOW_MS)}
      AND u."isBanned" = false
      AND ce.address IS NOT NULL AND ce."verifiedAt" IS NOT NULL
      AND ce."unsubscribedAt" IS NULL AND ce."notifyReminders" = true
      AND ${TASK_OPEN}
      AND NOT EXISTS (SELECT 1 FROM submissions s WHERE s."userId" = u.id AND s."taskId" = t.id)
  `;
  if (due.length === 0) return 0;
  const notBefore = nextSendableAt(now);
  const { count } = await prisma.emailSend.createMany({
    data: due.map(({ userId, taskId }) => ({
      userId,
      kind: "task_reminder",
      eventKey: taskId,
      dedupeKey: `${userId}:task_reminder:${taskId}`,
      notBefore,
      payload: { taskId },
    })),
    skipDuplicates: true,
  });
  return count;
}

// -------------------------------------------------------------- drain ----

export type Sender = (to: string, message: ContactMessage, unsubscribeToken: string) => Promise<SendResult>;

export interface DrainReport {
  /** False when another drain held the lock, so this one did nothing. */
  ran: boolean;
  budget: number;
  sent: number;
  skipped: number;
  deferred: number;
  failed: number;
  /** Rows found stuck in "sending" and marked "unknown". */
  stranded: number;
}

/** Drains are serialized: the budget is read once per drain, so two at once could overspend it. */
const DRAIN_LOCK = "email-queue-drain";

function messageFor(kind: NoticeEmailKind, payload: Prisma.JsonValue, unsubscribeToken: string): ContactMessage {
  const p = (payload ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  return kind === "funded_work"
    ? fundedWorkMessage(typeof p.taskCount === "number" ? p.taskCount : 0, unsubscribeToken, str(p.campaignId))
    : reminderMessage(unsubscribeToken, str(p.taskId));
}

/**
 * Send due notices, oldest first, within today's notice budget (the daily
 * limit minus the verification reserve). Nothing is sent in quiet hours: due
 * rows move to the next 08:00 Manila. A row that doesn't fit today stays
 * queued. Preferences are checked again here, so an unsubscribe wins.
 */
export async function drainQueue(now: Date = new Date(), send: Sender = sendContactEmail): Promise<DrainReport> {
  // Held for the whole drain on one pooled connection; the sends themselves
  // use others. pg_try_: a second drain returns at once instead of queueing.
  return prisma.$transaction(
    async (tx) => {
      const [{ locked }] = await tx.$queryRaw<{ locked: boolean }[]>`
        SELECT pg_try_advisory_xact_lock(hashtext(${DRAIN_LOCK})) AS locked`;
      if (!locked) return { ran: false, budget: 0, sent: 0, skipped: 0, deferred: 0, failed: 0, stranded: 0 };
      return drainLocked(now, send);
    },
    { timeout: 10 * 60 * 1000, maxWait: 10_000 },
  );
}

async function drainLocked(now: Date, send: Sender): Promise<DrainReport> {
  const report: DrainReport = { ran: true, budget: 0, sent: 0, skipped: 0, deferred: 0, failed: 0, stranded: 0 };

  // A row still "sending" long after its claim was cut off mid-send. Resend
  // may have taken it, so it is never retried (that could send twice) and it
  // keeps counting toward its day.
  const stranded = await prisma.emailSend.updateMany({
    where: { status: "sending", updatedAt: { lt: new Date(now.getTime() - STRANDED_AFTER_MS) } },
    data: { status: "unknown", reason: "stranded" },
  });
  report.stranded = stranded.count;

  if (inQuietHours(now)) {
    const { count } = await prisma.emailSend.updateMany({
      where: { status: "queued", notBefore: { lte: now }, kind: { not: "verification" } },
      data: { notBefore: nextSendableAt(now) },
    });
    report.deferred = count;
    return report;
  }

  report.budget = Math.max(0, dailyLimit() - verificationReserve() - (await sentToday(now)));
  if (report.budget === 0) return report;

  const due = await prisma.emailSend.findMany({
    where: { status: "queued", notBefore: { lte: now }, kind: { in: ["funded_work", "task_reminder"] } },
    orderBy: { createdAt: "asc" },
    take: report.budget * 2 + 50,
  });

  for (const row of due) {
    if (report.sent >= report.budget) break;
    const kind = row.kind as NoticeEmailKind;

    const contact = row.userId ? await prisma.contactEmail.findUnique({ where: { userId: row.userId } }) : null;
    let skip: string | null = null;
    if (!row.userId || !contact?.address || !contact.verifiedAt) skip = "no_address";
    else if (contact.unsubscribedAt) skip = "unsubscribed";
    else if (!isNotifiable(contact, NOTICE_OF[kind])) skip = "preference_off";
    else if (kind === "funded_work") {
      const already = await prisma.emailSend.count({
        where: { userId: row.userId!, kind: "funded_work", status: { in: ["sent", "sending", "unknown"] }, sentAt: { gte: manilaDayStart(now) } },
      });
      if (already > 0) skip = "capped";
    } else if (kind === "task_reminder") {
      const taskId = (row.payload as Record<string, unknown> | null)?.taskId;
      if (typeof taskId !== "string" || !(await taskStillUnfinished(row.userId!, taskId))) skip = "task_done";
    }
    if (skip) {
      await prisma.emailSend.updateMany({ where: { id: row.id, status: "queued" }, data: { status: "skipped", reason: skip } });
      report.skipped++;
      continue;
    }

    // Claim the row inside the day's budget: verifications reserving at the
    // same moment see it, and it sees them.
    const claimed = await reserve(now, noticeRoom(), async (tx) => {
      const { count } = await tx.emailSend.updateMany({
        where: { id: row.id, status: "queued" },
        data: { status: "sending", attempts: { increment: 1 }, sentAt: now },
      });
      return count === 1;
    });
    if (claimed === "full") break;
    if (claimed === "lost") continue;

    const result = await send(
      contact!.address!,
      messageFor(kind, row.payload, contact!.unsubscribeToken),
      contact!.unsubscribeToken,
    );
    if (result === "unknown") {
      // No answer from Resend: it may have sent. Never retry (a duplicate is
      // worse than a miss); the slot stays counted.
      await prisma.emailSend.update({ where: { id: row.id }, data: { status: "unknown", reason: "ambiguous" } });
      report.failed++;
    } else if (result === "sent" || result === "skipped") {
      // "skipped": Resend isn't configured (local dev). Logged as sent so the
      // drain behaves the same; production always has a key.
      await prisma.emailSend.update({ where: { id: row.id }, data: { status: "sent", sentAt: now, lastError: null } });
      report.sent++;
    } else {
      const attempts = row.attempts + 1;
      await prisma.emailSend.update({
        where: { id: row.id },
        data:
          attempts >= MAX_ATTEMPTS
            ? { status: "failed", lastError: "send_failed", sentAt: null }
            : { status: "queued", notBefore: new Date(now.getTime() + RETRY_BACKOFF_MS), lastError: "send_failed", sentAt: null },
      });
      report.failed++;
    }
  }
  return report;
}

/** Stamp the task just served, for the unfinished-task reminder. */
export async function recordServed(userId: string, taskId: string, now: Date = new Date()): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { lastServedTaskId: taskId, lastServedAt: now } });
}
