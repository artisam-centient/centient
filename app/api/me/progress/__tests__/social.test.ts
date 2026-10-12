// #203 — GET /api/me/progress: each event code's own stamp beside the twelve,
// and where the labeler stands on this week's board.
import { vi, describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/gamification/server-analytics", () => ({ captureStanding: vi.fn(), captureServer: vi.fn() }));

import { GET } from "@/app/api/me/progress/route";
import { signLabelerJWT } from "@/lib/labeler-auth";
import { createEventCode, redeemEventCode } from "@/lib/gamification/redeem";
import { addDays, manilaDayKey, manilaWeekKey } from "@/lib/gamification/time";
import { prisma, truncateAll } from "@/tests/helpers/db";
import { createAdminUser, createUser } from "@/tests/helpers/factories";

beforeEach(async () => {
  await truncateAll();
});

async function getAs(userId: string) {
  const res = await GET(
    new NextRequest("http://localhost/api/me/progress", {
      headers: { cookie: `labeler_session=${await signLabelerJWT(userId)}` },
    }),
  );
  expect(res.status).toBe(200);
  return res.json();
}

describe("GET /api/me/progress - event stamps (#203)", () => {
  it("lists the twelve, then each event stamp held, with its own title and icon", async () => {
    const userId = (await createUser()).id;
    const admin = await createAdminUser();
    const today = manilaDayKey();
    await createEventCode(admin.id, {
      code: "WEBINAR1",
      stampTitle: "Contributor webinar",
      stampIcon: "podcasts",
      startsDay: today,
      endsDay: addDays(today, 1),
    });
    const redeemed = await redeemEventCode(userId, "WEBINAR1");
    if (!redeemed?.ok) throw new Error("setup");

    const { stamps } = await getAs(userId);
    expect(stamps).toHaveLength(13);
    expect(stamps.find((s: { id: string }) => s.id === "event")).toEqual({ id: "event", awardedAt: null, progress: null });
    expect(stamps[12]).toEqual({
      id: redeemed.stamp.id,
      awardedAt: expect.any(String),
      progress: null,
      event: { title: "Contributor webinar", icon: "podcasts" },
    });
  });
});

describe("GET /api/me/progress - board (#203)", () => {
  it("says where the labeler stands this week and their best finish", async () => {
    const [a, b] = [(await createUser()).id, (await createUser()).id];
    let seq = 0;
    for (const [id, amount] of [[a, 300], [b, 120]] as const) {
      await prisma.xpEvent.create({
        data: { userId: id, kind: "ANSWER", amount, dedupeKey: `t:${++seq}`, dayKey: manilaDayKey(), weekKey: manilaWeekKey() },
      });
    }
    await prisma.weeklyResult.create({ data: { weekKey: "2026-09-28", userId: b, rank: 6, xp: 80 } });

    expect((await getAs(b)).board).toEqual({ rank: 2, xp: 120, placed: true, bestRank: 6 });
    expect((await getAs(a)).board).toEqual({ rank: 1, xp: 300, placed: true, bestRank: null });
  });
});
