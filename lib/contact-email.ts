import { createHash, randomBytes } from "node:crypto";
import prisma from "./prisma";

// Contributor email notices (#248, D3): an optional, verified address with
// per-type opt-ins and one-click unsubscribe. Separate from User.email, the
// legacy email/password login.
//
// The address never leaves the server except in the contributor's own settings
// response. Never put it in analytics, logs, Sentry extras or a URL (#165).

/** A verification link works for 24 hours, once. */
export const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;

/** Verification sends per contributor per hour: a typo or two, not a mail cannon. */
export const VERIFY_SEND_LIMIT = { max: 3, windowMs: 60 * 60 * 1000 };

/** Notice types a contributor can opt into. All are off by default. */
export type NoticeKind = "newWork" | "reminders";

export interface ContactSettings {
  /** The verified address notices go to, or null. */
  address: string | null;
  /** An address waiting on its verification link, or null. */
  pendingAddress: string | null;
  notifyNewWork: boolean;
  notifyReminders: boolean;
  promptDismissed: boolean;
}

const EMPTY_SETTINGS: ContactSettings = {
  address: null,
  pendingAddress: null,
  notifyNewWork: false,
  notifyReminders: false,
  promptDismissed: false,
};

// Deliberately loose: the verification link is the real check.
const EMAIL_SHAPE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/;

/** Trimmed, lower-cased address, or null when it isn't one. */
export function normalizeAddress(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const address = input.trim().toLowerCase();
  if (address.length === 0 || address.length > 254) return null;
  return EMAIL_SHAPE.test(address) ? address : null;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function newToken(): string {
  return randomBytes(32).toString("base64url");
}

type ContactRow = {
  address: string | null;
  verifiedAt: Date | null;
  pendingAddress: string | null;
  notifyNewWork: boolean;
  notifyReminders: boolean;
  unsubscribedAt: Date | null;
  promptDismissedAt: Date | null;
};

function toSettings(row: ContactRow | null): ContactSettings {
  if (!row) return { ...EMPTY_SETTINGS };
  return {
    address: row.verifiedAt ? row.address : null,
    pendingAddress: row.pendingAddress,
    notifyNewWork: row.notifyNewWork,
    notifyReminders: row.notifyReminders,
    promptDismissed: row.promptDismissedAt !== null,
  };
}

/**
 * Whether a notice of `kind` may go to this row: a verified address, that
 * notice type turned on, and no unsubscribe since. Unverified addresses never
 * get notices.
 */
export function isNotifiable(row: ContactRow | null, kind: NoticeKind): boolean {
  if (!row || !row.address || !row.verifiedAt || row.unsubscribedAt) return false;
  return kind === "newWork" ? row.notifyNewWork : row.notifyReminders;
}

export async function getContactSettings(userId: string): Promise<ContactSettings> {
  return toSettings(await prisma.contactEmail.findUnique({ where: { userId } }));
}

export type RequestVerificationResult =
  | { ok: true; address: string; token: string; unsubscribeToken: string; settings: ContactSettings }
  | { ok: false; error: "invalid_email" }
  | { ok: false; error: "already_verified"; settings: ContactSettings };

/**
 * Add or change the address: it becomes pending, and a fresh single-use token
 * (24 h) replaces any earlier one. The current verified address, if any, keeps
 * getting notices until the new one is verified.
 */
export async function requestVerification(
  userId: string,
  input: unknown,
  now: Date = new Date(),
): Promise<RequestVerificationResult> {
  const address = normalizeAddress(input);
  if (!address) return { ok: false, error: "invalid_email" };

  const existing = await prisma.contactEmail.findUnique({ where: { userId } });
  if (existing?.verifiedAt && existing.address === address) {
    // Resubmitting the verified address undoes a pending change: its link dies,
    // so it can't replace this address later.
    const row = existing.pendingAddress
      ? await prisma.contactEmail.update({
          where: { id: existing.id },
          data: { pendingAddress: null, pendingUnsubscribeToken: null, verifyTokenHash: null, verifyTokenExpires: null },
        })
      : existing;
    return { ok: false, error: "already_verified", settings: toSettings(row) };
  }

  // Resending to the same pending address keeps its unsubscribe token, so the
  // first email's link still works; a different address gets its own.
  const pendingUnsubscribeToken =
    existing?.pendingAddress === address && existing.pendingUnsubscribeToken
      ? existing.pendingUnsubscribeToken
      : newToken();
  const token = newToken();
  const data = {
    pendingAddress: address,
    pendingUnsubscribeToken,
    verifyTokenHash: hashToken(token),
    verifyTokenExpires: new Date(now.getTime() + VERIFY_TTL_MS),
  };
  const row = await prisma.contactEmail.upsert({
    where: { userId },
    create: { userId, unsubscribeToken: newToken(), ...data },
    update: data,
  });
  return { ok: true, address, token, unsubscribeToken: pendingUnsubscribeToken, settings: toSettings(row) };
}

export type VerifyResult = { ok: true } | { ok: false; error: "invalid_token" | "expired_token" };

/**
 * Spend a verification token. It works once: success clears it, so a reused
 * link is `invalid_token`. The pending address's unsubscribe token becomes the
 * verified one, so the verification email's own link keeps working and links
 * in mail to an earlier address stop reaching this row.
 */
export async function verifyContactEmail(token: unknown, now: Date = new Date()): Promise<VerifyResult> {
  if (typeof token !== "string" || token.length === 0 || token.length > 200) {
    return { ok: false, error: "invalid_token" };
  }
  const tokenHash = hashToken(token);
  const row = await prisma.contactEmail.findUnique({ where: { verifyTokenHash: tokenHash } });
  if (!row || !row.pendingAddress) return { ok: false, error: "invalid_token" };
  if (!row.verifyTokenExpires || row.verifyTokenExpires.getTime() <= now.getTime()) {
    return { ok: false, error: "expired_token" };
  }

  // Conditional on the hash still being there: of two concurrent uses, one wins.
  const { count } = await prisma.contactEmail.updateMany({
    where: { id: row.id, verifyTokenHash: tokenHash },
    data: {
      address: row.pendingAddress,
      verifiedAt: now,
      pendingAddress: null,
      verifyTokenHash: null,
      verifyTokenExpires: null,
      unsubscribeToken: row.pendingUnsubscribeToken ?? newToken(),
      pendingUnsubscribeToken: null,
      unsubscribedAt: null,
    },
  });
  return count === 1 ? { ok: true } : { ok: false, error: "invalid_token" };
}

export interface PreferenceUpdate {
  notifyNewWork?: boolean;
  notifyReminders?: boolean;
  promptDismissed?: true;
}

/** Parse a PATCH body into a preference update, or null when it's malformed. */
export function parsePreferenceUpdate(body: unknown): PreferenceUpdate | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const input = body as Record<string, unknown>;
  const update: PreferenceUpdate = {};
  for (const key of ["notifyNewWork", "notifyReminders"] as const) {
    if (key in input) {
      if (typeof input[key] !== "boolean") return null;
      update[key] = input[key] as boolean;
    }
  }
  if ("promptDismissed" in input) {
    if (input.promptDismissed !== true) return null;
    update.promptDismissed = true;
  }
  return Object.keys(update).length > 0 ? update : null;
}

