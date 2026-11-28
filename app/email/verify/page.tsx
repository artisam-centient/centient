"use client";

import { useEffect, useRef, useState } from "react";

// #248: where the verification link lands. The token arrived in an httpOnly
// cookie (see /api/email/verify), never in this page's URL.

type Status = "loading" | "verified" | "expired" | "invalid";

export default function VerifyContactEmailPage() {
  const [status, setStatus] = useState<Status>("loading");
  const sent = useRef(false);

  useEffect(() => {
    // Once: the token is single-use, and dev Strict Mode runs effects twice.
    if (sent.current) return;
    sent.current = true;
    fetch("/api/email/verify", { method: "POST" })
      .then(async (res) => {
        if (res.ok) return setStatus("verified");
        const data = await res.json().catch(() => null);
        setStatus(data?.error === "expired_token" ? "expired" : "invalid");
      })
      .catch(() => setStatus("invalid"));
  }, []);

  const view = {
    loading: { icon: "hourglass_top", title: "Confirming your email…", body: "" },
    verified: {
      icon: "mark_email_read",
      title: "Email confirmed",
      body: "Choose which notices you want in your account. Every notice is off until you turn it on.",
    },
    expired: {
      icon: "schedule",
      title: "This link has expired",
      body: "Links work for 24 hours. Send a new one from your account's Email notices.",
    },
    invalid: {
      icon: "link_off",
      title: "This link doesn't work",
      body: "It may have been used already. If your email isn't confirmed yet, send a new link from your account.",
    },
  }[status];

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-surface px-6 text-center">
      <div className="flex w-full max-w-sm flex-col items-center gap-4" role="status" aria-live="polite">
        <span
          className={`material-symbols-outlined text-[48px] ${status === "verified" ? "text-primary" : "text-on-surface-variant"}`}
          aria-hidden="true"
        >
          {view.icon}
        </span>
        <h1 className="font-headline text-2xl font-bold text-on-surface">{view.title}</h1>
        {view.body && <p className="font-body text-sm text-on-surface-variant">{view.body}</p>}
        {status !== "loading" && (
          <a
            href="/"
            className="mt-2 rounded-full bg-primary px-6 py-2.5 font-label text-sm font-semibold text-on-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            Open Centient
          </a>
        )}
      </div>
    </main>
  );
}
