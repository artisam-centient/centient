"use client";

import WalletChip from "./WalletChip";
import { GAMIFICATION_ON } from "@/lib/gamification/flag";
import { TIERS } from "@/lib/gamification/tiers";
import type { ProgressView } from "@/lib/gamification/types";
import TierCard from "./gamification/TierCard";
import OnHoldCard from "./gamification/OnHoldCard";
import WeekCard from "./gamification/WeekCard";

/** One row of `GET /api/me/submissions`, as the rail reads it. */
export interface RecentAnswer {
  id: string;
  taskPrompt: string;
  choice: string;
  isGoldCheck: boolean;
  goldPassed: boolean | null;
  earnedDisplay: string;
  payoutStatus: string;
  payoutTxHash: string | null;
  submittedAt: string;
}

export type RecentAnswers =
  | { state: "loading" }
  | { state: "error" }
  | { state: "ready"; items: RecentAnswer[] };

interface TaskRailProps {
  /** The next task is loading: This task holds its shape. */
  taskLoading?: boolean;
  reward: string;
  symbol: string;
  xp?: number | null;
  tier?: number;
  submissionsRemaining?: number | null;
  totalEarned: string;
  progress?: ProgressView | null;
  recent: RecentAnswers;
  /** The answer just accepted in place, washed in gold once. */
  highlightId?: string | null;
  onRetryRecent: () => void;
  explorerUrl: string;
  onOpenAccount: () => void;
  /** The phone's sheet adds the wallet, which the desktop header already shows. */
  wallet?: string | null;
}

const PAPER = "rounded-3xl bg-surface-container-lowest p-5 shadow-[0_8px_24px_rgba(25,28,30,0.06)]";

/** A receipt row: field name, dotted leader, value. */
function Row({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2 font-body text-sm leading-5">
      <span className="text-on-surface-variant">{name}</span>
      <span aria-hidden="true" className="flex-1 border-b-2 border-dotted border-outline-variant" />
      <span className="text-right font-semibold text-on-surface">{children}</span>
    </div>
  );
}

