"use client";

import { useEffect, useId, useLayoutEffect, useReducer, useRef, useState } from "react";
import Image from "next/image";
import LandingMascot, { type OwlPose } from "./LandingMascot";
import { REWARD_AMOUNT, REWARD_TOKEN_SYMBOL } from "@/lib/constants";

interface SampleTask {
  prompt: string;
  responses: [string, string];
  chosen: 0 | 1;
  reason: string;
  /** Made up, like the hash: the caption says this receipt is a sample. */
  to: string;
  tx: string;
}

/** Tasks from the seeded pool (prisma/seed.ts), shortened to fit the slip. */
const SAMPLES: SampleTask[] = [
  {
    prompt: "What's 0.1 + 0.2 in most programming languages?",
    responses: ["Exactly 0.3.", "0.30000000000000004. Floats can't store 0.1 or 0.2 exactly in binary."],
    chosen: 1,
    reason: "A is wrong. B gives the real result and explains the rounding.",
    to: "GBX7…Q4NM",
    tx: "3f9a…c21e",
  },
  {
    prompt: "What year did World War II end?",
    responses: ["1945.", "1945, with Japan's surrender in September, after Germany's in May."],
    chosen: 1,
    reason: "Both say 1945, but B also explains how the war ended.",
    to: "GD2K…7HWA",
    tx: "b71d…04af",
  },
  {
    prompt: "What is the largest planet in our solar system?",
    responses: ["Jupiter. It has more than twice the mass of all the other planets combined.", "The largest planet is Jupiter."],
    chosen: 0,
    reason: "Both are right, but A adds a useful fact about its size.",
    to: "GCQ9…M3RT",
    tx: "e2c8…9b17",
  },
];

/** The sample the receipt prints first; the journey section follows the same answer. */
export const FEATURED_SAMPLE = SAMPLES[0];

/** One receipt, in the order it prints. */
const S = {
  Header: 0,
  Prompt: 1,
  Responses: 2,
  Weighing: 3,
  Chosen: 4,
  Reason: 5,
  Checking: 6,
  Passed: 7,
  FirstKey: 8,
  SecondKey: 9,
  Paid: 10,
  TornOff: 11,
} as const;

/** How long each stage holds before the next. Reason holds for its typing instead. */
const HOLD_MS: Record<number, number> = {
  [S.Header]: 700,
  [S.Prompt]: 850,
  [S.Responses]: 1100,
  [S.Weighing]: 750,
  [S.Chosen]: 700,
  [S.Checking]: 750,
  [S.Passed]: 550,
  [S.FirstKey]: 450,
  [S.SecondKey]: 650,
  [S.Paid]: 5200,
  [S.TornOff]: 450,
};
const TYPE_MS = 34;

/** The stage at which each printed group of lines comes out of the printer. */
const GROUP_AT = [S.Header, S.Prompt, S.Responses, S.Reason, S.Checking, S.FirstKey, S.Paid];

function poseFor(stage: number): OwlPose {
  if (stage === S.Header) return "wave";
  if (stage <= S.Responses) return "laptop";
  if (stage <= S.Chosen) return "think";
  if (stage < S.Paid) return "idea";
  return "chart";
}

/** "0.05" stays "0.05"; "0.1" becomes "0.10". */
function cents(amount: string): string {
  const [whole, frac = ""] = amount.split(".");
  return `${whole}.${frac.padEnd(2, "0")}`;
}

interface Playback {
  sample: number;
  stage: number;
  typed: number;
}

type Action = { type: "next" } | { type: "type" } | { type: "final" };

function reducer(state: Playback, action: Action): Playback {
  if (action.type === "final") return { sample: 0, stage: S.Paid, typed: Infinity };
  if (action.type === "type") return { ...state, typed: state.typed + 1 };
  if (state.stage === S.TornOff) {
    return { sample: (state.sample + 1) % SAMPLES.length, stage: S.Header, typed: 0 };
  }
  return { ...state, stage: state.stage + 1 };
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-label text-[11px] font-bold uppercase tracking-[0.2em] text-outline">{children}</span>
  );
}

