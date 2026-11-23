"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { track } from "@/lib/analytics";

// #248: optional email notices. The address shows only to its owner, in this
// card; it never goes into analytics (track() calls below carry no address).

export interface EmailSettings {
  address: string | null;
  pendingAddress: string | null;
  notifyNewWork: boolean;
  notifyReminders: boolean;
  promptDismissed: boolean;
}

type Failure = "invalid_email" | "already_verified" | "rate_limited" | "daily_limit" | "send_failed" | "network";

const FAILURE_TEXT: Record<Failure, string> = {
  invalid_email: "That doesn't look like an email address.",
  already_verified: "That address is already confirmed.",
  rate_limited: "Too many links sent. Try again in an hour.",
  daily_limit: "We've sent all the email we can today. Try again tomorrow.",
  send_failed: "We couldn't send the link. Try again in a minute.",
  network: "Something went wrong. Try again.",
};

/** Loads and saves /api/me/email. `null` while loading or when signed out. */
export function useEmailSettings() {
  const [settings, setSettings] = useState<EmailSettings | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/me/email")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => live && data && setSettings(data as EmailSettings))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const call = useCallback(async (method: "PUT" | "PATCH" | "DELETE", body?: unknown): Promise<Failure | null> => {
    try {
      const res = await fetch("/api/me/email", {
        method,
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (data?.settings) setSettings(data.settings as EmailSettings);
        return (data?.error as Failure) ?? "network";
      }
      setSettings(data as EmailSettings);
      return null;
    } catch {
      return "network";
    }
  }, []);

  return { settings, call };
}

function Switch({
  checked,
  labelId,
  disabled,
  onChange,
}: {
  checked: boolean;
  labelId: string;
  disabled: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelId}
      onClick={onChange}
      disabled={disabled}
      className={`relative h-8 w-[52px] shrink-0 rounded-full transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-60 ${
        checked ? "bg-primary" : "bg-surface-container-highest"
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute top-1 h-6 w-6 rounded-full bg-surface-container-lowest shadow-[0_1px_3px_rgba(25,28,30,0.2)] transition-[left] duration-200 ease-out motion-reduce:transition-none ${
          checked ? "left-6" : "left-1"
        }`}
      />
    </button>
  );
}

/** Address, verification state and the two notice switches. */
export function EmailNoticesCard({
  settings,
  call,
}: {
  settings: EmailSettings;
  call: ReturnType<typeof useEmailSettings>["call"];
}) {
  const id = useId();
  const [editing, setEditing] = useState(!settings.address && !settings.pendingAddress);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [sentNote, setSentNote] = useState(false);

  async function run(fn: () => Promise<Failure | null>) {
    setBusy(true);
    setFailure(null);
    const result = await fn();
    setFailure(result);
    setBusy(false);
    return result;
  }

  async function sendLink(e?: React.FormEvent, address?: string) {
    e?.preventDefault();
    if (busy) return;
    const result = await run(() => call("PUT", { address: address ?? draft }));
    if (!result) {
      track("email_link_sent");
      setEditing(false);
      setDraft("");
      setSentNote(true);
    }
  }

  async function toggle(key: "notifyNewWork" | "notifyReminders") {
    if (busy) return;
    const on = !settings[key];
    const result = await run(() => call("PATCH", { [key]: on }));
    if (!result) track("email_notice_changed", { notice: key === "notifyNewWork" ? "new_work" : "reminders", on });
  }

  async function remove() {
    if (busy) return;
    const result = await run(() => call("DELETE"));
    if (!result) {
      track("email_removed");
      setEditing(true);
      setSentNote(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {settings.address && (
        <p className="m-0 font-body text-[13px] leading-[19px] text-on-surface-variant">
          Notices go to <span className="font-semibold text-on-surface">{settings.address}</span>.
        </p>
      )}

      {settings.pendingAddress && !editing && (
        <p
          role="status"
          className="m-0 flex gap-3 rounded-2xl bg-secondary-container px-4 py-3 font-body text-[13px] leading-[19px] text-on-secondary-container"
        >
          <span className="material-symbols-outlined shrink-0 text-[20px]" aria-hidden="true">
            mark_email_unread
          </span>
          <span>
            {sentNote ? "Link sent. " : ""}Check <span className="font-semibold">{settings.pendingAddress}</span> and
            open the link within 24 hours to confirm it.
          </span>
        </p>
      )}

      {editing ? (
        <form onSubmit={(e) => void sendLink(e)} className="flex flex-col gap-2">
          <label htmlFor={`${id}-address`} className="font-label text-[13px] font-semibold text-on-surface-variant">
            {settings.address ? "New email address" : "Email address"}
          </label>
          <div className="flex gap-2">
            <input
              id={`${id}-address`}
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              required
              maxLength={254}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2.5 font-body text-sm text-on-surface focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
            <button
              type="submit"
              disabled={busy || draft.trim() === ""}
              className="shrink-0 rounded-xl bg-primary px-4 py-2.5 font-label text-sm font-semibold text-on-primary transition-opacity disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              {busy ? "Sending…" : "Send link"}
            </button>
          </div>
          <p className="m-0 font-body text-xs text-on-surface-variant">
            Optional. We send a confirmation link first, and nothing else until you turn a notice on.
          </p>
          {(settings.address || settings.pendingAddress) && (
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="self-start rounded font-label text-xs font-semibold text-on-surface-variant underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-primary"
            >
              Cancel
            </button>
          )}
        </form>
      ) : (
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {settings.pendingAddress && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void sendLink(undefined, settings.pendingAddress ?? "")}
              className="rounded font-label text-xs font-semibold text-primary underline-offset-2 hover:underline disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-primary"
            >
              Resend link
            </button>
          )}
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded font-label text-xs font-semibold text-primary underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-primary"
          >
            Change email
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void remove()}
            className="rounded font-label text-xs font-semibold text-on-surface-variant underline-offset-2 hover:underline disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-primary"
          >
            Remove email
          </button>
        </div>
      )}

      {failure && (
        <p role="alert" className="m-0 font-body text-xs text-error">
          {FAILURE_TEXT[failure]}
        </p>
      )}

      <div className="flex flex-col gap-3 border-t border-dashed border-outline-variant pt-3">
        {(
          [
            ["notifyNewWork", "New funded work", "When a campaign you can label is funded and open."],
            ["notifyReminders", "Unfinished-task reminders", "A nudge when you've left a task half done."],
          ] as const
        ).map(([key, label, hint]) => (
          <div key={key} className="flex items-center justify-between gap-4">
            <div className="flex flex-col">
              <span id={`${id}-${key}`} className="font-body text-sm font-semibold text-on-surface">
                {label}
              </span>
              <span className="font-body text-xs text-on-surface-variant">{hint}</span>
            </div>
            <Switch checked={settings[key]} labelId={`${id}-${key}`} disabled={busy} onChange={() => void toggle(key)} />
          </div>
        ))}
        {!settings.address && (settings.notifyNewWork || settings.notifyReminders) && (
          <p className="m-0 font-body text-xs text-on-surface-variant">Notices start once your email is confirmed.</p>
        )}
      </div>
    </div>
  );
}

