import { NextRequest, NextResponse } from "next/server";
import { authenticateCron } from "@/lib/cron-auth";
import { closeWeek } from "@/lib/gamification/leaderboard";
import { addDays, manilaWeekKey } from "@/lib/gamification/time";

export const dynamic = "force-dynamic";

// #203: close last week's board (results and Top 3 stamps). The first board
// read of a new week does this already; this is the backstop for a quiet
// Monday. Safe to call any time: a week closes once.
export async function POST(req: NextRequest) {
  const authErr = authenticateCron(req);
  if (authErr) return authErr;

  const weekKey = addDays(manilaWeekKey(), -7);
  const { closed, stamped } = await closeWeek(weekKey);
  return NextResponse.json({ weekKey, closed, stamped: stamped.length });
}
