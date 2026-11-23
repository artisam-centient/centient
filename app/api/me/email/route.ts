import { NextRequest, NextResponse } from "next/server";
import { getLabelerSession } from "@/lib/labeler-auth";
import {
  getContactSettings,
  normalizeAddress,
  parsePreferenceUpdate,
  removeContactEmail,
  requestVerification,
  updatePreferences,
  VERIFY_SEND_LIMIT,
} from "@/lib/contact-email";
import { sendContactEmail, verificationMessage } from "@/lib/contact-email-send";
import { takeRateLimit } from "@/lib/rate-limit";
import { finishSend, reserveVerification } from "@/lib/email-queue";

// #248: the signed-in contributor's notice email and preferences.
//   GET     current settings
//   PUT     { address }  add or change the address; sends a verification link
//   PATCH   { notifyNewWork?, notifyReminders?, promptDismissed?: true }
//   DELETE  forget the address

const unauthorized = () => NextResponse.json({ error: "unauthorized" }, { status: 401 });

export async function GET(req: NextRequest) {
  const userId = await getLabelerSession(req);
  if (!userId) return unauthorized();
  return NextResponse.json(await getContactSettings(userId));
}

export async function PUT(req: NextRequest) {
  const userId = await getLabelerSession(req);
  if (!userId) return unauthorized();

  const body = await req.json().catch(() => null);
  const input = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>).address : undefined;

  // A malformed address costs no send, so it doesn't spend the rate limit.
  if (!normalizeAddress(input)) return NextResponse.json({ error: "invalid_email" }, { status: 400 });

  const limit = await takeRateLimit(`contact-email:${userId}`, VERIFY_SEND_LIMIT);
  if (limit.limited) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterSeconds: limit.retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  // #260: reserve today's slot before anything else. Verification has the whole
  // daily limit (notices stop at the reserve), so this only refuses once
  // Resend's free tier is spent for the day.
  const slot = await reserveVerification(userId);
  if (!slot) return NextResponse.json({ error: "daily_limit" }, { status: 503 });

  const result = await requestVerification(userId, input);
  if (!result.ok) {
    await finishSend(slot, "not_sent");
    return result.error === "already_verified"
      ? NextResponse.json({ error: result.error, settings: result.settings }, { status: 409 })
      : NextResponse.json({ error: result.error }, { status: 400 });
  }

  const sent = await sendContactEmail(
    result.address,
    verificationMessage(result.token, result.unsubscribeToken),
    result.unsubscribeToken,
  );
  await finishSend(slot, sent === "skipped" ? "not_sent" : sent);
  if (sent === "refused" || sent === "unknown") {
    return NextResponse.json({ error: "send_failed", settings: result.settings }, { status: 502 });
  }
  return NextResponse.json(result.settings, { status: 202 });
}

export async function PATCH(req: NextRequest) {
  const userId = await getLabelerSession(req);
  if (!userId) return unauthorized();

  const update = parsePreferenceUpdate(await req.json().catch(() => null));
  if (!update) return NextResponse.json({ error: "invalid" }, { status: 400 });
  return NextResponse.json(await updatePreferences(userId, update));
}

export async function DELETE(req: NextRequest) {
  const userId = await getLabelerSession(req);
  if (!userId) return unauthorized();
  return NextResponse.json(await removeContactEmail(userId));
}
