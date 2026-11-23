import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  drainQueue,
  emitFundedWorkAvailable,
  enqueueReminders,
  inQuietHours,
  logVerificationSend,
  nextSendableAt,
  recordServed,
  sentToday,
  verificationAllowed,
  type FundedWorkAvailable,
  type Sender,
} from "@/lib/email-queue";
import { requestVerification, unsubscribe, updatePreferences, verifyContactEmail } from "@/lib/contact-email";
import { processJob } from "@/lib/upload-worker";
import { prisma, truncateAll } from "@/tests/helpers/db";
import { createAdminUser, createCampaign, createCampaignBalance, createUser, makeWallet } from "@/tests/helpers/factories";

// #260 (ADR-0013): the idempotent send queue and log.

// 10:00 Manila = 02:00 UTC, a weekday morning outside quiet hours.
const MORNING = new Date("2026-11-25T02:00:00Z");
// 22:30 Manila = 14:30 UTC, inside quiet hours.
const NIGHT = new Date("2026-11-25T14:30:00Z");

const REWARD = 10_000n;

let sends: { to: string; subject: string }[] = [];
const fakeSend: Sender = async (to, message) => {
  sends.push({ to, subject: message.subject });
  return "sent";
};

/** A contributor with a verified address and the given notices on. */
async function contributor(n: number, prefs: { newWork?: boolean; reminders?: boolean } = { newWork: true, reminders: true }) {
  const user = await createUser({ walletAddress: makeWallet(n) });
  const req = await requestVerification(user.id, `c${n}@example.com`, MORNING);
  if (!req.ok) throw new Error(req.error);
  await verifyContactEmail(req.token, MORNING);
  await updatePreferences(user.id, { notifyNewWork: prefs.newWork ?? false, notifyReminders: prefs.reminders ?? false }, MORNING);
  return user;
}

let admins = 0;
async function fundedCampaign(balance: bigint = REWARD * 10n) {
  const admin = await createAdminUser({ email: `admin${++admins}@example.com` });
  const campaign = await createCampaign({ adminUserId: admin.id, rewardUnits: REWARD });
  await createCampaignBalance(campaign.id, balance);
  return campaign;
}

function event(campaignId: string, sourceId = "job-1", taskCount = 5): FundedWorkAvailable {
  return { campaignId, source: "admin_publish", sourceId, taskCount, occurredAt: MORNING.toISOString() };
}

async function rows(kind?: string) {
  return prisma.emailSend.findMany({ where: kind ? { kind } : {}, orderBy: { createdAt: "asc" } });
}

