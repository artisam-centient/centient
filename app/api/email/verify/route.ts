import { NextRequest, NextResponse } from "next/server";
import { verifyContactEmail } from "@/lib/contact-email";
import { clearLinkToken, readLinkToken, stashAndRedirect } from "@/lib/email-link-cookie";

// #248: the verification link. Works signed out (the token is the capability).
//   GET  ?t=<token>  from the email: stash the token, redirect to /email/verify
//   POST             from that page: spend the token

export function GET(req: NextRequest) {
  return stashAndRedirect(req, "verify");
}

export async function POST(req: NextRequest) {
  const token = readLinkToken(req, "verify");
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 });

  const result = await verifyContactEmail(token);
  const res = result.ok
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: result.error }, { status: 400 });
  // Spent or dead either way: a retry needs a fresh link.
  return clearLinkToken(res, "verify");
}
