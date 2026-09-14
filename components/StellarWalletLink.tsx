"use client";

import { useState } from "react";
import { connect, signOwnership, signTransaction, WalletError } from "@/lib/stellar/wallet";

const SPONSOR_UNAVAILABLE_MESSAGE = "Payouts are temporarily unavailable. Please try again shortly.";
const SPONSOR_PENDING_MESSAGE =
  "Your payout wallet setup is still confirming on the network. Try again in a minute.";

/**
 * #28: shown while Freighter asks for the sponsorship signature. Freighter
 * summarises the envelope as "USDC · Add Trustline" and shows its inner fee, which
 * the sponsor's fee bump pays instead. Without this, a contributor holding no XLM
 * may reasonably decline a fee they cannot pay.
 */
const SPONSOR_SIGNING_NOTICE: Record<"trustline" | "account+trustline", string> = {
  trustline:
    "Approve in Freighter to add USDC to your wallet. Centient pays the network fee and the reserve — the fee Freighter shows is not charged to you, and you need no XLM.",
  "account+trustline":
    "Approve in Freighter to create your Stellar account and add USDC. Centient pays the network fee and the reserves — the fee Freighter shows is not charged to you, and you need no XLM.",
};

interface StellarWalletLinkProps {
  /**
   * Whether a valid `G…` Stellar payout address is already linked. Driven by the
   * server's `walletLinked` flag (a StrKey check), NOT the raw `walletAddress`
   * column — that may still hold a legacy EVM `0x…` from a prior connection, which
   * would wrongly read as "linked".
   */
  isLinked: boolean;
  /** Called after a successful link so the parent can refresh withdrawal state. */
  onLinked: () => void;
  showToast: (message: string, type: "success" | "error") => void;
}

/**
 * ST-4b (#300) — link + prove a Stellar payout address from the withdrawal screen.
 *
 * Login stays email/password; the wallet (Freighter) is used ONLY here: connect →
 * fetch a server challenge → sign it (SEP-53) → POST the proof. The server
 * verifies the signature, prechecks the USDC trustline, and binds the address.
 * An untrusted address surfaces clear guidance instead of a silent payout failure
 * (ST-4e #314 will turn that into an in-app sponsored-trustline flow).
 */