beforeEach(async () => {
  await truncateAll();
  sends = [];
  vi.stubEnv("EMAIL_DAILY_LIMIT", "");
  vi.stubEnv("EMAIL_VERIFICATION_RESERVE", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("quiet hours, Asia/Manila 21:00–08:00", () => {
  it.each([
    ["2026-11-25T12:59:59Z", false], // 20:59:59 Manila
    ["2026-11-25T13:00:00Z", true], //  21:00
    ["2026-11-25T23:59:59Z", true], //  07:59:59 next day
    ["2026-11-26T00:00:00Z", false], // 08:00
  ])("%s quiet=%s", (iso, quiet) => {
    expect(inQuietHours(new Date(iso))).toBe(quiet);
  });

  it("moves a quiet-hours time to the next 08:00 Manila, before and after midnight", () => {
    expect(nextSendableAt(NIGHT).toISOString()).toBe("2026-11-26T00:00:00.000Z");
    expect(nextSendableAt(new Date("2026-11-25T19:00:00Z")).toISOString()).toBe("2026-11-26T00:00:00.000Z"); // 03:00 Manila
    expect(nextSendableAt(MORNING)).toEqual(MORNING);
  });
});

describe("funded_work_available: 0 duplicate sends per person per event", () => {
  it("emitting the same event twice queues one row per person, and the drain sends each once", async () => {
    const a = await contributor(1);
    const b = await contributor(2);
    const campaign = await fundedCampaign();

    expect(await emitFundedWorkAvailable(event(campaign.id), MORNING)).toBe(2);
    expect(await emitFundedWorkAvailable(event(campaign.id), MORNING)).toBe(0);
    await Promise.all([drainQueue(MORNING, fakeSend), drainQueue(MORNING, fakeSend)]);
    await drainQueue(MORNING, fakeSend);

    expect(sends.map((s) => s.to).sort()).toEqual(["c1@example.com", "c2@example.com"]);
    const log = await rows("funded_work");
    expect(log.map((r) => [r.userId, r.status]).sort()).toEqual([[a.id, "sent"], [b.id, "sent"]].sort());

    // The SOW metric, as the evidence query runs it.
    const dupes = await prisma.$queryRaw<unknown[]>`
      SELECT "userId", kind, "eventKey" FROM email_sends WHERE status = 'sent'
      GROUP BY "userId", kind, "eventKey" HAVING count(*) > 1`;
    expect(dupes).toEqual([]);
  });

  it("reaches only verified addresses with the notice on, not banned", async () => {
    await contributor(1);
    await contributor(2, { newWork: false, reminders: true });
    const banned = await contributor(3);
    await prisma.user.update({ where: { id: banned.id }, data: { isBanned: true } });
    const pending = await createUser({ walletAddress: makeWallet(4) });
    await requestVerification(pending.id, "pending@example.com", MORNING);
    await updatePreferences(pending.id, { notifyNewWork: true }, MORNING);

    const campaign = await fundedCampaign();
    expect(await emitFundedWorkAvailable(event(campaign.id), MORNING)).toBe(1);
  });

  it("does nothing for an unfunded or paused campaign, or an event with no tasks", async () => {
    await contributor(1);
    const unfunded = await fundedCampaign(REWARD - 1n);
    expect(await emitFundedWorkAvailable(event(unfunded.id), MORNING)).toBe(0);

    const paused = await fundedCampaign();
    await prisma.campaign.update({ where: { id: paused.id }, data: { pausedAt: MORNING } });
    expect(await emitFundedWorkAvailable(event(paused.id), MORNING)).toBe(0);

    const ok = await fundedCampaign();
    expect(await emitFundedWorkAvailable(event(ok.id, "job-x", 0), MORNING)).toBe(0);
  });

  it("a tranche release from #253 uses the same queue, keyed apart from the publish", async () => {
    await contributor(1);
    const campaign = await fundedCampaign();
    await emitFundedWorkAvailable(event(campaign.id), MORNING);
    await emitFundedWorkAvailable(
      { campaignId: campaign.id, source: "tranche_release", sourceId: "abc123txhash", taskCount: 3, occurredAt: MORNING.toISOString() },
      MORNING,
    );
    expect((await rows("funded_work")).map((r) => r.eventKey)).toEqual(["admin_publish:job-1", "tranche_release:abc123txhash"]);
  });

  it("caps new-work notices at one per person per Manila day: the second event that day is skipped, capped", async () => {
    await contributor(1);
    const campaign = await fundedCampaign();
    await emitFundedWorkAvailable(event(campaign.id, "job-1"), MORNING);
    await emitFundedWorkAvailable(event(campaign.id, "job-2"), MORNING);
    await drainQueue(MORNING, fakeSend);

    expect(sends).toHaveLength(1);
    expect((await rows("funded_work")).map((r) => [r.status, r.reason])).toEqual([
      ["sent", null],
      ["skipped", "capped"],
    ]);
  });
});

describe("quiet hours defer, never drop", () => {
  it("an event at night is queued for 08:00 and sent then", async () => {
    await contributor(1);
    const campaign = await fundedCampaign();
    await emitFundedWorkAvailable(event(campaign.id), NIGHT);

    const [row] = await rows("funded_work");
    expect(row.status).toBe("queued");
    expect(row.notBefore.toISOString()).toBe("2026-11-26T00:00:00.000Z");

    expect((await drainQueue(NIGHT, fakeSend)).sent).toBe(0);
    const later = await drainQueue(new Date("2026-11-26T00:05:00Z"), fakeSend);
    expect(later.sent).toBe(1);
  });

  it("a row already due is pushed to the morning by a drain in quiet hours", async () => {
    await contributor(1);
    const campaign = await fundedCampaign();
    await emitFundedWorkAvailable(event(campaign.id), MORNING);

    const report = await drainQueue(NIGHT, fakeSend);
    expect(report).toMatchObject({ sent: 0, deferred: 1 });
    const [row] = await rows("funded_work");
    expect(row.status).toBe("queued");
    expect(row.notBefore.toISOString()).toBe("2026-11-26T00:00:00.000Z");
  });
});

describe("the daily limit, verification first", () => {
  it("notices stop at the limit minus the reserve; the rest wait for tomorrow; verification still fits", async () => {
    vi.stubEnv("EMAIL_DAILY_LIMIT", "5");
    vi.stubEnv("EMAIL_VERIFICATION_RESERVE", "2");
    for (let n = 1; n <= 6; n++) await contributor(n);
    const campaign = await fundedCampaign();
    await emitFundedWorkAvailable(event(campaign.id), MORNING);

    const report = await drainQueue(MORNING, fakeSend);
    expect(report).toMatchObject({ budget: 3, sent: 3 });
    expect((await rows("funded_work")).filter((r) => r.status === "queued")).toHaveLength(3);

    // Notices are spent, but the reserve keeps verification open…
    expect(await verificationAllowed(MORNING)).toBe(true);
    const someone = await createUser({ walletAddress: makeWallet(99) });
    await logVerificationSend(someone.id, "hash-1", MORNING);
    await logVerificationSend(someone.id, "hash-2", MORNING);
    // …until the whole limit is used.
    expect(await sentToday(MORNING)).toBe(5);
    expect(await verificationAllowed(MORNING)).toBe(false);
    expect((await drainQueue(MORNING, fakeSend)).sent).toBe(0);

    // Tomorrow's budget sends what waited.
    const tomorrow = new Date("2026-11-26T02:00:00Z");
    expect((await drainQueue(tomorrow, fakeSend)).sent).toBe(3);
    expect(sends).toHaveLength(6);
  });

  it("never sends more in a day than the limit, across many drains", async () => {
    vi.stubEnv("EMAIL_DAILY_LIMIT", "4");
    vi.stubEnv("EMAIL_VERIFICATION_RESERVE", "1");
    for (let n = 1; n <= 10; n++) await contributor(n);
    const campaign = await fundedCampaign();
    await emitFundedWorkAvailable(event(campaign.id), MORNING);
    for (let i = 0; i < 5; i++) await drainQueue(new Date(MORNING.getTime() + i * 600_000), fakeSend);
    expect(await sentToday(MORNING)).toBeLessThanOrEqual(4);
    expect(sends).toHaveLength(3);
  });
});

describe("preferences and unsubscribes win at send time", () => {
  it("skips a queued row once the contributor unsubscribes or turns the notice off", async () => {
    const a = await contributor(1);
    const b = await contributor(2);
    const campaign = await fundedCampaign();
    await emitFundedWorkAvailable(event(campaign.id), MORNING);

    const aToken = (await prisma.contactEmail.findUniqueOrThrow({ where: { userId: a.id } })).unsubscribeToken;
    await unsubscribe(aToken, MORNING);
    await updatePreferences(b.id, { notifyNewWork: false }, MORNING);

    const report = await drainQueue(MORNING, fakeSend);
    expect(report).toMatchObject({ sent: 0, skipped: 2 });
    const reasons = Object.fromEntries((await rows()).filter((r) => r.kind === "funded_work").map((r) => [r.userId, r.reason]));
    expect(reasons).toEqual({ [a.id]: "unsubscribed", [b.id]: "preference_off" });
  });
});

describe("unfinished-task reminder", () => {
  async function servedTask(userId: string, hoursAgo: number) {
    const campaign = await fundedCampaign();
    const task = await prisma.task.create({ data: { prompt: `p-${hoursAgo}`, responseA: "a", responseB: "b", campaignId: campaign.id } });
    await recordServed(userId, task.id, new Date(MORNING.getTime() - hoursAgo * 3_600_000));
    return task;
  }

  it("queues one reminder for a task served over 24 h ago and not answered, once", async () => {
    const user = await contributor(1);
    const task = await servedTask(user.id, 25);

    expect(await enqueueReminders(MORNING)).toBe(1);
    expect(await enqueueReminders(MORNING)).toBe(0);
    await drainQueue(MORNING, fakeSend);
    await enqueueReminders(new Date(MORNING.getTime() + 3_600_000));

    const log = await rows("task_reminder");
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ eventKey: task.id, status: "sent" });
    expect(sends[0].subject).toContain("unfinished");
  });

  it("skips recent, answered, stale, disabled or opted-out cases", async () => {
    const recent = await contributor(1);
    await servedTask(recent.id, 2);

    const answered = await contributor(2);
    const t = await servedTask(answered.id, 30);
    await prisma.submission.create({
      data: { userId: answered.id, taskId: t.id, choice: "A", reason: "Response A is clearer and more accurate overall.", payoutAmountUnits: 0n },
    });

    const stale = await contributor(3);
    await servedTask(stale.id, 8 * 24);

    const disabled = await contributor(4);
    const d = await servedTask(disabled.id, 30);
    await prisma.task.update({ where: { id: d.id }, data: { disabled: true } });

    const optedOut = await contributor(5, { newWork: true, reminders: false });
    await servedTask(optedOut.id, 30);

    expect(await enqueueReminders(MORNING)).toBe(0);
  });
});

describe("send failures", () => {
  it("retries after a backoff and gives up after 3 attempts", async () => {
    await contributor(1);
    const campaign = await fundedCampaign();
    await emitFundedWorkAvailable(event(campaign.id), MORNING);
    const failing: Sender = async () => "failed";

    let at = MORNING;
    for (let i = 0; i < 3; i++) {
      await drainQueue(at, failing);
      at = new Date(at.getTime() + 16 * 60_000);
    }
    const [row] = await rows("funded_work");
    expect(row).toMatchObject({ status: "failed", attempts: 3, lastError: "send_failed" });
  });
});

describe("Week 1 trigger: an admin CSV publish on a funded campaign", () => {
  async function upload(campaignId: string, adminUserId: string, rawText: string) {
    const job = await prisma.uploadJob.create({
      data: { campaignId, adminUserId, fileName: "t.csv", fileSize: rawText.length, status: "processing", totalRows: 2, chunksTotal: 1, rawText },
    });
    await processJob(job.id);
    return job.id;
  }

  it("queues funded_work_available keyed on the upload job", async () => {
    const user = await contributor(1);
    const admin = await createAdminUser({ email: `admin${++admins}@example.com` });
    const campaign = await createCampaign({ adminUserId: admin.id, rewardUnits: REWARD });
    await createCampaignBalance(campaign.id, REWARD * 5n);

    const jobId = await upload(campaign.id, admin.id, "prompt,responseA,responseB\nq1,a,b\nq2,a,b\n");
    const log = await rows("funded_work");
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ userId: user.id, eventKey: `admin_publish:${jobId}`, status: "queued" });
    expect(log[0].payload).toMatchObject({ campaignId: campaign.id, taskCount: 2 });
  });

  it("queues nothing when the campaign isn't funded", async () => {
    await contributor(1);
    const admin = await createAdminUser({ email: `admin${++admins}@example.com` });
    const campaign = await createCampaign({ adminUserId: admin.id, rewardUnits: REWARD });
    await upload(campaign.id, admin.id, "prompt,responseA,responseB\nq1,a,b\n");
    expect(await rows("funded_work")).toHaveLength(0);
  });
});
