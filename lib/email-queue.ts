import { Prisma } from "@/app/generated/prisma/client";
import prisma from "./prisma";
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

export type EmailKind = "verification" | "funded_work" | "task_reminder";

const NOTICE_OF: Record<Exclude<EmailKind, "verification">, NoticeKind> = {
  funded_work: "newWork",
  task_reminder: "reminders",
};

/** Resend's free tier: 100 emails a day. */
export function dailyLimit(): number {
  const n = Number(process.env.EMAIL_DAILY_LIMIT);
  return Number.isInteger(n) && n > 0 ? n : 100;
}

/** Sends held back from notices each day so verification always fits. */
export function verificationReserve(): number {
  const n = Number(process.env.EMAIL_VERIFICATION_RESERVE);
  return Number.isInteger(n) && n >= 0 ? Math.min(n, dailyLimit()) : Math.min(20, dailyLimit());
}

export const MAX_ATTEMPTS = 3;
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

/** 00:00 Asia/Manila of `at`'s Manila day. */
export function manilaDayStart(at: Date): Date {
  const local = new Date(at.getTime() + MANILA_OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - MANILA_OFFSET_MS);
}

// ------------------------------------------------------------- budget ----

export async function sentToday(now: Date): Promise<number> {
  return prisma.emailSend.count({ where: { status: "sent", sentAt: { gte: utcDayStart(now) } } });
}

/** Whether a verification fits today: the whole limit, reserve included. */
export async function verificationAllowed(now: Date = new Date()): Promise<boolean> {
  return (await sentToday(now)) < dailyLimit();
}

/** Log a verification that was just sent. Counts toward today's limit. */
export async function logVerificationSend(userId: string, tokenHash: string, now: Date = new Date()): Promise<void> {
  await prisma.emailSend.create({
    data: {
      userId,
      kind: "verification",
      eventKey: tokenHash,
      dedupeKey: `${userId}:verification:${tokenHash}`,
      status: "sent",
      attempts: 1,
      notBefore: now,
      sentAt: now,
    },
  });
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
      AND t.disabled = false
      AND (c.id IS NULL OR c."pausedAt" IS NULL)
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
  budget: number;
  sent: number;
  skipped: number;
  deferred: number;
  failed: number;
}

function messageFor(kind: Exclude<EmailKind, "verification">, payload: Prisma.JsonValue, unsubscribeToken: string): ContactMessage {
  const p = (payload ?? {}) as Record<string, unknown>;
  return kind === "funded_work"
    ? fundedWorkMessage(typeof p.taskCount === "number" ? p.taskCount : 0, unsubscribeToken)
    : reminderMessage(unsubscribeToken);
}

/**
 * Send due notices, oldest first, within today's notice budget (the daily
 * limit minus the verification reserve). Nothing is sent in quiet hours: due
 * rows move to the next 08:00 Manila. A row that doesn't fit today stays
 * queued. Preferences are checked again here, so an unsubscribe wins.
 */
export async function drainQueue(now: Date = new Date(), send: Sender = sendContactEmail): Promise<DrainReport> {
  const report: DrainReport = { budget: 0, sent: 0, skipped: 0, deferred: 0, failed: 0 };

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
    const kind = row.kind as Exclude<EmailKind, "verification">;

    const contact = await prisma.contactEmail.findUnique({ where: { userId: row.userId } });
    let skip: string | null = null;
    if (!contact?.address || !contact.verifiedAt) skip = "no_address";
    else if (contact.unsubscribedAt) skip = "unsubscribed";
    else if (!isNotifiable(contact, NOTICE_OF[kind])) skip = "preference_off";
    else if (kind === "funded_work") {
      const already = await prisma.emailSend.count({
        where: { userId: row.userId, kind: "funded_work", status: "sent", sentAt: { gte: manilaDayStart(now) } },
      });
      if (already > 0) skip = "capped";
    }
    if (skip) {
      await prisma.emailSend.updateMany({ where: { id: row.id, status: "queued" }, data: { status: "skipped", reason: skip } });
      report.skipped++;
      continue;
    }

    // Claim the row, so two drains running at once can't both send it.
    const claimed = await prisma.emailSend.updateMany({
      where: { id: row.id, status: "queued" },
      data: { status: "sending", attempts: { increment: 1 } },
    });
    if (claimed.count === 0) continue;

    const result = await send(
      contact!.address!,
      messageFor(kind, row.payload, contact!.unsubscribeToken),
      contact!.unsubscribeToken,
    );
    if (result === "sent" || result === "skipped") {
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
            ? { status: "failed", lastError: "send_failed" }
            : { status: "queued", notBefore: new Date(now.getTime() + RETRY_BACKOFF_MS), lastError: "send_failed" },
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