export default function StellarWalletLink({
  isLinked,
  onLinked,
  showToast,
}: StellarWalletLinkProps) {
  const [linking, setLinking] = useState(false);
  const [signingNotice, setSigningNotice] = useState<string | null>(null);

  /**
   * Ensure `address` holds a USDC trustline, sponsoring it (CAP-33) if not. The
   * labeler pays 0 XLM. Returns true when the address is ready to receive USDC,
   * false when the caller should abort (a toast has already been shown). One
   * retry on the tx_bad_seq race (a concurrent payout took the platform's
   * sequence — rebuild + re-sign).
   */
  const ensureTrustline = async (address: string): Promise<boolean> => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetch(
        `/api/me/wallet/sponsor?address=${encodeURIComponent(address)}`,
      );
      const data = await res.json();
      if (!res.ok) {
        // #330: the platform caps how many payout wallets it will fund per account.
        if (res.status === 429 && data.error === "sponsorship_cap_reached") {
          showToast(
            "You've reached the limit of payout wallets we can set up for your account. Use a wallet you've already linked.",
            "error",
          );
          return false;
        }
        if (res.status === 409 && data.error === "address_in_use") {
          showToast("This Stellar address is already set up for another account.", "error");
          return false;
        }
        if (res.status === 409 && data.error === "submission_pending") {
          showToast(SPONSOR_PENDING_MESSAGE, "error");
          return false;
        }
        if (res.status === 503) {
          showToast(SPONSOR_UNAVAILABLE_MESSAGE, "error");
          return false;
        }
        showToast(data.error ?? "Could not set up USDC payouts", "error");
        return false;
      }
      if (!data.needed) return true; // already trusts USDC
      if (data.needed && !data.xdr) {
        showToast("Could not set up USDC payouts", "error");
        return false;
      }

      let signedXdr: string;
      setSigningNotice(SPONSOR_SIGNING_NOTICE[data.kind as keyof typeof SPONSOR_SIGNING_NOTICE] ?? SPONSOR_SIGNING_NOTICE.trustline);
      try {
        signedXdr = await signTransaction(data.xdr, address);
      } catch (err) {
        // #27: a declined envelope is never re-offered. Nothing was submitted, and
        // the next attempt builds a fresh one.
        if (err instanceof WalletError && err.code === "rejected") {
          showToast("Payout wallet setup cancelled. Nothing was submitted — link again when you're ready.", "error");
          return false;
        }
        throw err;
      } finally {
        setSigningNotice(null);
      }
      const submit = await fetch("/api/me/wallet/sponsor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, signedXdr }),
      });
      // 202: the submit's outcome is not known yet. Rebuilding now could sponsor twice.
      if (submit.status === 202) {
        showToast(SPONSOR_PENDING_MESSAGE, "error");
        return false;
      }
      if (submit.ok) return true;

      const err = await submit.json();
      if (submit.status === 409 && err.error === "retry") continue; // rebuild + re-sign
      if (submit.status === 429 && err.error === "sponsorship_cap_reached") {
        showToast(
          "You've reached the limit of payout wallets we can set up for your account. Use a wallet you've already linked.",
          "error",
        );
        return false;
      }
      if (submit.status === 409 && err.error === "address_in_use") {
        showToast("This Stellar address is already set up for another account.", "error");
        return false;
      }
      if (submit.status === 409 && err.error === "submission_pending") {
        showToast(SPONSOR_PENDING_MESSAGE, "error");
        return false;
      }
      if (submit.status === 503) {
        showToast(SPONSOR_UNAVAILABLE_MESSAGE, "error");
        return false;
      }
      showToast(err.error ?? "Could not set up USDC payouts", "error");
      return false;
    }
    showToast("Could not set up USDC payouts. Please try again.", "error");
    return false;
  };

  /**
   * Connect, make sure the address can receive USDC, then prove ownership and
   * link it. Every failure ends in a toast; nothing here throws to the caller.
   */
  const handleLink = async () => {
    if (linking) return;
    setLinking(true);
    try {
      // 1. Connect a wallet and read its `G…` address (never normalized).
      const { address } = await connect();

      // 2. Ensure the address can receive USDC — sponsor its trustline if needed
      //    (labeler pays 0 XLM). Replaces ST-4b's hard no-trustline reject.
      if (!(await ensureTrustline(address))) return;

      // 3. Fetch a one-time, server-issued challenge bound to this address.
      const challengeRes = await fetch(
        `/api/me/wallet?address=${encodeURIComponent(address)}`,
      );
      const challenge = await challengeRes.json();
      if (!challengeRes.ok) {
        showToast(challenge.error ?? "Could not start wallet linking", "error");
        return;
      }

      // 4. Prove ownership by signing the challenge (Freighter SEP-53).
      const { signature } = await signOwnership(challenge.message, address);

      // 5. Submit the proof; server verifies + prechecks the USDC trustline.
      const linkRes = await fetch("/api/me/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stellarAddress: address, signature }),
      });
      const result = await linkRes.json();

      if (linkRes.ok) {
        showToast("Payout wallet linked", "success");
        onLinked();
        return;
      }

      if (linkRes.status === 409 && result.error === "no_trustline") {
        showToast(
          result.message ??
            "This address has no USDC trustline yet. Add one in your wallet, then link again.",
          "error",
        );
        return;
      }

      if (linkRes.status === 409 && result.error === "address_already_linked") {
        showToast(
          "This Stellar address is already linked to another account.",
          "error",
        );
        return;
      }

      showToast(result.error ?? "Wallet linking failed", "error");
    } catch (err) {
      // connect()/signOwnership() throw on rejection or a missing Freighter
      // extension — surface the message so the labeler knows what to do.
      showToast(err instanceof Error ? err.message : "Wallet linking failed", "error");
    } finally {
      setLinking(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleLink}
        disabled={linking}
        className="mt-2 rounded-xl border border-outline px-5 py-2 font-label text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-50"
      >
        {linking
          ? "Linking..."
          : isLinked
            ? "Change payout wallet"
            : "Link payout wallet"}
      </button>
      {signingNotice && (
        <p role="status" aria-live="polite" className="mt-2 max-w-prose font-body text-sm text-on-surface-variant">
          {signingNotice}
        </p>
      )}
    </>
  );
}
