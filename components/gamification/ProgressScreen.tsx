import { STAMPS } from "@/lib/gamification/stamps";
import type { ProgressSummary, StandingSummary } from "@/lib/gamification/types";
import OnHoldCard from "./OnHoldCard";
import StampGrid from "./StampGrid";
import TierCard from "./TierCard";

interface ProgressScreenProps {
  progress: (ProgressSummary & StandingSummary) | null | undefined;
  onBack: () => void;
}

/**
 * #202 (board 07): the tier in full and the stamps. The weekly board and the
 * event-code form join it in #203.
 */
export default function ProgressScreen({ progress, onBack }: ProgressScreenProps) {
  const earned = progress?.stamps.filter((s) => s.awardedAt).length ?? 0;
  return (
    <div className="min-h-screen bg-surface">
      <div className="mx-auto flex max-w-lg flex-col gap-3.5 px-5 pb-8 pt-3">
        <header className="flex h-12 items-center gap-1">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to home"
            className="-ml-2.5 flex h-11 w-11 items-center justify-center rounded-full text-on-surface focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
              arrow_back
            </span>
          </button>
          <h1 className="m-0 font-headline text-xl font-bold text-on-surface">Progress</h1>
        </header>

        {progress ? (
          <>
            <TierCard
              tier={progress.tier}
              xpTotal={progress.xpTotal}
              detail={{ streakDays: progress.streak.days, restDays: progress.streak.restDays }}
            />
            {progress.tier.onHold && <OnHoldCard tier={progress.tier} />}
            <div className="flex items-baseline justify-between pt-3">
              <h2 className="m-0 font-headline text-base font-bold text-on-surface">Stamps</h2>
              <span className="font-label text-sm font-bold tabular-nums text-tertiary">
                {earned} of {STAMPS.length}
              </span>
            </div>
            <StampGrid stamps={progress.stamps} />
          </>
        ) : progress === null ? (
          <p className="font-body text-sm text-on-surface-variant">Your progress couldn&apos;t load. Try again in a moment.</p>
        ) : (
          <div aria-hidden="true" className="flex flex-col gap-3.5">
            <div className="h-[330px] animate-pulse rounded-3xl bg-surface-container-high motion-reduce:animate-none" />
            <div className="h-[360px] animate-pulse rounded-3xl bg-surface-container-high motion-reduce:animate-none" />
          </div>
        )}
      </div>
    </div>
  );
}
