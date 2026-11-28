"use client";

import { useState } from "react";

// #248: where the unsubscribe link in an email's body lands. Works signed out;
// the token arrived in an httpOnly cookie (see /api/email/unsubscribe). Mail
// clients that support one-click unsubscribe skip this page entirely.

type Status = "ready" | "working" | "done" | "invalid";

export default function UnsubscribePage() {
  const [status, setStatus] = useState<Status>("ready");

  async function unsubscribe() {
    setStatus("working");
    try {
      const res = await fetch("/api/email/unsubscribe", { method: "POST" });
      setStatus(res.ok ? "done" : "invalid");
    } catch {
      setStatus("invalid");
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-surface px-6 text-center">
      <div className="flex w-full max-w-sm flex-col items-center gap-4" role="status" aria-live="polite">
        <span className="material-symbols-outlined text-[48px] text-on-surface-variant" aria-hidden="true">
          {status === "done" ? "unsubscribe" : status === "invalid" ? "link_off" : "mail"}
        </span>
        {status === "done" ? (
          <>
            <h1 className="font-headline text-2xl font-bold text-on-surface">You&apos;re unsubscribed</h1>
            <p className="font-body text-sm text-on-surface-variant">
              Centient won&apos;t send you any more notices. You can turn them back on from your account at any time.
            </p>
          </>
        ) : status === "invalid" ? (
          <>
            <h1 className="font-headline text-2xl font-bold text-on-surface">This link doesn&apos;t work</h1>
            <p className="font-body text-sm text-on-surface-variant">
              Open the unsubscribe link from your email again, or turn notices off in your account&apos;s Email notices.
            </p>
          </>
        ) : (
          <>
            <h1 className="font-headline text-2xl font-bold text-on-surface">Stop Centient email?</h1>
            <p className="font-body text-sm text-on-surface-variant">This turns off every notice for this address.</p>
            <button
              type="button"
              onClick={() => void unsubscribe()}
              disabled={status === "working"}
              className="mt-2 rounded-full bg-primary px-6 py-2.5 font-label text-sm font-semibold text-on-primary disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              {status === "working" ? "Unsubscribing…" : "Unsubscribe"}
            </button>
          </>
        )}
        {status !== "ready" && status !== "working" && (
          <a href="/" className="font-label text-sm font-semibold text-primary underline-offset-2 hover:underline">
            Open Centient
          </a>
        )}
      </div>
    </main>
  );
}
