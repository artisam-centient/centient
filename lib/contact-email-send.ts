import * as Sentry from "@sentry/nextjs";
import { APP_URL } from "./constants";
import { openLink } from "./deep-link";
import { sendEmail, type SendResult } from "./zender";

// Mail to contributors' notice addresses (#248), sent through Zender (#268).
// Every message ends with a "Stop all Centient email" link. Zender's API takes
// no custom headers, so the RFC 8058 List-Unsubscribe headers are off until it
// can carry an application's own unsubscribe URL. Failures are logged and
// reported without the address: it never reaches logs or Sentry (#165).

function appUrl(): string {
  if (APP_URL.includes("localhost") && process.env.NODE_ENV === "production") {
    throw new Error("[contact-email] APP_URL contains 'localhost' in production; set NEXT_PUBLIC_APP_URL");
  }
  return APP_URL.replace(/\/+$/, "");
}

/**
 * Links in mail open a server route, which moves the token into a short-lived
 * cookie and redirects to a clean page. The token is never in a URL the browser
 * shows, so PostHog, referrers and session replay can't pick it up.
 */
export function verifyLink(token: string): string {
  return `${appUrl()}/api/email/verify?t=${encodeURIComponent(token)}`;
}

export function unsubscribeLink(unsubscribeToken: string): string {
  return `${appUrl()}/api/email/unsubscribe?t=${encodeURIComponent(unsubscribeToken)}`;
}

export interface ContactMessage {
  subject: string;
  html: string;
  text: string;
}

export function verificationMessage(token: string, unsubscribeToken: string): ContactMessage {
  const link = verifyLink(token);
  const unsub = unsubscribeLink(unsubscribeToken);
  return {
    subject: "Confirm your email for Centient notices",
    text: [
      "Confirm this address to get the Centient notices you choose.",
      "",
      `Confirm: ${link}`,
      "",
      "The link works once and expires in 24 hours. If you didn't ask for this, ignore this email: nothing is sent until the address is confirmed.",
      "",
      `Stop all Centient email: ${unsub}`,
    ].join("\n"),
    html: `
      <p>Confirm this address to get the Centient notices you choose.</p>
      <p><a href="${link}">Confirm my email</a></p>
      <p>The link works once and expires in 24 hours. If you didn't ask for this, ignore this email: nothing is sent until the address is confirmed.</p>
      <p style="color:#666;font-size:12px"><a href="${unsub}">Stop all Centient email</a></p>
    `,
  };
}

/**
 * "refused": Zender answered no, so nothing went out. "unknown": no usable
 * answer (network, timeout), so it may have gone out; never retry that.
 */
export type { SendResult };

function withFooter(body: { text: string; html: string }, unsubscribeToken: string): { text: string; html: string } {
  const unsub = unsubscribeLink(unsubscribeToken);
  return {
    text: `${body.text}\n\nYou get this because you turned this notice on in Centient. Stop all Centient email: ${unsub}`,
    html: `${body.html}<p style="color:#666;font-size:12px">You get this because you turned this notice on in Centient. <a href="${unsub}">Stop all Centient email</a></p>`,
  };
}

/** #260: new funded work is open. #261: the link opens that campaign's work. */
export function fundedWorkMessage(taskCount: number, unsubscribeToken: string, campaignId?: string): ContactMessage {
  const app = appUrl();
  const start = campaignId ? openLink(app, { kind: "campaign", id: campaignId }) : `${app}/`;
  const what =
    taskCount === 1 ? "A new paid task is" : taskCount > 1 ? `${taskCount} new paid tasks are` : "New paid work is";
  return {
    subject: "New paid work on Centient",
    ...withFooter(
      {
        text: `${what} open on Centient. Rewards are paid in USDC (testnet) as your answers are accepted.\n\nStart: ${start}`,
        html: `<p>${what} open on Centient. Rewards are paid in USDC (testnet) as your answers are accepted.</p><p><a href="${start}">Start labeling</a></p>`,
      },
      unsubscribeToken,
    ),
  };
}

/** #260: the one reminder about an unfinished task. #261: the link opens that task. */
export function reminderMessage(unsubscribeToken: string, taskId?: string): ContactMessage {
  const app = appUrl();
  const cont = taskId ? openLink(app, { kind: "task", id: taskId }) : `${app}/`;
  return {
    subject: "You left a Centient task unfinished",
    ...withFooter(
      {
        text: `You opened a task on Centient but didn't answer it. It's still open if you'd like to finish.\n\nContinue: ${cont}\n\nThis is the only reminder for that task.`,
        html: `<p>You opened a task on Centient but didn't answer it. It's still open if you'd like to finish.</p><p><a href="${cont}">Continue</a></p><p>This is the only reminder for that task.</p>`,
      },
      unsubscribeToken,
    ),
  };
}

/** Which email_sends row a send settles: its id is Zender's Idempotency-Key. */
export interface SendRef {
  id: string;
  kind: string;
}

/** Send one message to a notice address. "skipped" when Zender isn't configured. */
export async function sendContactEmail(to: string, message: ContactMessage, ref: SendRef): Promise<SendResult> {
  const result = await sendEmail({
    to,
    subject: message.subject,
    html: message.html,
    text: message.text,
    kind: ref.kind,
    idempotencyKey: ref.id,
  });
  if (result === "skipped" && process.env.NODE_ENV === "development") {
    // Local dev only: print the message body (links, never the address) so the
    // flow can be clicked through without a mail account.
    console.log(message.text);
  }
  if (result === "refused" || result === "unknown") {
    Sentry.captureMessage(`contact-email send ${result}: ${ref.kind}`, "error");
  }
  return result;
}
