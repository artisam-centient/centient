"use client";

import { useRef } from "react";
import Image from "next/image";
import AnswerJourney from "./AnswerJourney";
import Faq from "./Faq";
import LandingVideo from "./LandingVideo";
import { Drift, PAPER } from "./LandingWidgets";
import LandingPhone from "./LandingPhone";
import PayoutFeed from "./PayoutFeed";
import WalletSignIn from "./WalletSignIn";
import { deployedBuild } from "@/lib/build-info";
import { REWARD_TOKEN_SYMBOL } from "@/lib/constants";
import { useLogoReady } from "@/lib/use-logo-ready";
import { useScrollCamera } from "@/lib/use-scroll-camera";

/** The header logo. The landing skeleton preloads this exact rendition. */
export const HEADER_LOGO = { src: "/logo.png", width: 36, height: 36 };

interface LoginScreenProps {
  /** Called once Freighter sign-in has set the session cookie (#26). */
  onWalletSignedIn: () => void;
  /** Open email sign-in — only so an account created by email can claim a wallet (#30). */
  onEmailSignIn: () => void;
  error: string | null;
}

/** The public Centient docs on GitBook, synced from `docs/instawards`. */
const DOCS_URL = "https://centient.gitbook.io/centient-docs/";

const FOCUS_RING =
  "rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

