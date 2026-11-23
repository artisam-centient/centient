import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const send = vi.hoisted(() => vi.fn());
vi.mock("@/lib/resend", () => ({ resendClient: { emails: { send } } }));
const sentry = vi.hoisted(() => ({ captureMessage: vi.fn(), captureException: vi.fn() }));
vi.mock("@sentry/nextjs", () => sentry);

import { DELETE, GET, PATCH, PUT } from "@/app/api/me/email/route";
import { POST as verifyPost, GET as verifyGet } from "@/app/api/email/verify/route";
import { POST as unsubPost, GET as unsubGet } from "@/app/api/email/unsubscribe/route";
import { signLabelerJWT } from "@/lib/labeler-auth";
import { prisma, truncateAll } from "@/tests/helpers/db";
import { createUser } from "@/tests/helpers/factories";

// #248 routes: /api/me/email (signed in), /api/email/verify and
// /api/email/unsubscribe (signed out; the token is the capability).

const ADDRESS = "ana.labeler@example.com";

function meReq(method: string, token?: string, body?: unknown): NextRequest {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.cookie = `labeler_session=${token}`;
  return new NextRequest("http://localhost/api/me/email", {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** The token in the verification email's link, as the mailbox would see it. */
function linkToken(kind: "verify" | "unsubscribe"): string {
  const html: string = send.mock.calls.at(-1)![0].html;
  const match = html.match(new RegExp(`/api/email/${kind}\\?t=([A-Za-z0-9_-]+)`));
  return decodeURIComponent(match![1]);
}

/** Open the verification link and confirm, as the contributor would. */
async function confirm() {
  const token = linkToken("verify");
  const res = await verifyPost(
    new NextRequest("http://localhost/api/email/verify", { method: "POST", headers: { cookie: `ce_verify=${token}` } }),
  );
  expect(res.status).toBe(200);
}

async function signedIn() {
  const user = await createUser();
  return { user, session: await signLabelerJWT(user.id) };
}

beforeEach(async () => {
  await truncateAll();
  await prisma.$executeRawUnsafe("DELETE FROM rate_limit_buckets").catch(() => {});
  send.mockReset();
  send.mockResolvedValue({ data: { id: "email_1" }, error: null });
  sentry.captureMessage.mockReset();
});

describe("/api/me/email", () => {
  it("answers 401 to every method without a session", async () => {
    for (const handler of [GET, PUT, PATCH, DELETE]) {
      expect((await handler(meReq("GET"))).status).toBe(401);
    }
  });

  it("GET starts with no address and every notice off", async () => {
    const { session } = await signedIn();
    const res = await GET(meReq("GET", session));
    expect(await res.json()).toEqual({
      address: null,
      pendingAddress: null,
      notifyNewWork: false,
      notifyReminders: false,
      promptDismissed: false,
    });
  });

  it("PUT sends a verification link with one-click unsubscribe headers", async () => {
    const { session } = await signedIn();
    const res = await PUT(meReq("PUT", session, { address: " Ana.Labeler@Example.com " }));
    expect(res.status).toBe(202);
    expect(await res.json()).toMatchObject({ address: null, pendingAddress: ADDRESS });

    expect(send).toHaveBeenCalledTimes(1);
    const mail = send.mock.calls[0][0];
    expect(mail.to).toBe(ADDRESS);
    expect(mail.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(mail.headers["List-Unsubscribe"]).toMatch(/^<http:\/\/localhost:3000\/api\/email\/unsubscribe\?t=[A-Za-z0-9_-]+>$/);
    // The address is never part of a link.
    expect(mail.html).not.toContain(encodeURIComponent(ADDRESS));
    expect(mail.html).not.toContain(ADDRESS);
  });

  it("PUT refuses an invalid address without spending the rate limit", async () => {
    const { session } = await signedIn();
    for (let i = 0; i < 5; i++) {
      expect((await PUT(meReq("PUT", session, { address: "nope" }))).status).toBe(400);
    }
    expect((await PUT(meReq("PUT", session, { address: ADDRESS }))).status).toBe(202);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("PUT allows three sends an hour", async () => {
    const { session } = await signedIn();
    for (let i = 0; i < 3; i++) {
      expect((await PUT(meReq("PUT", session, { address: `a${i}@example.com` }))).status).toBe(202);
    }
    const res = await PUT(meReq("PUT", session, { address: "a4@example.com" }));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toMatch(/^\d+$/);
    expect(send).toHaveBeenCalledTimes(3);
  });

  it("PUT reports a failed send without logging or reporting the address", async () => {
    const { session } = await signedIn();
    send.mockResolvedValue({ data: null, error: { name: "validation_error", message: `Invalid to: ${ADDRESS}` } });
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await PUT(meReq("PUT", session, { address: ADDRESS }));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("send_failed");

    const logged = JSON.stringify([errors.mock.calls, sentry.captureMessage.mock.calls]);
    expect(logged).toContain("validation_error");
    expect(logged).not.toContain(ADDRESS);
    errors.mockRestore();
  });

  it("PATCH saves preferences and DELETE forgets the address", async () => {
    const { session } = await signedIn();
    const patched = await PATCH(meReq("PATCH", session, { notifyNewWork: true, promptDismissed: true }));
    expect(await patched.json()).toMatchObject({ notifyNewWork: true, notifyReminders: false, promptDismissed: true });
    expect((await PATCH(meReq("PATCH", session, { notifyNewWork: "on" }))).status).toBe(400);

    await PUT(meReq("PUT", session, { address: ADDRESS }));
    const deleted = await DELETE(meReq("DELETE", session));
    expect(await deleted.json()).toMatchObject({ address: null, pendingAddress: null, notifyNewWork: false });
  });
});

describe("the emailed links", () => {
  it("verify: GET moves the token into a cookie and redirects to a clean page; POST spends it once", async () => {
    const { session } = await signedIn();
    await PUT(meReq("PUT", session, { address: ADDRESS }));
    const token = linkToken("verify");

    const opened = verifyGet(new NextRequest(`http://localhost/api/email/verify?t=${token}`));
    expect(opened.status).toBe(303);
    expect(opened.headers.get("location")).toBe("http://localhost/email/verify");
    const cookie = opened.cookies.get("ce_verify")!;
    expect(cookie.value).toBe(token);
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.path).toBe("/api/email");

    const post = () =>
      verifyPost(new NextRequest("http://localhost/api/email/verify", { method: "POST", headers: { cookie: `ce_verify=${token}` } }));
    const first = await post();
    expect(first.status).toBe(200);
    expect(first.cookies.get("ce_verify")?.value).toBe("");
    expect((await GET(meReq("GET", session))).status).toBe(200);
    expect(await (await GET(meReq("GET", session))).json()).toMatchObject({ address: ADDRESS, pendingAddress: null });

    const reused = await post();
    expect(reused.status).toBe(400);
    expect((await reused.json()).error).toBe("invalid_token");
  });

  it("verify: POST without the cookie is refused", async () => {
    const res = await verifyPost(new NextRequest("http://localhost/api/email/verify", { method: "POST" }));
    expect(res.status).toBe(400);
  });

  it("unsubscribe: one-click POST from the mail client works signed out and twice", async () => {
    const { session } = await signedIn();
    await PATCH(meReq("PATCH", session, { notifyNewWork: true, notifyReminders: true }));
    await PUT(meReq("PUT", session, { address: ADDRESS }));
    await confirm();
    const header: string = send.mock.calls[0][0].headers["List-Unsubscribe"];
    const url = header.slice(1, -1).replace("http://localhost:3000", "http://localhost");

    for (let i = 0; i < 2; i++) {
      const res = await unsubPost(
        new NextRequest(url, { method: "POST", body: "List-Unsubscribe=One-Click", headers: { "content-type": "application/x-www-form-urlencoded" } }),
      );
      expect(res.status).toBe(200);
    }
    expect(await (await GET(meReq("GET", session))).json()).toMatchObject({ notifyNewWork: false, notifyReminders: false });
  });

  it("unsubscribe: the body link goes through the cookie and a button", async () => {
    const { session } = await signedIn();
    await PATCH(meReq("PATCH", session, { notifyReminders: true }));
    await PUT(meReq("PUT", session, { address: ADDRESS }));
    const token = linkToken("unsubscribe");
    await confirm();

    const opened = unsubGet(new NextRequest(`http://localhost/api/email/unsubscribe?t=${token}`));
    expect(opened.headers.get("location")).toBe("http://localhost/email/unsubscribe");
    expect(opened.cookies.get("ce_unsub")?.value).toBe(token);

    const res = await unsubPost(
      new NextRequest("http://localhost/api/email/unsubscribe", { method: "POST", headers: { cookie: `ce_unsub=${token}` } }),
    );
    expect(res.status).toBe(200);
    expect(await (await GET(meReq("GET", session))).json()).toMatchObject({ notifyReminders: false });
  });

  it("unsubscribe: before verifying, the link drops the pending address", async () => {
    const { session } = await signedIn();
    await PUT(meReq("PUT", session, { address: ADDRESS }));
    const token = linkToken("unsubscribe");
    const res = await unsubPost(new NextRequest(`http://localhost/api/email/unsubscribe?t=${token}`, { method: "POST" }));
    expect(res.status).toBe(200);
    expect(await (await GET(meReq("GET", session))).json()).toMatchObject({ address: null, pendingAddress: null });
  });

  it("unsubscribe: an unknown token is 404 and a missing one 400", async () => {
    const unknown = await unsubPost(new NextRequest("http://localhost/api/email/unsubscribe?t=nope", { method: "POST" }));
    expect(unknown.status).toBe(404);
    const missing = await unsubPost(new NextRequest("http://localhost/api/email/unsubscribe", { method: "POST" }));
    expect(missing.status).toBe(400);
  });
});
