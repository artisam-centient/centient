"use client";

import Image from "next/image";
import Faq from "./Faq";
import WalletSignIn from "./WalletSignIn";

interface LoginScreenProps {
  /** Called once Freighter sign-in has set the session cookie (#26). */
  onWalletSignedIn: () => void;
  /** Open the email flow — kept for accounts that signed up by email. */
  onEmailAuth: (mode: "login" | "register") => void;
  error: string | null;
}

/**
 * Wallet-first entry (#26). A contributor signs in by connecting Freighter and
 * signing a one-time challenge (#25) — no email or password. The proven `G…`
 * address is the account: a new address gets a new contributor account, and an
 * email account that linked that address signs in as itself.
 *
 * Email sign-in stays as a secondary path for accounts created before wallet
 * sign-in; it is no longer required to earn.
 */
export default function LoginScreen({ onWalletSignedIn, onEmailAuth, error }: LoginScreenProps) {
  return (
    <div className="relative min-h-screen bg-surface">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -right-[10%] -top-[20%] h-[80vw] w-[80vw] rounded-full bg-primary/5 blur-[100px]" />
        <div className="absolute -left-[20%] top-[40%] h-[70vw] w-[70vw] rounded-full bg-secondary/5 blur-[80px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-2xl px-5 pb-20 pt-16">
        <section className="flex flex-col items-center gap-6 pb-10 text-center">
          <Image
            src="/logo.png"
            alt="Centient logo"
            width={96}
            height={96}
            priority
            className="select-none drop-shadow-[0_8px_24px_rgba(0,109,61,0.15)]"
          />

          <div>
            <h1 className="text-[2.25rem] font-headline font-extrabold leading-[1.1] tracking-tight text-on-surface">
              Earn with{" "}
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Centient
              </span>
            </h1>
            <p className="mt-2 font-body text-base text-on-surface-variant">
              Train AI, cent by cent. Connect your Stellar wallet to start — no email or
              password needed.
            </p>
          </div>

          {error && <p className="max-w-xs text-sm text-error">{error}</p>}

          {/* PRIMARY (#26): wallet-first */}
          <WalletSignIn onSignedIn={() => onWalletSignedIn()} />

          <p className="font-body text-sm text-on-surface-variant">
            Signed up with email before?{" "}
            <button
              type="button"
              onClick={() => onEmailAuth("login")}
              className="font-semibold text-primary underline-offset-2 hover:underline"
            >
              Sign in with email
            </button>
          </p>

          {/* How it works — the wallet is the account */}
          <div className="w-full max-w-xs rounded-2xl bg-surface-container-low p-4 text-left">
            <div className="flex items-start gap-3">
              <span
                className="material-symbols-outlined mt-0.5 text-[22px] text-primary"
                aria-hidden="true"
              >
                savings
              </span>
              <p className="font-body text-sm text-on-surface-variant">
                Your <span className="font-semibold text-on-surface">wallet address</span>{" "}
                is your account. Freighter asks you to sign a one-time message to prove
                it&apos;s yours — it never moves funds. Approved answers add to your balance
                automatically.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-10">
          <div className="mb-1 text-xs font-label font-bold uppercase tracking-[0.2em] text-outline">
            FAQ
          </div>
          <Faq />
        </section>
      </div>
    </div>
  );
}
