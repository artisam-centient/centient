import * as Sentry from "@sentry/nextjs";
import { APP_URL } from "./constants";
import { resendClient } from "./resend";

// Mail to contributors' notice addresses (#248). Every message carries
// RFC 8058 one-click unsubscribe headers. Failures are logged and reported
// without the address: it never reaches logs or Sentry (#165).

const FROM = process.env.RESEND_EMAIL_FROM ?? "Centient <onboarding@resend.dev>";

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

export function unsubscribeHeaders(unsubscribeToken: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${unsubscribeLink(unsubscribeToken)}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
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

export type SendResult = "sent" | "skipped" | "failed";

function withFooter(body: { text: string; html: string }, unsubscribeToken: string): { text: string; html: string } {
  const unsub = unsubscribeLink(unsubscribeToken);
  return {
    text: `${body.text}\n\nYou get this because you turned this notice on in Centient. Stop all Centient email: ${unsub}`,
    html: `${body.html}<p style="color:#666;font-size:12px">You get this because you turned this notice on in Centient. <a href="${unsub}">Stop all Centient email</a></p>`,
  };
}

/** #260: new funded work is open. The link lands on the app; #261 deep-links it. */
export function fundedWorkMessage(taskCount: number, unsubscribeToken: string): ContactMessage {
  const app = appUrl();
  const what =
    taskCount === 1 ? "A new paid task is" : taskCount > 1 ? `${taskCount} new paid tasks are` : "New paid work is";
  return {
    subject: "New paid work on Centient",
    ...withFooter(
      {
        text: `${what} open on Centient. Rewards are paid in USDC (testnet) as your answers are accepted.\n\nStart: ${app}/`,
        html: `<p>${what} open on Centient. Rewards are paid in USDC (testnet) as your answers are accepted.</p><p><a href="${app}/">Start labeling</a></p>`,
      },
      unsubscribeToken,
    ),
  };
}

/** #260: the one reminder about an unfinished task. */
export function reminderMessage(unsubscribeToken: string): ContactMessage {
  const app = appUrl();
  return {
    subject: "You left a Centient task unfinished",
    ...withFooter(
      {
        text: `You opened a task on Centient but didn't answer it. It's still open if you'd like to finish.\n\nContinue: ${app}/\n\nThis is the only reminder for that task.`,
        html: `<p>You opened a task on Centient but didn't answer it. It's still open if you'd like to finish.</p><p><a href="${app}/">Continue</a></p><p>This is the only reminder for that task.</p>`,
      },
      unsubscribeToken,
    ),
  };
}

/** Send one message to a notice address. "skipped" when Resend isn't configured. */
export async function sendContactEmail(
  to: string,
  message: ContactMessage,
  unsubscribeToken: string,
): Promise<SendResult> {
  if (!resendClient) {
    console.log("[contact-email] RESEND_API_KEY not set, skipping send");
    // Local dev only: print the message body (links, never the address) so the
    // flow can be clicked through without a mail account.
    if (process.env.NODE_ENV === "development") console.log(message.text);
    return "skipped";
  }
  try {
    const { error } = await resendClient.emails.send({
      from: FROM,
      to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      headers: unsubscribeHeaders(unsubscribeToken),
    });
    if (error) {
      // Resend's error message can echo the recipient; log its name only.
      console.error("[contact-email] send rejected:", error.name);
      Sentry.captureMessage(`contact-email send rejected: ${error.name}`, "error");
      return "failed";
    }
    return "sent";
  } catch (err) {
    const name = err instanceof Error ? err.name : "unknown";
    console.error("[contact-email] send threw:", name);
    Sentry.captureMessage(`contact-email send threw: ${name}`, "error");
    return "failed";
  }
}