/** "Just now", "7 min ago", "3 h ago", then the date. */
export function relativeTime(iso: string, now = Date.now()): string {
  const mins = Math.floor((now - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** A payout's state in words, with green kept for Confirmed alone. */
function PayoutMark({ status }: { status: string }) {
  const mark =
    status === "confirmed"
      ? { icon: "verified", label: "Confirmed", cls: "text-primary", fill: true }
      : status === "sent"
        ? { icon: "north_east", label: "Sent", cls: "text-on-surface-variant", fill: false }
        : status === "failed"
          ? { icon: "error", label: "Failed", cls: "text-error", fill: false }
          : { icon: "schedule", label: "Pending", cls: "text-outline", fill: false };
  return (
    <span className={`flex items-center gap-1 font-label text-xs font-semibold ${mark.cls}`}>
      <span
        className="material-symbols-outlined text-[15px]"
        style={mark.fill ? { fontVariationSettings: "'FILL' 1" } : undefined}
        aria-hidden="true"
      >
        {mark.icon}
      </span>
      {mark.label}
    </span>
  );
}

function AnswerRow({
  answer,
  symbol,
  explorerUrl,
  fresh,
}: {
  answer: RecentAnswer;
  symbol: string;
  explorerUrl: string;
  fresh: boolean;
}) {
  const body = (
    <>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="line-clamp-1 font-body text-sm text-on-surface">{answer.taskPrompt}</p>
        <p className="font-label text-xs text-outline">
          {relativeTime(answer.submittedAt)} · chose {answer.choice}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {answer.isGoldCheck ? (
          <span className="font-label text-xs font-semibold text-on-surface-variant">
            Check {answer.goldPassed ? "passed" : answer.goldPassed === false ? "missed" : ""}
          </span>
        ) : (
          <>
                <span className="font-headline text-sm font-extrabold tabular-nums text-secondary">
                  +{answer.earnedDisplay} <span className="text-xs font-bold">{symbol}</span>
                </span>
                <PayoutMark status={answer.payoutStatus} />
          </>
        )}
      </div>
    </>
  );
  const row = `flex items-start gap-3 rounded-2xl px-2 py-2.5 -mx-2 ${fresh ? "task-fresh" : ""}`;
  return (
    <li>
      {answer.payoutTxHash ? (
        <a
          href={`${explorerUrl}/tx/${answer.payoutTxHash}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Payment for "${answer.taskPrompt}", ${answer.payoutStatus}, on the ledger`}
          className={`${row} transition-colors duration-150 hover:bg-surface-container-low focus-visible:ring-2 focus-visible:ring-primary`}
        >
          {body}
        </a>
      ) : (
        <div className={row}>{body}</div>
      )}
    </li>
  );
}

const TIPS = [
  { icon: "fact_check", text: "Check the facts first. A confident wrong answer loses to a plain right one." },
  { icon: "ads_click", text: "Prefer the one that does what the prompt asked, in full." },
  { icon: "edit_note", text: "In your reason, name the difference: what one gets right that the other misses." },
];

/**
 * The task screen's session panel: what this task pays, today's goal and tier
 * (behind the gamification flag), the last answers and their payments, and how
 * to judge. A sticky rail beside the task from 1024px; a sheet on phones.
 */
export default function TaskRail({
  taskLoading = false,
  reward,
  symbol,
  xp,
  tier,
  submissionsRemaining,
  totalEarned,
  progress,
  recent,
  highlightId = null,
  onRetryRecent,
  explorerUrl,
  onOpenAccount,
  wallet,
}: TaskRailProps) {
  const tierName = GAMIFICATION_ON && tier !== undefined && tier > 0 ? TIERS[tier]?.name : undefined;

  return (
    <div className="flex flex-col gap-4">
      {wallet !== undefined && (
        <button
          type="button"
          onClick={onOpenAccount}
          className="flex min-h-12 items-center justify-between gap-3 rounded-2xl bg-surface-container-low px-4 py-2 text-left focus-visible:ring-2 focus-visible:ring-primary"
        >
          <WalletChip address={wallet} />
          <span className="flex items-center gap-0.5 font-label text-sm font-bold text-primary">
            Account
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              chevron_right
            </span>
          </span>
        </button>
      )}

      <section aria-labelledby="rail-task-heading" className={`${PAPER} flex flex-col gap-3`}>
        <h2 id="rail-task-heading" className="font-headline text-base font-bold text-on-surface">
          This task
        </h2>
        {taskLoading ? (
          <div aria-hidden="true" className="flex flex-col gap-3 py-0.5">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-4 rounded-md bg-surface-container-high motion-safe:animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            <Row name="Pays">
              <span className="font-headline font-extrabold tabular-nums text-secondary">
                {reward} {symbol}
              </span>
            </Row>
            {GAMIFICATION_ON && xp != null && (
              <Row name="XP">
                <span className="font-headline font-extrabold tabular-nums text-tertiary">+{xp}</span>
              </Row>
            )}
            {tierName && <Row name="Level">{tierName}</Row>}
            {submissionsRemaining != null && (
              <Row name="Answers still needed">
                <span className="tabular-nums">{submissionsRemaining}</span>
              </Row>
            )}
          </>
        )}
        <p className="border-t border-dashed border-outline-variant pt-3 font-body text-xs leading-relaxed text-on-surface-variant">
          Paid straight to your wallet once accepted. Centient runs on Stellar testnet, so test USDC has no
          cash value.
        </p>
      </section>

      {GAMIFICATION_ON && progress && (
        <>
          <WeekCard progress={progress} />
          <TierCard tier={progress.tier} xpTotal={progress.xpTotal} />
          {progress.tier.onHold && <OnHoldCard tier={progress.tier} />}
        </>
      )}

      <section aria-labelledby="rail-answers-heading" className={`${PAPER} flex flex-col gap-2`}>
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="rail-answers-heading" className="font-headline text-base font-bold text-on-surface">
            Your answers
          </h2>
          <span className="font-label text-xs text-on-surface-variant">
            Total{" "}
            <span className="font-headline text-sm font-extrabold tabular-nums text-secondary">
              {totalEarned} {symbol}
            </span>
          </span>
        </div>

        {recent.state === "loading" ? (
          <ul aria-label="Loading your answers" className="flex flex-col gap-3 py-1.5">
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex items-center gap-3">
                <span className="h-9 flex-1 rounded-xl bg-surface-container-high motion-safe:animate-pulse" />
                <span className="h-9 w-16 rounded-xl bg-surface-container-high motion-safe:animate-pulse" />
              </li>
            ))}
          </ul>
        ) : recent.state === "error" ? (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-outline-variant px-4 py-3">
            <p className="font-body text-sm text-on-surface-variant">Couldn&apos;t load your answers.</p>
            <button
              type="button"
              onClick={onRetryRecent}
              className="min-h-10 rounded-full px-3 font-label text-sm font-bold text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary"
            >
              Try again
            </button>
          </div>
        ) : recent.items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-outline-variant px-4 py-4 font-body text-sm leading-relaxed text-on-surface-variant">
            Each answer you send shows here with its payment, from Pending to Confirmed on the ledger.
          </p>
        ) : (
          <ul className="flex flex-col">
            {recent.items.map((a) => (
              <AnswerRow key={a.id} answer={a} symbol={symbol} explorerUrl={explorerUrl} fresh={a.id === highlightId} />
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={onOpenAccount}
          className="mt-1 flex min-h-11 items-center justify-center gap-1 rounded-full bg-surface-container-low font-label text-sm font-bold text-primary transition-colors duration-150 hover:bg-surface-container-high focus-visible:ring-2 focus-visible:ring-primary"
        >
          See all in your account
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
            arrow_forward
          </span>
        </button>
      </section>

      <section aria-labelledby="rail-tips-heading" className={`${PAPER} flex flex-col gap-3`}>
        <h2 id="rail-tips-heading" className="font-headline text-base font-bold text-on-surface">
          How to judge
        </h2>
        <ul className="flex flex-col gap-3">
          {TIPS.map((t) => (
            <li key={t.icon} className="flex items-start gap-3">
              <span className="material-symbols-outlined mt-px text-[18px] text-on-surface-variant" aria-hidden="true">
                {t.icon}
              </span>
              <span className="font-body text-sm leading-relaxed text-on-surface">{t.text}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
