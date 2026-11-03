"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import Icon from "./LandingIcon";
import { REWARD_TOKEN_SYMBOL } from "@/lib/constants";
import { answerXp, DAILY_GOAL } from "@/lib/gamification/rules";
import { TIERS } from "@/lib/gamification/tiers";

/**
 * The hero stage's live widgets: small paper cards that float around the phone
 * and follow the sample task it plays. Each shows something the product really
 * does (the pick and its reason, the payout's statuses, the XP loop's rules),
 * so none of them is decoration.
 */

/** The sample tasks are easy ones, and an easy accepted answer earns this much XP. */
const XP_PER_ANSWER = answerXp(null);
/** The tier a new labeler works toward first. */
const NEXT_TIER = TIERS[1];

export const PAPER =
  "rounded-[1.125rem] bg-surface-container-lowest p-4 shadow-[0_18px_40px_-12px_rgba(25,28,30,0.24),0_4px_10px_rgba(25,28,30,0.06)]";
const HEAD = "flex items-center justify-between gap-2 font-label text-xs font-semibold text-on-surface-variant";
const POP = "motion-safe:animate-[landing-pop_320ms_cubic-bezier(0.16,1,0.3,1)_both]";

/**
 * One camera layer: it fills the stage and shifts with the camera by its depth
 * (`--d`). Nearer layers (a larger depth) travel further than the phone, which
 * sits at depth 0, and the disc behind it (negative depth) travels the other way.
 */
export function Layer({ depth, className = "", children }: { depth: number; className?: string; children: ReactNode }) {
  return (
    <div className={`landing-layer pointer-events-none absolute inset-0 ${className}`} style={{ "--d": depth } as CSSProperties}>
      {children}
    </div>
  );
}

/**
 * A widget's slot on the stage: it drifts on its own rhythm and comes in when
 * its moment in the task arrives. `place` positions it within the stage.
 */
function Slot({
  place,
  shown,
  period,
  delay,
  tilt,
  children,
}: {
  place: string;
  shown: boolean;
  period: number;
  delay: number;
  tilt: number;
  children: ReactNode;
}) {
  return (
    <div className={`absolute ${place}`}>
      <Drift period={period} delay={delay} tilt={tilt}>
        <div
          className={`transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            shown ? "opacity-100" : "translate-y-3.5 scale-[0.94] opacity-0"
          }`}
        >
          {children}
        </div>
      </Drift>
    </div>
  );
}

/**
 * Something that drifts on its own rhythm, out of step with its neighbours.
 * With reduced motion it stays still.
 */
export function Drift({
  period,
  delay = 0,
  tilt = 0,
  className = "",
  children,
}: {
  period: number;
  delay?: number;
  tilt?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`landing-float ${className}`}
      style={{ "--float-t": `${period}s`, "--float-delay": `${delay}s`, "--float-r": `${tilt}deg` } as CSSProperties}
    >
      {children}
    </div>
  );
}

/** A bar that fills by transform, so it never reflows the card. */
function Meter({ fill, tone }: { fill: number; tone: "ink" | "progress" }) {
  return (
    <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-surface-container-high">
      <span
        className={`block h-full origin-left rounded-full transition-transform ${
          tone === "ink" ? "bg-on-surface duration-200 ease-linear" : "bg-tertiary duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
        }`}
        style={{ transform: `scaleX(${Math.min(1, Math.max(0, fill))})` }}
      />
    </span>
  );
}

/** The pick and its reason, filling as the reason types. */
export function PickWidget({
  shown,
  side,
  typed,
  total,
  minimum,
}: {
  shown: boolean;
  side: "A" | "B";
  typed: number;
  total: number;
  minimum: number;
}) {
  return (
    <Slot place="right-full top-[3%] -mr-10 hidden sm:block lg:-mr-12" shown={shown} period={5.2} delay={0} tilt={-1.5}>
      <div className={`${PAPER} w-[14.5rem]`}>
        <p className={HEAD}>
          Your pick
          <Icon name="touch_app" size={16} />
        </p>
        <p className="mt-2 flex items-center gap-2 font-headline text-lg font-extrabold tracking-[-0.02em] text-on-surface">
          Response {side}
          {shown && (
            <span className={`flex items-center gap-0.5 rounded-full bg-primary px-2 py-0.5 font-label text-xs font-bold text-on-primary ${POP}`}>
              <Icon name="check" size={14} />
              Selected
            </span>
          )}
        </p>
        <Meter fill={total ? typed / total : 0} tone="ink" />
        <p className="mt-2 flex items-center justify-between font-label text-xs text-on-surface-variant">
          Reason
          <span className="flex items-center gap-1 tabular-nums">
            {typed >= minimum && <Icon name="check" size={14} className={`text-on-surface ${POP}`} />}
            {typed} characters
          </span>
        </p>
      </div>
    </Slot>
  );
}

const STATUSES = ["Pending", "Sent", "Confirmed"] as const;

/**
 * The reward on its way, through the three statuses a labeler sees in their
 * account. Green comes only with Confirmed.
 */
