import { NextRequest, NextResponse } from "next/server";
import { getLabelerSession } from "@/lib/labeler-auth";
import { readProgress } from "@/lib/gamification/ledger";
import { readStanding } from "@/lib/gamification/standing";

// #201: the labeler's XP, today's goal, the Manila week and the effective
// streak. Kept apart from /api/me, which stays the profile. #202 adds the
// tier card and the stamps.
export async function GET(req: NextRequest) {
  const userId = await getLabelerSession(req);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [progress, standing] = await Promise.all([readProgress(userId), readStanding(userId)]);
  if (!progress || !standing) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ...progress, ...standing });
}