function Rule() {
  return <div className="border-t border-dashed border-outline-variant" />;
}

function Leader() {
  return <span className="mx-2 h-px flex-1 translate-y-1 border-b border-dotted border-outline-variant" />;
}

function Icon({ name, className = "", filled = false }: { name: string; className?: string; filled?: boolean }) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}
    >
      {name}
    </span>
  );
}

const POP = "motion-safe:animate-[receipt-pop_320ms_cubic-bezier(0.16,1,0.3,1)_both]";

/**
 * The landing's signature: a receipt that prints one sample task end to end,
 * on its own, with no input from the visitor. The prompt and both responses
 * come out, one response is weighed and chosen, the reason types itself, the
 * quality check passes, two of three keys sign, and the reward is paid. Then
 * the slip tears off and the next sample prints. The owl beside the printer
 * changes pose with each stage.
 *
 * It only runs while on screen and in a visible tab. With reduced motion it
 * shows the finished receipt and stays still.
 */
export default function LandingReceipt() {
  const captionId = useId();
  const [reduced] = useState(prefersReducedMotion);
  const [active, setActive] = useState(false);
  const [{ sample, stage, typed }, dispatch] = useReducer(
    reducer,
    undefined,
    (): Playback => (prefersReducedMotion() ? { sample: 0, stage: S.Paid, typed: Infinity } : { sample: 0, stage: S.Header, typed: 0 }),
  );

  const figureRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const amountRef = useRef<HTMLSpanElement>(null);
  const groupRefs = useRef<(HTMLDivElement | null)[]>([]);

  const task = SAMPLES[sample];
  const reward = cents(REWARD_AMOUNT);

  // Play only while the receipt is on screen and the tab is visible.
  useEffect(() => {
    const figure = figureRef.current;
    if (!figure || reduced) return;
    let inView = false;
    const update = () => setActive(inView && document.visibilityState === "visible");
    const io = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      update();
    });
    io.observe(figure);
    document.addEventListener("visibilitychange", update);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, [reduced]);

  // Advance through the stages.
  useEffect(() => {
    if (reduced || !active) return;
    if (stage === S.Reason) {
      if (typed < task.reason.length) {
        const id = window.setTimeout(() => dispatch({ type: "type" }), TYPE_MS);
        return () => window.clearTimeout(id);
      }
      const id = window.setTimeout(() => dispatch({ type: "next" }), 450);
      return () => window.clearTimeout(id);
    }
    const id = window.setTimeout(() => dispatch({ type: "next" }), HOLD_MS[stage]);
    return () => window.clearTimeout(id);
  }, [reduced, active, stage, typed, task.reason.length]);

  // Feed the paper: show everything printed so far just above the slot. A new
  // slip starts in place, with no transition from where the last one left.
  useLayoutEffect(() => {
    const paper = paperRef.current;
    if (!paper) return;
    const place = () => {
      const height = paper.offsetHeight;
      let shown = height;
      if (stage < S.Paid) {
        let last = 0;
        GROUP_AT.forEach((at, i) => {
          if (at <= stage) last = i;
        });
        // Up to where the next group starts, so nothing unprinted peeks out.
        const next = groupRefs.current[last + 1];
        if (next) shown = next.offsetTop;
      }
      const torn = stage === S.TornOff;
      paper.style.transform = `translateY(${torn ? -28 : height - shown}px)`;
      paper.style.opacity = torn ? "0" : "1";
    };
    if (stage === S.Header) {
      paper.setAttribute("data-instant", "");
      place();
      void paper.offsetHeight;
      const raf = requestAnimationFrame(() => paper.removeAttribute("data-instant"));
      const ro = new ResizeObserver(place);
      ro.observe(paper);
      return () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
      };
    }
    place();
    const ro = new ResizeObserver(place);
    ro.observe(paper);
    return () => ro.disconnect();
  }, [stage, sample]);

  // Count the payout up from zero as it prints.
  useEffect(() => {
    const el = amountRef.current;
    if (!el) return;
    if (stage !== S.Paid || reduced || !active) {
      el.textContent = reward;
      return;
    }
    const target = Number(REWARD_AMOUNT);
    const decimals = reward.split(".")[1].length;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 800);
      el.textContent = (target * (1 - (1 - t) ** 3)).toFixed(decimals);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [stage, sample, reduced, active, reward]);

  // A light tilt toward the pointer, on devices that have one.
  useEffect(() => {
    const figure = figureRef.current;
    const tilt = stageRef.current;
    if (!figure || !tilt || reduced || !window.matchMedia("(pointer: fine)").matches) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      const r = figure.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        tilt.style.transform = `rotateX(${(-y * 5).toFixed(2)}deg) rotateY(${(x * 7).toFixed(2)}deg)`;
      });
    };
    const onLeave = () => {
      cancelAnimationFrame(raf);
      tilt.style.transform = "";
    };
    figure.addEventListener("pointermove", onMove);
    figure.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      figure.removeEventListener("pointermove", onMove);
      figure.removeEventListener("pointerleave", onLeave);
    };
  }, [reduced]);

  const ink = (group: number) =>
    stage === GROUP_AT[group] ? "motion-safe:animate-[receipt-ink_520ms_ease-out_both]" : "";
  const setGroup = (i: number) => (el: HTMLDivElement | null) => {
    groupRefs.current[i] = el;
  };

  const typing = stage === S.Reason && typed < task.reason.length;
  const shownReason = stage < S.Reason ? "" : stage > S.Reason ? task.reason : task.reason.slice(0, typed);
  const signed = stage >= S.SecondKey ? 2 : stage >= S.FirstKey ? 1 : 0;
  const first = SAMPLES[0];

  return (
    <figure ref={figureRef} aria-labelledby={captionId} className="relative mx-auto w-full max-w-[34rem]">
      <p className="sr-only">
        Sample task: {first.prompt} The labeler picks response {first.chosen ? "B" : "A"} and explains why:{" "}
        {first.reason} The answer passes the quality check, two of three keys sign the payout, and {reward}{" "}
        {REWARD_TOKEN_SYMBOL} is paid to their wallet.
      </p>

      <div aria-hidden="true" className="[perspective:1400px]">
        <div ref={stageRef} className="relative transition-transform duration-500 ease-out">
          <div className="flex items-end">
            {/* The owl stands on the printer beside the slip. On phones the slip
                takes the full width and the owl perches on its top corner, over
                the oldest lines, clear of the newest one at the slot. */}
            <LandingMascot
              pose={poseFor(stage)}
              decorative
              sizes="(min-width: 640px) 160px, 88px"
              className="z-20 w-[5.5rem] shrink-0 max-sm:absolute max-sm:-top-10 max-sm:right-1 sm:relative sm:-mb-1 sm:w-40"
            />

            {/* Everything above the slot; the rest of the slip is still inside. Only
                the bottom is clipped, so the paper's shadow falls freely at the sides.
                Below lg the window is shorter than the slip: the newest line stays at
                the slot and older lines fade out at the top. */}
            <div className="relative min-w-0 flex-1">
              <div className="flex flex-col justify-end [clip-path:inset(0_-3rem_0_-3rem)] h-[18rem] sm:h-[20rem] lg:h-auto lg:pt-6 lg:[clip-path:inset(-3rem_-3rem_0_-3rem)]">
                <div className="drop-shadow-[0_18px_30px_rgba(25,28,30,0.10)]">
                  <div ref={paperRef} data-instant="" className="receipt-feed">
                    <div className="receipt-paper bg-surface-container-lowest px-5 pb-8 pt-4 sm:px-6">
                      <div key={`h${sample}`} ref={setGroup(0)} className={ink(0)}>
                        <div className="flex items-center justify-between gap-3 pb-3">
                          <div className="flex items-center gap-1.5">
                            <Image src="/logo.png" alt="" width={22} height={22} className="select-none" />
                            <span className="font-headline text-base font-extrabold tracking-tighter text-primary">
                              Centient
                            </span>
                          </div>
                          <span className="flex items-center gap-1 rounded-full bg-secondary-fixed/45 px-2.5 py-1 font-headline text-xs font-bold text-secondary">
                            <Icon name="monetization_on" filled className="text-[14px]" />
                            {reward} {REWARD_TOKEN_SYMBOL}
                          </span>
                        </div>
                        <Rule />
                      </div>

                      <div key={`p${sample}`} ref={setGroup(1)} className={`py-3 ${ink(1)}`}>
                        <Label>Prompt</Label>
                        <p className="mt-1.5 min-h-[2lh] font-headline text-[15px] font-bold leading-snug text-on-surface sm:text-base">
                          {task.prompt}
                        </p>
                      </div>

                      <div key={`r${sample}`} ref={setGroup(2)} className={`pb-3.5 ${ink(2)}`}>
                        <ul className="grid gap-5">
                          {task.responses.map((text, i) => {
                            const chosen = stage >= S.Chosen && i === task.chosen;
                            const weighing = stage === S.Weighing && i !== task.chosen;
                            return (
                              <li
                                key={i}
                                className={`relative flex gap-3 rounded-xl px-3 py-2.5 transition-[box-shadow,background-color] duration-300 ${
                                  chosen
                                    ? "bg-primary/[0.06] ring-2 ring-primary"
                                    : weighing
                                      ? "bg-surface-container-low ring-2 ring-outline-variant"
                                      : "bg-surface-container-low"
                                }`}
                              >
                                <span
                                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-md font-label text-xs font-bold transition-colors duration-300 ${
                                    chosen ? "bg-primary text-on-primary" : "bg-surface-container-highest text-on-surface-variant"
                                  }`}
                                >
                                  {i ? "B" : "A"}
                                </span>
                                <span className="min-h-[2lh] font-body text-[13px] leading-relaxed text-on-surface-variant sm:text-sm">
                                  {text}
                                </span>
                                {chosen && (
                                  <span
                                    className={`absolute -top-4 right-3 flex items-center gap-0.5 rounded-full bg-primary py-0.5 pl-1.5 pr-2 font-label text-[11px] font-bold text-on-primary shadow-[0_4px_10px_rgba(0,109,61,0.25)] ${POP}`}
                                  >
                                    <Icon name="check" className="text-[13px]" />
                                    Chosen
                                  </span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>

                      <div key={`w${sample}`} ref={setGroup(3)} className={ink(3)}>
                        <div className="pb-3">
                          <Label>Reason</Label>
                          <p className="mt-1.5 min-h-[2lh] font-body text-[13px] leading-relaxed text-on-surface sm:text-sm">
                            {shownReason}
                            {typing && (
                              <span className="ml-px inline-block h-[1.05em] w-[2px] translate-y-[3px] bg-primary motion-safe:animate-[receipt-caret_900ms_steps(1)_infinite]" />
                            )}
                            <span className="text-transparent">{task.reason.slice(shownReason.length)}</span>
                          </p>
                        </div>
                        <Rule />
                      </div>

                      <div key={`c${sample}`} ref={setGroup(4)} className={ink(4)}>
                        <div className="flex items-center py-2.5 text-sm">
                          <span className="font-label font-semibold text-on-surface-variant">Quality check</span>
                          <Leader />
                          {stage <= S.Checking ? (
                            <span className="flex items-center gap-1.5 font-label text-outline">
                              <span className="flex gap-0.5">
                                {[0, 1, 2].map((d) => (
                                  <span
                                    key={d}
                                    className="h-1 w-1 rounded-full bg-outline motion-safe:animate-pulse"
                                    style={{ animationDelay: `${d * 200}ms` }}
                                  />
                                ))}
                              </span>
                              Checking
                            </span>
                          ) : (
                            <span className={`flex items-center gap-1 font-label font-semibold text-primary ${POP}`}>
                              <Icon name="check_circle" filled className="text-[16px]" />
                              Passed
                            </span>
                          )}
                        </div>
                      </div>

                      <div key={`k${sample}`} ref={setGroup(5)} className={ink(5)}>
                        <div className="flex items-center pb-2.5 text-sm">
                          <span className="font-label font-semibold text-on-surface-variant">Signatures</span>
                          <Leader />
                          <span className="flex items-center gap-1">
                            {[0, 1, 2].map((k) => (
                              <Icon
                                key={`${k}-${k < signed}`}
                                name="key"
                                filled={k < signed}
                                className={`text-[16px] ${k < signed ? `text-primary ${POP}` : "text-outline-variant"}`}
                              />
                            ))}
                            <span className="ml-1 font-label font-semibold tabular-nums text-on-surface">
                              {signed} of 3
                            </span>
                          </span>
                        </div>
                        <Rule />
                      </div>

                      <div key={`$${sample}`} ref={setGroup(6)} className={ink(6)}>
                        <div
                          className={`-mx-2 mt-2 rounded-xl px-2 py-2 ${
                            stage === S.Paid ? "motion-safe:animate-[receipt-paid_1600ms_ease-out_both]" : ""
                          }`}
                        >
                          <div className="flex items-end justify-between gap-3">
                            <div>
                              <Label>Paid</Label>
                              <p className="mt-1 font-mono text-xs text-on-surface-variant">to {task.to}</p>
                            </div>
                            <p className="flex items-baseline gap-1 text-secondary">
                              <span
                                ref={amountRef}
                                className="font-headline text-4xl font-extrabold tracking-tighter tabular-nums"
                              >
                                {reward}
                              </span>
                              <span className="font-headline text-base font-bold">{REWARD_TOKEN_SYMBOL}</span>
                            </p>
                          </div>
                          <div className="mt-3 flex items-center justify-between font-mono text-[11px] text-outline">
                            <span>tx {task.tx}</span>
                            <span className="flex items-center gap-1 font-label text-xs font-semibold text-primary">
                              <Icon name="verified" filled className="text-[14px]" />
                              Confirmed
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {/* Outside the clipped window on purpose: a fade inside it is clipped at
                  the same fractional edge as the paper, and one row of text leaks. */}
              <div className="pointer-events-none absolute -inset-x-12 -top-2 z-10 h-28 bg-gradient-to-b from-surface from-35% to-transparent lg:hidden" />
            </div>
          </div>

          {/* The printer: the slip disappears into its slot. */}
          <div className="relative z-10 -mt-1.5 h-7 rounded-xl bg-inverse-surface shadow-[0_14px_28px_rgba(25,28,30,0.18),inset_0_1px_0_rgba(255,255,255,0.08)]">
            <div className="absolute left-3 right-3 top-1.5 h-1.5 rounded-full bg-on-surface shadow-[inset_0_1px_2px_rgba(25,28,30,0.9)] sm:left-[10.5rem]" />
          </div>
        </div>
      </div>

      <figcaption
        id={captionId}
        className="mt-4 flex items-start gap-1.5 font-body text-[13px] leading-snug text-on-surface-variant sm:pl-40"
      >
        <span className="material-symbols-outlined mt-px text-[16px] text-outline" aria-hidden="true">
          replay
        </span>
        Sample task on Stellar testnet, replayed automatically.
      </figcaption>
    </figure>
  );
}
