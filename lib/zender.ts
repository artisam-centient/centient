// Centient's email goes out through Zender, Artisam's notification service
// (#268). Zender owns the provider (Postmark) and the sending domain; Centient
// keeps everything else: the queue, limits, quiet hours and consent (ADR-0013).
//
// One call per message: POST {ZENDER_API_URL}/emails with inline content. The
// Idempotency-Key is our email_sends row id, which Zender honours for 24 h, so
// sending the same row twice can never make two emails.

const DEFAULT_API_URL = "https://zender.artisam.xyz/api/v1";
const DEFAULT_FROM = "Centient <centient@artisam.xyz>";
const TIMEOUT_MS = 10_000;

/**
 * "sent": Zender accepted it (202). "refused": Zender answered no, or the
 * address is on its suppression list, so nothing went out. "unknown": no
 * usable answer (network, timeout), so it may have gone out. "skipped":
 * ZENDER_API_KEY isn't set (local dev), so nothing was attempted.
 */
export type SendResult = "sent" | "skipped" | "refused" | "unknown";

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** What kind of email this is, e.g. "verification". Sent as metadata and a tag. */
  kind: string;
  /** Stable per send: the email_sends row id. */
  idempotencyKey: string;
}

export function zenderConfigured(): boolean {
  return Boolean(process.env.ZENDER_API_KEY?.trim());
}

/** "Centient <centient@artisam.xyz>" or a bare address → Zender's { email, name }. */
export function parseFrom(value: string): { email: string; name?: string } {
  const m = value.trim().match(/^(.*?)\s*<([^<>\s]+)>$/);
  if (!m) return { email: value.trim() };
  const name = m[1].trim().replace(/^"(.*)"$/, "$1");
  return name ? { email: m[2], name } : { email: m[2] };
}

function apiUrl(): string {
  return (process.env.ZENDER_API_URL?.trim() || DEFAULT_API_URL).replace(/\/+$/, "");
}

function fromAddress(): { email: string; name?: string } {
  return parseFrom(process.env.EMAIL_FROM?.trim() || DEFAULT_FROM);
}

/** The error envelope's type and code only: Zender's message can echo the recipient. */
async function errorLabel(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: { type?: unknown; code?: unknown } };
    const type = typeof body.error?.type === "string" ? body.error.type : "unknown_type";
    const code = typeof body.error?.code === "string" ? body.error.code : "unknown_code";
    return `${res.status} ${type}/${code}`;
  } catch {
    return `${res.status}`;
  }
}

export async function sendEmail(email: OutgoingEmail, fetchImpl: typeof fetch = fetch): Promise<SendResult> {
  const key = process.env.ZENDER_API_KEY?.trim();
  if (!key) {
    console.log(`[zender] ZENDER_API_KEY not set, skipping ${email.kind} email`);
    return "skipped";
  }

  let res: Response;
  try {
    res = await fetchImpl(`${apiUrl()}/emails`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `centient-${email.idempotencyKey}`,
      },
      body: JSON.stringify({
        to: [{ email: email.to }],
        from: fromAddress(),
        content: email.text ? { html: email.html, text: email.text } : { html: email.html },
        subject_override: email.subject,
        metadata: { source_app: "centient", kind: email.kind, send_id: email.idempotencyKey },
        tags: [email.kind],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    console.error(`[zender] ${email.kind} send got no answer:`, err instanceof Error ? err.name : "unknown");
    return "unknown";
  }

  if (res.status !== 202 && res.status !== 200) {
    console.error(`[zender] ${email.kind} send rejected:`, await errorLabel(res));
    return "refused";
  }

  // A suppressed recipient (bounced, complained) comes back in `suppressed`
  // with no message: Zender will never send to it.
  try {
    const body = (await res.json()) as { data?: { messages?: unknown[]; suppressed?: unknown[] } };
    const messages = body.data?.messages ?? [];
    if (messages.length === 0 && (body.data?.suppressed ?? []).length > 0) {
      console.error(`[zender] ${email.kind} send refused: recipient suppressed`);
      return "refused";
    }
  } catch {
    // Accepted with an unreadable body: Zender still took it.
  }
  return "sent";
}
