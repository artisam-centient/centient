import { describe, it, expect, beforeEach } from "vitest";
import {
  getContactSettings,
  hashToken,
  isNotifiable,
  normalizeAddress,
  parsePreferenceUpdate,
  removeContactEmail,
  requestVerification,
  unsubscribe,
  updatePreferences,
  verifyContactEmail,
  VERIFY_TTL_MS,
} from "@/lib/contact-email";
import { prisma, truncateAll } from "@/tests/helpers/db";
import { createUser } from "@/tests/helpers/factories";

// #248: opt-in, verification, preferences and unsubscribe for notice emails.

const T0 = new Date("2026-11-23T00:00:00Z");

async function rowFor(userId: string) {
  return prisma.contactEmail.findUniqueOrThrow({ where: { userId } });
}

async function verified(userId: string, address = "ana@example.com") {
  const req = await requestVerification(userId, address, T0);
  if (!req.ok) throw new Error(req.error);
  expect(await verifyContactEmail(req.token, T0)).toEqual({ ok: true });
  return req;
}

beforeEach(async () => {
  await truncateAll();
});

describe("normalizeAddress", () => {
  it("trims and lower-cases a plausible address", () => {
    expect(normalizeAddress("  Ana@Example.COM ")).toBe("ana@example.com");
  });

  it.each([undefined, 42, "", "ana", "ana@", "@example.com", "ana@example", "a b@example.com", "<ana@example.com>"])(
    "rejects %s",
    (input) => {
      expect(normalizeAddress(input)).toBeNull();
    },
  );

  it("rejects an address over 254 characters", () => {
    expect(normalizeAddress(`${"a".repeat(250)}@example.com`)).toBeNull();
  });
});

describe("requestVerification", () => {
  it("stores the address as pending, with only a hash of the token", async () => {
    const user = await createUser();
    const req = await requestVerification(user.id, "Ana@Example.com", T0);
    expect(req.ok).toBe(true);
    if (!req.ok) return;

    const row = await rowFor(user.id);
    expect(row.pendingAddress).toBe("ana@example.com");
    expect(row.address).toBeNull();
    expect(row.verifyTokenHash).toBe(hashToken(req.token));
    expect(row.verifyTokenHash).not.toBe(req.token);
    expect(row.verifyTokenExpires?.getTime()).toBe(T0.getTime() + VERIFY_TTL_MS);
    expect(req.settings).toMatchObject({ address: null, pendingAddress: "ana@example.com" });
  });

  it("refuses an invalid address without creating a row", async () => {
    const user = await createUser();
    expect(await requestVerification(user.id, "not-an-email", T0)).toEqual({ ok: false, error: "invalid_email" });
    expect(await prisma.contactEmail.count()).toBe(0);
  });

  it("refuses the address that is already verified", async () => {
    const user = await createUser();
    await verified(user.id);
    expect(await requestVerification(user.id, "ANA@example.com", T0)).toEqual({ ok: false, error: "already_verified" });
  });

  it("a second request replaces the first token", async () => {
    const user = await createUser();
    const first = await requestVerification(user.id, "ana@example.com", T0);
    const second = await requestVerification(user.id, "ana2@example.com", T0);
    if (!first.ok || !second.ok) throw new Error("expected ok");

    expect(await verifyContactEmail(first.token, T0)).toEqual({ ok: false, error: "invalid_token" });
    expect(await verifyContactEmail(second.token, T0)).toEqual({ ok: true });
    expect((await getContactSettings(user.id)).address).toBe("ana2@example.com");
  });
});

