import { NextRequest, NextResponse } from "next/server";
import { unsubscribe } from "@/lib/contact-email";
import { clearLinkToken, readLinkToken, stashAndRedirect } from "@/lib/email-link-cookie";

// #248: one-click unsubscribe. Signed out, idempotent, every notice off.
//   GET  ?t=<token>  the link in the email body: stash, redirect to /email/unsubscribe
//   POST ?t=<token>  RFC 8058 one-click from the mail client (List-Unsubscribe-Post)
//   POST             the button on /email/unsubscribe, token from the cookie

export function GET(req: NextRequest) {
  return stashAndRedirect(req, "unsubscribe");
}

export async function POST(req: NextRequest) {
  const fromQuery = req.nextUrl.searchParams.get("t");
  const token = fromQuery ?? readLinkToken(req, "unsubscribe");
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 });

  const ok = await unsubscribe(token);
  const res = ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "invalid_token" }, { status: 404 });
  return fromQuery ? res : clearLinkToken(res, "unsubscribe");
}
