import { randomUUID } from "node:crypto";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/task/route";
import { signLabelerJWT } from "@/lib/labeler-auth";
import { prisma, truncateAll } from "@/tests/helpers/db";
import { createAdminUser, createCampaign, createGoldTask, createTask as makeTask, createUser, VALID_REASON } from "@/tests/helpers/factories";

// #261: /api/task?taskId=… or ?campaignId=… prefers that work when it's open
// to this labeler, and falls back to the usual pick otherwise.

beforeEach(async () => {
  await truncateAll();
  vi.restoreAllMocks();
});

async function getTask(userId: string, query = "") {
  const token = await signLabelerJWT(userId);
  const res = await GET(new NextRequest(`http://localhost/api/task${query}`, { headers: { cookie: `labeler_session=${token}` } }));
  expect(res.status).toBe(200);
  return (await res.json()).task as { id: string } | null;
}

// Real ids are Prisma UUIDs; the links only carry those, so the fixtures do too.
let admins = 0;
let t0 = Date.parse("2026-11-01T00:00:00Z");
async function campaign() {
  const admin = await createAdminUser({ email: `dl-admin${++admins}@example.com` });
  return createCampaign({ id: randomUUID(), adminUserId: admin.id, defaultResponseTarget: 5 });
}
function createTask(o: { campaignId: string; prompt: string }) {
  return makeTask({ ...o, id: randomUUID(), createdAt: new Date((t0 += 60_000)) });
}

describe("GET /api/task with a deep-link preference", () => {
  it("serves the linked task instead of the oldest one", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const c = await campaign();
    await createTask({ campaignId: c.id, prompt: "older" });
    const linked = await createTask({ campaignId: c.id, prompt: "linked" });
    const user = await createUser();

    expect((await getTask(user.id))!.id).not.toBe(linked.id);
    expect((await getTask(user.id, `?taskId=${linked.id}`))!.id).toBe(linked.id);
  });

  it("serves work from the linked campaign before older work elsewhere", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const other = await campaign();
    await createTask({ campaignId: other.id, prompt: "elsewhere" });
    const funded = await campaign();
    const fresh = await createTask({ campaignId: funded.id, prompt: "fresh" });
    const user = await createUser();

    expect((await getTask(user.id, `?campaignId=${funded.id}`))!.id).toBe(fresh.id);
  });

  it("falls back to the usual pick when the linked task is already answered", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const c = await campaign();
    const linked = await createTask({ campaignId: c.id, prompt: "linked" });
    const next = await createTask({ campaignId: c.id, prompt: "next" });
    const user = await createUser();
    await prisma.submission.create({
      data: { userId: user.id, taskId: linked.id, choice: "A", reason: VALID_REASON, payoutAmountUnits: 0n },
    });

    expect((await getTask(user.id, `?taskId=${linked.id}`))!.id).toBe(next.id);
  });

  it("doesn't swap a link for a quality check, but a labeler in retest still gets theirs", async () => {
    // Math.random 0 would always pick a gold check without a preference.
    vi.spyOn(Math, "random").mockReturnValue(0);
    const gold = await createGoldTask();
    const c = await campaign();
    const linked = await createTask({ campaignId: c.id, prompt: "linked" });
    const user = await createUser();
    expect((await getTask(user.id, `?taskId=${linked.id}`))!.id).toBe(linked.id);
    expect((await getTask(user.id))!.id).toBe(gold.id);
  });

  it.each(["?taskId=not-a-uuid", "?taskId=1'; DROP TABLE tasks;--", "?campaignId=xyz"])("ignores a malformed %s", async (q) => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const c = await campaign();
    const only = await createTask({ campaignId: c.id, prompt: "only" });
    const user = await createUser();
    expect((await getTask(user.id, q))!.id).toBe(only.id);
  });
});
