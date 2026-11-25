import * as Sentry from "@sentry/nextjs";
import { APP_URL } from "./constants";
import { sendEmail } from "./zender";
import { finishSend, reserveCustomerVerification } from "./email-queue";
function escapeHtml(str: string): string {
    return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
function safeUrl(url: string): string {
    try {
        const u = new URL(url);
        if (u.protocol !== "http:" && u.protocol !== "https:") {
            throw new Error("Unsafe URL scheme")
        }
        return escapeHtml(u.toString());
    } catch{
        return "#"
    }
}
export async function sendVerificationEmail(
    email: string,
    token: string,
    companyName?: string
) {
    if (APP_URL.includes("localhost") && process.env.NODE_ENV == "production"){
        throw new Error("[email] Fatal: APP_URL contains 'localhost' in production. Set NEXT_PUBLIC_APP_URL to your deployed URL.")
    } 
    const verificationUrl = `${APP_URL}/verify-email?token=${token}`;
    // #260: the same sender as contributor email, so it takes a slot from the
    // same daily limit first. No slot: not sent, and the caller warns.
    const slot = await reserveCustomerVerification();
    if (!slot) {
        console.warn("[email] daily email limit reached; customer verification not sent");
        return null;
    }
    try {
        const result = await sendEmail({
            to: email,
            subject: "Verify your email - Centient",
            html: `
                <h1>Verify your email</h1>
                <p>Hi ${escapeHtml (companyName || "there")},</p>
                <p>Confirm your email to start labeling and earning.</p>
                <a href="${safeUrl(verificationUrl)}">Verify Email →</a>
                <p>This link expires in 24 hours.</p>
            `,
            kind: "customer_verification",
            idempotencyKey: slot,
        });
        await finishSend(slot, result === "skipped" ? "not_sent" : result);
        // Truthy only when Zender accepted it; callers warn the admin otherwise.
        return result === "sent" ? true : null;
  } catch (error) {
    // No answer: it may have gone out, so the slot stays counted.
    await finishSend(slot, "unknown").catch(() => {});
    console.error("[email] Failed to send verification email:", { error: error instanceof Error ? error.name : "unknown" });
    Sentry.captureException(error);
    throw error;
  }
}