export function PayoutWidget({
  shown,
  paid,
  round,
  reward,
  reduced,
}: {
  shown: boolean;
  paid: boolean;
  round: number;
  reward: string;
  reduced: boolean;
}) {
  const [status, setStatus] = useState(reduced ? 2 : 0);

  useEffect(() => {
    if (reduced) return;
    setStatus(0);
    if (!paid) return;
    const sent = window.setTimeout(() => setStatus(1), 700);
    const confirmed = window.setTimeout(() => setStatus(2), 1700);
    return () => {
      window.clearTimeout(sent);
      window.clearTimeout(confirmed);
    };
  }, [paid, round, reduced]);

  const confirmed = status === 2;
  return (
    <Slot
      place="bottom-[9%] left-full -ml-[8.5rem] sm:-ml-16 lg:-ml-24 xl:-ml-14"
      shown={shown}
      period={6.4}
      delay={-3}
      tilt={-1}
    >
      <div className={`${PAPER} w-[10rem] sm:w-[13.5rem]`}>
        <p className={HEAD}>
          Payout
          <Icon name="account_balance_wallet" size={16} />
        </p>
        <p className="mt-2 flex items-baseline gap-1 text-secondary">
          <span className="font-headline text-3xl font-extrabold leading-none tracking-[-0.03em] tabular-nums">
            +{reward}
          </span>
          <span className="font-headline text-sm font-bold">{REWARD_TOKEN_SYMBOL}</span>
        </p>
        <span className="mt-3 grid grid-cols-3 gap-1.5">
          {STATUSES.map((label, i) => (
            <span
              key={label}
              className={`h-1 rounded-full transition-colors duration-500 ${
                i > status ? "bg-surface-container-high" : confirmed ? "bg-primary" : "bg-on-surface"
              }`}
            />
          ))}
        </span>
        <p
          key={status}
          className={`mt-2 flex items-center gap-1 font-label text-xs font-semibold ${
            confirmed ? "text-primary" : "text-on-surface-variant"
          } ${status > 0 ? POP : ""}`}
        >
          {confirmed && <Icon name="verified" size={14} filled />}
          {STATUSES[status]}
        </p>
      </div>
    </Slot>
  );
}

/** XP toward the first tier and today's goal, both from the XP loop's real rules. */
export function ProgressWidget({ answered, round }: { answered: number; round: number }) {
  const xp = answered * XP_PER_ANSWER;
  const today = Math.min(answered, DAILY_GOAL);
  return (
    <Slot
      place="right-full top-[7%] -mr-[8.25rem] sm:right-auto sm:left-full sm:top-[5%] sm:mr-0 sm:-ml-14 lg:-ml-20 xl:-ml-12"
      shown
      period={5.8}
      delay={-1}
      tilt={1.2}
    >
      <div className={`${PAPER} w-[9.5rem] sm:w-[12.5rem]`}>
        <p className={HEAD}>
          Progress
          {answered > 0 && (
            <span
              key={round}
              className={`rounded-full bg-tertiary px-2 py-0.5 font-label text-xs font-bold text-on-tertiary ${POP}`}
            >
              +{XP_PER_ANSWER} XP
            </span>
          )}
        </p>
        <p className="mt-2 flex items-baseline gap-1">
          <span className="font-headline text-2xl font-extrabold tracking-[-0.02em] text-tertiary tabular-nums">{xp}</span>
          <span className="font-label text-xs font-semibold text-on-surface-variant">
            / {NEXT_TIER.xp} XP<span className="hidden sm:inline"> to {NEXT_TIER.name}</span>
          </span>
        </p>
        <Meter fill={xp / NEXT_TIER.xp} tone="progress" />
        <p className="mt-2.5 hidden items-center justify-between font-label text-xs text-on-surface-variant sm:flex">
          Today
          <span className="flex gap-1">
            {Array.from({ length: DAILY_GOAL }, (_, i) => (
              <span
                key={i}
                className={`h-3.5 w-3.5 rounded-full transition-colors duration-500 ${i < today ? "bg-tertiary" : "bg-tertiary-fixed"}`}
              />
            ))}
          </span>
        </p>
      </div>
    </Slot>
  );
}

/**
 * The stage: a cent. A Signal Green disc on the hero's Ledger Green field,
 * behind the phone, its milled edge turning once a minute (DESIGN.md, The
 * Green Stage Exception).
 */
export function CoinDisc() {
  return (
    <div className="absolute left-1/2 top-1/2 aspect-square w-[21rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-container sm:w-[32rem] sm:-translate-x-[56%] lg:w-[30rem] xl:w-[34rem]">
      <svg viewBox="0 0 100 100" className="landing-coin-edge absolute inset-0 h-full w-full" aria-hidden="true">
        <circle cx="50" cy="50" r="47" fill="none" stroke="rgb(0 84 45 / 0.4)" strokeWidth="1.6" strokeDasharray="0.9 1.55" />
        <circle cx="50" cy="50" r="42.5" fill="none" stroke="rgb(0 84 45 / 0.18)" strokeWidth="0.4" />
      </svg>
    </div>
  );
}

/**
 * A hand-drawn ink line across the coin, from the pick, behind the phone, to
 * the payout. It
 * draws itself once a response is chosen and is gone again for the next task.
 */
export function InkLine({ drawn, round }: { drawn: boolean; round: number }) {
  return (
    <svg
      viewBox="0 0 400 600"
      preserveAspectRatio="none"
      className="absolute -left-[30%] top-[8%] hidden h-[84%] w-[160%] overflow-visible sm:block"
      aria-hidden="true"
    >
      <path
        key={round}
        pathLength={1}
        d="M58 92 C 10 130, 2 200, 30 250 C 50 285, 78 262, 64 236 C 50 210, 20 238, 24 290 C 28 360, 70 420, 200 440 C 280 452, 330 470, 352 482"
        fill="none"
        className={`landing-ink stroke-on-primary-fixed/70 ${drawn ? "landing-ink-on" : ""}`}
        strokeWidth={2.2}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
