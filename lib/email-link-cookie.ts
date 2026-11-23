import { NextRequest, NextResponse } from "next/server";

// #248: a token from an emailed link rides in a short-lived httpOnly cookie,
// scoped to /api/email, instead of the page URL. See verifyLink() in
// lib/contact-email-send.ts.

export type EmailLinkPurpose = "verify" | "unsubscribe";

const COOKIE: Record<EmailLinkPurpose, string> = { verify: "ce_verify", unsubscribe: "ce_unsub" };
const MAX_AGE_SECONDS = 15 * 60;

/** GET handler body: stash `?t=` in the cookie and redirect to the clean page. */
export function stashAndRedirect(req: NextRequest, purpose: EmailLinkPurpose): NextResponse {
  const token = req.nextUrl.searchParams.get("t");
  const res = NextResponse.redirect(new URL(`/email/${purpose}`, req.url), 303);
  if (token && token.length <= 200) {
    res.cookies.set(COOKIE[purpose], token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/email",
      maxAge: MAX_AGE_SECONDS,
    });
  }
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}

export function readLinkToken(req: NextRequest, purpose: EmailLinkPurpose): string | null {
  return req.cookies.get(COOKIE[purpose])?.value ?? null;
}

export function clearLinkToken(res: NextResponse, purpose: EmailLinkPurpose): NextResponse {
  res.cookies.set(COOKIE[purpose], "", { httpOnly: true, path: "/api/email", maxAge: 0 });
  return res;
}
