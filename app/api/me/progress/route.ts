import { NextRequest, NextResponse } from "next/server";
import { getLabelerSession } from "@/lib/labeler-auth";
import { readProgress } from "@/lib/gamification/ledger";

// #201: the labeler's XP, today's goal, the Manila week and the effective
// streak. Kept apart from /api/me, which stays the profile.
export async function GET(req: NextRequest) {
  const userId = await getLabelerSession(req);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const progress = await readProgress(userId);
  if (!progress) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(progress);
}