describe("verifyContactEmail: expiry and reuse", () => {
  it("verifies within 24 hours", async () => {
    const user = await createUser();
    const req = await requestVerification(user.id, "ana@example.com", T0);
    if (!req.ok) throw new Error(req.error);

    const justBefore = new Date(T0.getTime() + VERIFY_TTL_MS - 1);
    expect(await verifyContactEmail(req.token, justBefore)).toEqual({ ok: true });
    const row = await rowFor(user.id);
    expect(row.address).toBe("ana@example.com");
    expect(row.verifiedAt).toEqual(justBefore);
    expect(row.pendingAddress).toBeNull();
    expect(row.verifyTokenHash).toBeNull();
  });

  it("refuses an expired token and leaves the address unverified", async () => {
    const user = await createUser();
    const req = await requestVerification(user.id, "ana@example.com", T0);
    if (!req.ok) throw new Error(req.error);

    const atExpiry = new Date(T0.getTime() + VERIFY_TTL_MS);
    expect(await verifyContactEmail(req.token, atExpiry)).toEqual({ ok: false, error: "expired_token" });
    expect((await rowFor(user.id)).verifiedAt).toBeNull();
  });

  it("refuses a token the second time", async () => {
    const user = await createUser();
    const req = await requestVerification(user.id, "ana@example.com", T0);
    if (!req.ok) throw new Error(req.error);

    expect(await verifyContactEmail(req.token, T0)).toEqual({ ok: true });
    expect(await verifyContactEmail(req.token, T0)).toEqual({ ok: false, error: "invalid_token" });
  });

  it("lets only one of two concurrent uses win", async () => {
    const user = await createUser();
    const req = await requestVerification(user.id, "ana@example.com", T0);
    if (!req.ok) throw new Error(req.error);

    const results = await Promise.all([verifyContactEmail(req.token, T0), verifyContactEmail(req.token, T0)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
  });

  it.each([undefined, "", "nope", "x".repeat(201)])("refuses token %s", async (token) => {
    expect(await verifyContactEmail(token, T0)).toEqual({ ok: false, error: "invalid_token" });
  });

  it("keeps the old address working until a change is verified, then retires the old address's unsubscribe link", async () => {
    const user = await createUser();
    await verified(user.id, "old@example.com");
    const oldUnsub = (await rowFor(user.id)).unsubscribeToken;

    const change = await requestVerification(user.id, "new@example.com", T0);
    if (!change.ok) throw new Error(change.error);
    expect(change.unsubscribeToken).not.toBe(oldUnsub);
    expect(await getContactSettings(user.id)).toMatchObject({
      address: "old@example.com",
      pendingAddress: "new@example.com",
    });

    await verifyContactEmail(change.token, T0);
    const row = await rowFor(user.id);
    expect(row.address).toBe("new@example.com");
    expect(row.unsubscribeToken).toBe(change.unsubscribeToken);
    // A link from mail to the old address no longer reaches this row.
    expect(await unsubscribe(oldUnsub, T0)).toBe(false);
  });

  it("keeps the verification email's own unsubscribe link working after verifying", async () => {
    const user = await createUser();
    const req = await verified(user.id);
    await updatePreferences(user.id, { notifyNewWork: true }, T0);
    expect(await unsubscribe(req.unsubscribeToken, T0)).toBe(true);
    expect((await rowFor(user.id)).notifyNewWork).toBe(false);
  });

  it("a resend to the same pending address keeps its unsubscribe link", async () => {
    const user = await createUser();
    const first = await requestVerification(user.id, "ana@example.com", T0);
    const again = await requestVerification(user.id, "ana@example.com", T0);
    if (!first.ok || !again.ok) throw new Error("expected ok");
    expect(again.unsubscribeToken).toBe(first.unsubscribeToken);
    expect(again.token).not.toBe(first.token);
  });
});

describe("preferences", () => {
  it("are all off until the contributor opts in", async () => {
    const user = await createUser();
    expect(await getContactSettings(user.id)).toEqual({
      address: null,
      pendingAddress: null,
      notifyNewWork: false,
      notifyReminders: false,
      promptDismissed: false,
    });
    await verified(user.id);
    expect(await getContactSettings(user.id)).toMatchObject({ notifyNewWork: false, notifyReminders: false });
  });

  it("save each notice type on its own", async () => {
    const user = await createUser();
    await verified(user.id);
    await updatePreferences(user.id, { notifyNewWork: true }, T0);
    expect(await getContactSettings(user.id)).toMatchObject({ notifyNewWork: true, notifyReminders: false });
    await updatePreferences(user.id, { notifyReminders: true, notifyNewWork: false }, T0);
    expect(await getContactSettings(user.id)).toMatchObject({ notifyNewWork: false, notifyReminders: true });
  });

  it("remember a dismissed prompt", async () => {
    const user = await createUser();
    expect((await updatePreferences(user.id, { promptDismissed: true }, T0)).promptDismissed).toBe(true);
    expect((await getContactSettings(user.id)).promptDismissed).toBe(true);
  });

  it("parsePreferenceUpdate accepts booleans and promptDismissed: true only", () => {
    expect(parsePreferenceUpdate({ notifyNewWork: true })).toEqual({ notifyNewWork: true });
    expect(parsePreferenceUpdate({ promptDismissed: true, notifyReminders: false })).toEqual({
      promptDismissed: true,
      notifyReminders: false,
    });
    for (const bad of [null, [], {}, { notifyNewWork: "yes" }, { promptDismissed: false }, { other: true }]) {
      expect(parsePreferenceUpdate(bad)).toBeNull();
    }
  });
});

describe("isNotifiable: unverified addresses never get notices", () => {
  it("is false for a pending address even with the notice on", async () => {
    const user = await createUser();
    await requestVerification(user.id, "ana@example.com", T0);
    await updatePreferences(user.id, { notifyNewWork: true, notifyReminders: true }, T0);
    const row = await rowFor(user.id);
    expect(isNotifiable(row, "newWork")).toBe(false);
    expect(isNotifiable(row, "reminders")).toBe(false);
  });

  it("follows each preference once verified", async () => {
    const user = await createUser();
    await verified(user.id);
    await updatePreferences(user.id, { notifyNewWork: true }, T0);
    const row = await rowFor(user.id);
    expect(isNotifiable(row, "newWork")).toBe(true);
    expect(isNotifiable(row, "reminders")).toBe(false);
    expect(isNotifiable(null, "newWork")).toBe(false);
  });
});

describe("unsubscribe", () => {
  it("turns every notice off, needs no session, and is idempotent", async () => {
    const user = await createUser();
    await verified(user.id);
    await updatePreferences(user.id, { notifyNewWork: true, notifyReminders: true }, T0);
    const token = (await rowFor(user.id)).unsubscribeToken;

    expect(await unsubscribe(token, T0)).toBe(true);
    const later = new Date(T0.getTime() + 60_000);
    expect(await unsubscribe(token, later)).toBe(true);

    const row = await rowFor(user.id);
    expect(row.notifyNewWork).toBe(false);
    expect(row.notifyReminders).toBe(false);
    expect(row.unsubscribedAt).toEqual(T0);
    expect(isNotifiable(row, "newWork")).toBe(false);
  });

  it("with a pending address's link, drops that address so it gets no more mail", async () => {
    const user = await createUser();
    const req = await requestVerification(user.id, "someone-else@example.com", T0);
    if (!req.ok) throw new Error(req.error);

    expect(await unsubscribe(req.unsubscribeToken, T0)).toBe(true);
    expect(await unsubscribe(req.unsubscribeToken, T0)).toBe(true);
    expect((await getContactSettings(user.id)).pendingAddress).toBeNull();
    // Its verification link is dead too.
    expect(await verifyContactEmail(req.token, T0)).toEqual({ ok: false, error: "invalid_token" });
  });

  it("with a pending address's link, leaves the verified address alone", async () => {
    const user = await createUser();
    await verified(user.id, "ana@example.com");
    await updatePreferences(user.id, { notifyReminders: true }, T0);
    const change = await requestVerification(user.id, "typo@example.com", T0);
    if (!change.ok) throw new Error(change.error);

    expect(await unsubscribe(change.unsubscribeToken, T0)).toBe(true);
    const row = await rowFor(user.id);
    expect(row.address).toBe("ana@example.com");
    expect(isNotifiable(row, "reminders")).toBe(true);
  });

  it("returns false for an unknown token", async () => {
    expect(await unsubscribe("nope", T0)).toBe(false);
    expect(await unsubscribe(undefined, T0)).toBe(false);
  });

  it("is lifted when the contributor turns a notice back on", async () => {
    const user = await createUser();
    await verified(user.id);
    await unsubscribe((await rowFor(user.id)).unsubscribeToken, T0);
    await updatePreferences(user.id, { notifyReminders: true }, T0);
    expect(isNotifiable(await rowFor(user.id), "reminders")).toBe(true);
  });
});

describe("removeContactEmail", () => {
  it("forgets verified and pending addresses and resets preferences", async () => {
    const user = await createUser();
    await verified(user.id);
    await updatePreferences(user.id, { notifyNewWork: true }, T0);
    await requestVerification(user.id, "next@example.com", T0);

    const settings = await removeContactEmail(user.id);
    expect(settings).toMatchObject({ address: null, pendingAddress: null, notifyNewWork: false });
    const row = await rowFor(user.id);
    expect(row.address).toBeNull();
    expect(row.verifyTokenHash).toBeNull();
  });

  it("is a no-op without a row", async () => {
    const user = await createUser();
    expect((await removeContactEmail(user.id)).address).toBeNull();
  });
});