/** In page order. The ids are stable anchors other pages and docs link to. */
const SECTIONS = [
  { href: "#payouts", label: "Payouts" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#watch", label: "Watch" },
  { href: "#faq", label: "FAQ" },
];

/** The closing stub's own promises, floated beside it. */
const CLOSE_CHIPS = [
  { label: "No email", icon: "alternate_email", place: "-left-28 top-[18%]", period: 5.6, delay: 0, tilt: -1.5 },
  { label: "No password", icon: "password", place: "-right-28 top-[54%]", period: 6.2, delay: -2, tilt: 1.2 },
  { label: "Never moves funds", icon: "lock", place: "-right-32 bottom-[6%]", period: 5.9, delay: -4, tilt: -1 },
];

const LINE_UP = "block motion-safe:animate-[landing-line-up_900ms_cubic-bezier(0.16,1,0.3,1)_both]";

/**
 * Wallet-first entry (#26). A contributor signs in by connecting Freighter and
 * signing a one-time challenge (#25) — no email or password. The proven `G…`
 * address is the account: a new address gets a new contributor account, and an
 * email account that linked that address signs in as itself.
 *
 * #30: nobody signs up with email any more. Email sign-in stays only for an
 * account created before wallet sign-in, which must connect its wallet before it
 * can earn or withdraw.
 *
 * The page follows one answer: the hero's phone plays a sample task end to
 * end, the feed below it lists real payouts from the ledger, and the sections
 * after that itemize what happens to an answer.
 */
export default function LoginScreen({ onWalletSignedIn, onEmailSignIn, error }: LoginScreenProps) {
  const build = deployedBuild();
  const logo = useLogoReady();
  const closeRef = useRef<HTMLElement>(null);
  useScrollCamera(closeRef, "enter");
  return (
    <div className="min-h-screen overflow-x-clip bg-surface text-on-surface">
      <header className="landing-header sticky top-0 z-40 bg-surface">
        <div className="mx-auto flex h-[4.5rem] max-w-6xl items-center justify-between px-5 sm:px-8">
          {/* The wordmark waits for the logo so the two appear together. */}
          <a href="#top" className={`flex items-center gap-2 ${FOCUS_RING} ${logo.ready ? "" : "invisible"}`}>
            <Image
              {...HEADER_LOGO}
              alt=""
              loading="eager"
              {...logo.imageProps}
              className="select-none"
            />
            <span className="font-headline text-xl font-extrabold tracking-tighter text-primary">Centient</span>
          </a>
          <div className="flex items-center gap-7">
            <nav aria-label="Page sections" className="hidden items-center gap-7 md:flex">
              {SECTIONS.map((s) => (
                <a
                  key={s.href}
                  href={s.href}
                  className={`relative font-label text-sm font-semibold text-on-surface-variant transition-colors after:absolute after:inset-x-0 after:-bottom-1 after:h-0.5 after:origin-left after:scale-x-0 after:rounded-full after:bg-primary after:transition-transform after:duration-300 after:ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-primary hover:after:scale-x-100 ${FOCUS_RING}`}
                >
                  {s.label}
                </a>
              ))}
            </nav>
            <a
              href={DOCS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 font-label text-sm font-bold text-on-primary shadow-[0_4px_12px_rgba(0,109,61,0.15)] transition-[translate,scale,box-shadow] duration-200 hover:-translate-y-px hover:shadow-[0_8px_20px_rgba(0,109,61,0.22)] active:translate-y-0 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                menu_book
              </span>
              Docs
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </div>
        </div>
      </header>

      <main id="top" className="scroll-mt-20">
        {/* The hero is one big widget: a wide Ledger Green field holding the
            pitch and the stage, with the phone's widgets breaking out over its
            edges (DESIGN.md, The Green Stage). */}
        <section className="mx-auto max-w-[90rem] px-3 pb-20 pt-3 sm:px-6 lg:pb-16 lg:pt-4">
          <div className="grid grid-cols-1 items-center gap-12 rounded-[2rem] bg-primary px-5 pb-12 pt-10 shadow-[0_48px_96px_-40px_rgba(0,84,45,0.55),0_8px_24px_rgba(25,28,30,0.06)] sm:px-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:gap-10 lg:rounded-[2.75rem] lg:px-14 lg:py-14 xl:grid-cols-[minmax(0,1fr)_minmax(0,38rem)] xl:gap-16 xl:px-20">
            <div className="flex flex-col items-start">
              <h1 className="font-headline text-[min(3.25rem,13.5vw)] font-extrabold leading-[0.95] tracking-[-0.04em] text-on-primary sm:text-[5rem] lg:text-[3.5rem] xl:text-[5.75rem]">
                <span className="block overflow-clip pb-[0.04em]">
                  <span className={LINE_UP}>Train AI,</span>
                </span>
                <span className="-mb-[0.1em] block overflow-clip pb-[0.14em]">
                  <span className={`${LINE_UP} whitespace-nowrap text-secondary-container [animation-delay:120ms]`}>
                    cent by cent.
                  </span>
                </span>
              </h1>

              <p className="mt-7 max-w-[30rem] font-body text-lg leading-relaxed text-on-primary/90 sm:text-xl">
                Pick the better of two AI responses and say why. Each approved answer pays {REWARD_TOKEN_SYMBOL}{" "}
                straight to your wallet.
              </p>

              {error && (
                <p role="alert" className="mt-5 max-w-sm rounded-xl bg-surface-container-lowest px-4 py-3 font-body text-sm text-error">
                  {error}
                </p>
              )}

              <div className="mt-9 flex w-full flex-col items-start gap-4">
                {/* PRIMARY (#26): wallet-first. On the field it is a solid paper pill. */}
                <WalletSignIn onSignedIn={() => onWalletSignedIn()} tone="field" />

                <p className="font-body text-sm text-on-primary/90">
                  Signed up with email before?{" "}
                  <button
                    type="button"
                    onClick={onEmailSignIn}
                    className="rounded-md font-semibold text-on-primary underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-surface-container-lowest focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
                  >
                    Sign in with email
                  </button>{" "}
                  to connect your wallet.
                </p>
              </div>
            </div>

            <LandingPhone />
          </div>
        </section>

        <PayoutFeed />

        <AnswerJourney />

        <LandingVideo />

        <section
          id="faq"
          aria-labelledby="faq-heading"
          className="mx-auto grid max-w-6xl scroll-mt-20 grid-cols-[minmax(0,1fr)] gap-10 px-5 py-24 sm:px-8 sm:py-28 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-20"
        >
          <div className="lg:sticky lg:top-32 lg:self-start">
            <h2
              id="faq-heading"
              className="font-headline text-3xl font-extrabold tracking-[-0.03em] sm:text-[2.75rem] sm:leading-[1.05]"
            >
              Questions
            </h2>
            <p className="mt-3 font-body text-base text-on-surface-variant sm:text-lg">
              Anything else, email{" "}
              <a
                href="mailto:centient@artisam.xyz"
                className={`font-semibold text-primary underline-offset-2 hover:underline ${FOCUS_RING}`}
              >
                centient@artisam.xyz
              </a>
              .
            </p>
            {/* The docs, as a widget the owl is reading. */}
            <Drift period={6.2} className="mt-8">
              <a
                href={DOCS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={`group flex items-center gap-4 ${PAPER} pr-5 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`}
              >
                <Image src="/mascot/owl-think.webp" alt="" width={160} height={160} className="h-16 w-16 shrink-0 select-none" />
                <span className="min-w-0 flex-1">
                  <span className="block font-headline text-base font-bold text-on-surface">Centient Docs</span>
                  <span className="mt-0.5 block font-body text-sm text-on-surface-variant">Tasks, wallets and payouts, in full.</span>
                </span>
                <span className="material-symbols-outlined text-[20px] text-on-surface-variant transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true">
                  arrow_outward
                </span>
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </Drift>
          </div>
          <div className="faq-smooth">
            <Faq showLabel={false} />
          </div>
        </section>

        {/* The close: the receipt's last stub, torn off and handed over. It
            comes up tilted and settles flat as it arrives, with its promises
            floating beside it. */}
        <section ref={closeRef} aria-labelledby="start-heading" className="px-5 pb-28 pt-6 sm:px-8">
          <div className="relative mx-auto max-w-xl">
            {CLOSE_CHIPS.map((c) => (
              <div key={c.label} aria-hidden="true" className={`pointer-events-none absolute z-10 hidden sm:block ${c.place}`}>
                <Drift period={c.period} delay={c.delay} tilt={c.tilt}>
                  <span className={`${PAPER} flex items-center gap-2 px-4 py-3 font-label text-sm font-semibold text-on-surface`}>
                    <span className="material-symbols-outlined text-[18px] text-on-surface-variant" aria-hidden="true">
                      {c.icon}
                    </span>
                    {c.label}
                  </span>
                </Drift>
              </div>
            ))}
            <div aria-hidden="true" className="pointer-events-none absolute -bottom-6 -left-36 z-10 hidden w-36 lg:block">
              <Image src="/mascot/owl-wave.webp" alt="" width={288} height={288} className="h-auto w-full select-none" />
            </div>
            <div className="landing-handoff drop-shadow-[0_24px_40px_rgba(25,28,30,0.09)]">
              <div className="receipt-stub bg-surface-container-lowest px-6 pb-12 pt-11 sm:px-10">
                <div className="flex items-center gap-1.5 border-b border-dashed border-outline-variant pb-4">
                  <Image src="/logo.png" alt="" width={22} height={22} className="select-none" />
                  <span className="font-headline text-base font-extrabold tracking-tighter text-primary">Centient</span>
                </div>
                <h2
                  id="start-heading"
                  className="mt-8 font-headline text-3xl font-extrabold tracking-[-0.03em] text-on-surface sm:text-[2.5rem] sm:leading-[1.05]"
                >
                  Your wallet is your account
                </h2>
                <p className="mt-4 font-body text-base leading-relaxed text-on-surface-variant sm:text-lg">
                  Your <span className="font-semibold text-on-surface">wallet address</span>{" "}
                  {`is your account and where your ${REWARD_TOKEN_SYMBOL} is paid. Freighter asks you to sign a one-time message to prove it's yours. It never moves funds, and there's no email or password needed.`}
                </p>
                <div className="mt-8 border-t border-dashed border-outline-variant pt-8">
                  {/* The hero's sign-in already carries the phone pairing prompt. */}
                  <WalletSignIn onSignedIn={() => onWalletSignedIn()} pairing={false} />
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl items-center justify-between border-t border-outline-variant/40 px-5 py-8 sm:px-8">
        <span className="font-headline text-base font-extrabold tracking-tighter text-primary">Centient</span>
        <div className="flex flex-col items-end gap-1">
          <span className="font-label text-xs font-bold uppercase tracking-[0.2em] text-outline">centient.work</span>
          {build && (
            <a
              href={build.commitUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={build.sha}
              className={`font-mono text-xs text-outline underline-offset-2 hover:underline ${FOCUS_RING}`}
            >
              Build {build.shortSha}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          )}
        </div>
      </footer>
    </div>
  );
}