/**
 * The signed-in home's prompt: shown until the contributor adds an address or
 * dismisses it. "Add email" opens the same card inline.
 */
export function EmailPrompt() {
  const { settings, call } = useEmailSettings();
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);

  if (!settings || hidden) return null;
  const hasEmail = Boolean(settings.address || settings.pendingAddress);
  if (!open && (hasEmail || settings.promptDismissed)) return null;

  async function dismiss() {
    setHidden(true);
    track("email_prompt_dismissed");
    await call("PATCH", { promptDismissed: true });
  }

  return (
    <section
      aria-label="Email notices"
      className="w-full rounded-3xl bg-surface-container-lowest px-5 py-4 shadow-[0_8px_24px_rgba(25,28,30,0.06)]"
    >
      {open ? (
        <>
          <h3 className="mb-3 font-headline text-base font-bold text-on-surface">Email notices</h3>
          <EmailNoticesCard settings={settings} call={call} />
          <button
            type="button"
            onClick={() => setHidden(true)}
            className="mt-3 rounded font-label text-xs font-semibold text-on-surface-variant underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-primary"
          >
            Done
          </button>
        </>
      ) : (
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined shrink-0 text-[22px] text-primary" aria-hidden="true">
            mail
          </span>
          <div className="flex flex-1 flex-col gap-2">
            <p className="m-0 font-body text-sm text-on-surface">
              Want an email when new paid work opens? It&apos;s optional, and you choose what we send.
            </p>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => {
                  track("email_prompt_opened");
                  setOpen(true);
                }}
                className="rounded font-label text-sm font-semibold text-primary underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-primary"
              >
                Add email
              </button>
              <button
                type="button"
                onClick={() => void dismiss()}
                className="rounded font-label text-sm font-semibold text-on-surface-variant underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-primary"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/** The account sheet's section. */
export function EmailNoticesSection() {
  const { settings, call } = useEmailSettings();
  return (
    <div className="mb-6">
      <h3 className="mb-3 font-label text-[10px] font-bold uppercase tracking-[0.2em] text-outline">
        Email notices
      </h3>
      {settings ? (
        <EmailNoticesCard settings={settings} call={call} />
      ) : (
        <p className="py-2 font-body text-xs text-on-surface-variant">Loading…</p>
      )}
    </div>
  );
}
