"use client";

import { useState } from "react";
import Image from "next/image";
import Icon from "./LandingIcon";
import { Drift, PAPER } from "./LandingWidgets";

/** The Centient promo video on the Artisam Labs YouTube channel. */
const PROMO_VIDEO_ID = "uxjxu33TOuM";

/** The video's first and last chapters, floated just outside its frame. */
const CHAPTERS = [
  { label: "Connect your wallet", icon: "account_balance_wallet", place: "-left-10 top-[44%]", period: 5.6, delay: 0 },
  { label: "Get paid in USDC", icon: "payments", place: "-right-10 top-[14%]", period: 6.3, delay: -2 },
];

/**
 * The promo video behind a poster of its own. YouTube's thumbnail shows an
 * older landing and reward, so the frame opens on a still in this page's
 * colors instead; pressing play swaps in the youtube-nocookie player, which
 * sets no cookies until it plays. The poster also spares the page the
 * player's scripts until someone wants it.
 */
export default function LandingVideo() {
  const [playing, setPlaying] = useState(false);

  return (
    <section
      id="watch"
      aria-labelledby="watch-heading"
      className="scroll-mt-20 bg-surface-container-low px-5 py-24 sm:px-8 sm:py-28"
    >
      <div className="mx-auto max-w-5xl">
        <h2
          id="watch-heading"
          className="text-center font-headline text-3xl font-extrabold tracking-[-0.03em] sm:text-[2.75rem] sm:leading-[1.05]"
        >
          Meet Centient
        </h2>
        <p className="mx-auto mt-3 max-w-[40ch] text-center font-body text-base leading-relaxed text-on-surface-variant sm:text-lg">
          A short walkthrough: connect a wallet, pick the better response, and see the payment arrive.
        </p>

        <div className="relative mt-12">
          <div className="landing-frame aspect-video w-full overflow-hidden rounded-[2rem] bg-inverse-surface shadow-[0_24px_60px_rgba(0,109,61,0.14)]">
            {playing ? (
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${PROMO_VIDEO_ID}?rel=0&autoplay=1`}
                title="Centient promo video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
                className="h-full w-full border-0"
              />
            ) : (
              <button
                type="button"
                onClick={() => setPlaying(true)}
                className="group relative flex h-full w-full items-center justify-center overflow-hidden text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-primary-container"
              >
                <span className="sr-only">Play the Centient promo video (YouTube)</span>
                {/* The owl waves from the poster's corner. */}
                <span aria-hidden="true" className="absolute -bottom-[6%] left-[5%] w-[22%] max-w-[11rem]">
                  <Image src="/mascot/owl-wave.webp" alt="" width={352} height={352} className="h-auto w-full select-none" />
                </span>
                <span aria-hidden="true" className="absolute left-[6%] top-[9%] font-headline text-xl font-extrabold tracking-[-0.02em] text-inverse-on-surface sm:text-3xl">
                  Centient
                  <span className="mt-1 hidden font-body text-sm font-semibold tracking-normal text-inverse-on-surface/70 sm:block">
                    Quick explainer · Artisam Labs
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className="grid h-16 w-16 place-items-center rounded-full bg-surface-container-lowest text-primary shadow-[0_18px_40px_-12px_rgba(0,0,0,0.5)] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-110 group-active:scale-95 sm:h-24 sm:w-24"
                >
                  <Icon name="play_arrow" size={44} filled className="translate-x-0.5" />
                </span>
                <span aria-hidden="true" className="absolute bottom-[8%] right-[5%] flex items-center gap-1.5 rounded-full bg-surface-container-lowest/10 px-3 py-1.5 font-label text-xs font-semibold text-inverse-on-surface sm:text-sm">
                  <Icon name="smart_display" size={16} />
                  Plays from YouTube
                </span>
              </button>
            )}
          </div>

          {/* Two chapters drift at the frame's edges, from 1024px. */}
          {CHAPTERS.map((c) => (
            <div key={c.label} aria-hidden="true" className={`pointer-events-none absolute hidden lg:block ${c.place}`}>
              <Drift period={c.period} delay={c.delay}>
                <span className={`${PAPER} flex items-center gap-2 px-4 py-3 font-label text-sm font-semibold text-on-surface`}>
                  <Icon name={c.icon} size={18} className="text-on-surface-variant" />
                  {c.label}
                </span>
              </Drift>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
