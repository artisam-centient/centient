import { NextRequest, NextResponse } from "next/server";
import { authenticateCron } from "@/lib/cron-auth";
import { drainQueue, enqueueReminders } from "@/lib/email-queue";

export const dynamic = "force-dynamic";

// #260 (ADR-0013): queue due unfinished-task reminders, then send due notices
// within quiet hours and today's budget. Safe to call any time: enqueueing is
// idempotent and each row is claimed before it is sent.
export async function POST(req: NextRequest) {
  const authErr = authenticateCron(req);
  if (authErr) return authErr;

  const remindersQueued = await enqueueReminders();
  const report = await drainQueue();
  return NextResponse.json({ remindersQueued, ...report });
}