/** Save notice preferences. Turning any notice on lifts an earlier unsubscribe. */
export async function updatePreferences(
  userId: string,
  update: PreferenceUpdate,
  now: Date = new Date(),
): Promise<ContactSettings> {
  const data: {
    notifyNewWork?: boolean;
    notifyReminders?: boolean;
    promptDismissedAt?: Date;
    unsubscribedAt?: null;
  } = {};
  if (update.notifyNewWork !== undefined) data.notifyNewWork = update.notifyNewWork;
  if (update.notifyReminders !== undefined) data.notifyReminders = update.notifyReminders;
  if (update.promptDismissed) data.promptDismissedAt = now;
  if (update.notifyNewWork || update.notifyReminders) data.unsubscribedAt = null;

  const row = await prisma.contactEmail.upsert({
    where: { userId },
    create: { userId, unsubscribeToken: newToken(), ...data },
    update: data,
  });
  return toSettings(row);
}

/**
 * One-click unsubscribe, signed out and idempotent. With the verified
 * address's token, every notice goes off (the first unsubscribe time is kept).
 * With a pending address's token, that address is dropped so it gets no more
 * mail. False when the token matches nothing.
 */
export async function unsubscribe(token: unknown, now: Date = new Date()): Promise<boolean> {
  if (typeof token !== "string" || token.length === 0 || token.length > 200) return false;

  const row = await prisma.contactEmail.findUnique({ where: { unsubscribeToken: token } });
  if (row) {
    await prisma.contactEmail.update({
      where: { id: row.id },
      data: { notifyNewWork: false, notifyReminders: false, unsubscribedAt: row.unsubscribedAt ?? now },
    });
    return true;
  }

  const pending = await prisma.contactEmail.findUnique({ where: { pendingUnsubscribeToken: token } });
  if (!pending) return false;
  // Keep the token so a second click still answers true.
  await prisma.contactEmail.update({
    where: { id: pending.id },
    data: { pendingAddress: null, verifyTokenHash: null, verifyTokenExpires: null },
  });
  return true;
}

/** Forget the address entirely (verified and pending). Preferences reset to off. */
export async function removeContactEmail(userId: string): Promise<ContactSettings> {
  const row = await prisma.contactEmail.findUnique({ where: { userId } });
  if (!row) return { ...EMPTY_SETTINGS };
  const updated = await prisma.contactEmail.update({
    where: { id: row.id },
    data: {
      address: null,
      verifiedAt: null,
      pendingAddress: null,
      verifyTokenHash: null,
      verifyTokenExpires: null,
      unsubscribeToken: newToken(),
      pendingUnsubscribeToken: null,
      unsubscribedAt: null,
      notifyNewWork: false,
      notifyReminders: false,
    },
  });
  return toSettings(updated);
}
