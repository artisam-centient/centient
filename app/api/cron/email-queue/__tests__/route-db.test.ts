import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/cron/email-queue/route";
import { truncateAll } from "@/tests/helpers/db";

// #260: the cron that drains the email queue.

function req(auth?: string) {
  return new NextRequest("http://localhost/api/cron/email-queue", {
    method: "POST",
    headers: auth ? { Authorization: auth } : {},
  });
}

beforeEach(async () => {
  await truncateAll();
  vi.stubEnv("CRON_SECRET", "cron-secret-for-tests");
});
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/cron/email-queue", () => {
  it("refuses a call without the cron secret", async () => {
    expect((await POST(req())).status).toBe(401);
    expect((await POST(req("Bearer wrong"))).status).toBe(401);
  });

  it("runs the reminders pass and the drain, and reports both", async () => {
    const res = await POST(req("Bearer cron-secret-for-tests"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ remindersQueued: 0, sent: 0, failed: 0 });
    expect(body).toHaveProperty("budget");
  });
});
