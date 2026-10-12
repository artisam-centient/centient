import type { Progress } from "@/lib/gamification/types";
import { DAILY_GOAL } from "@/lib/gamification/types";
import { formatXp } from "./format";

const STAMP = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

/** "Thu 15 Oct · 8:42 PM" */
function stampOf(at: Date): string {
  const parts = Object.fromEntries(STAMP.formatToParts(at).map((p) => [p.type, p.value]));
  return `${parts.weekday} ${parts.day} ${parts.month} · ${parts.hour}:${parts.minute} ${parts.dayPeriod}`;
}

function Row({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2 font-body text-sm leading-5">
      <span className="text-on-surface-variant">{name}</span>
      <span aria-hidden="true" className="flex-1 border-b-2 border-dotted border-outline-variant" />
      <span className="text-on-surface">{children}</span>
    </div>
  );
}

function Xp({ amount }: { amount: number }) {
  return <span className="font-headline font-extrabold tabular-nums text-tertiary">+{formatXp(amount)}</span>;
}

const Rule = () => <div aria-hidden="true" className="my-0.5 border-t-[1.5px] border-dashed border-outline-variant" />;

interface AcceptedStubProps {
  progress: Progress;
  reward: string;
  symbol: string;
  at: Date;
}

/**
 * The accepted answer as a receipt stub (#201, board 05): what it pays in USDC,
 * in gold, and what it earned in XP, in indigo. XP is never money (ADR-0010).
 */
export default function AcceptedStub({ progress, reward, symbol, at }: AcceptedStubProps) {
  const amount = (kind: Progress["lines"][number]["kind"]) => progress.lines.find((l) => l.kind === kind)?.amount;
  const answer = amount("ANSWER");
  const goal = amount("DAILY_GOAL");
  const milestone = amount("STREAK_MILESTONE");

  return (
    <div className="w-full drop-shadow-[0_8px_18px_rgba(25,28,30,0.08)]">
      <div className="receipt-stub flex flex-col gap-3 bg-surface-container-lowest px-5 py-[26px]">
        <div className="flex flex-col gap-0.5">
          <span className="font-label text-[11px] font-bold uppercase leading-[15px] tracking-[0.2em] text-outline">
            Answer accepted
          </span>
          <time dateTime={at.toISOString()} className="font-body text-xs leading-4 text-on-surface-variant">
            {stampOf(at)}
          </time>
        </div>
        <Row name="Reward">
          <span className="font-headline font-extrabold text-secondary">
            {reward} {symbol}
          </span>
        </Row>
        <Row name="Payout">
          <span className="font-semibold">Pending</span>
        </Row>
        {answer !== undefined && (
          <Row name="XP">
            <Xp amount={answer} />
          </Row>
        )}
        {goal !== undefined && (
          <Row name={`Daily goal, ${DAILY_GOAL} of ${DAILY_GOAL}`}>
            <Xp amount={goal} />
          </Row>
        )}
        {milestone !== undefined && (
          <Row name={`${progress.streak.days}-day streak`}>
            <Xp amount={milestone} />
          </Row>
        )}
        <Rule />
        <div className="flex items-baseline justify-between font-body text-sm leading-5">
          <span className="font-semibold text-on-surface">Total XP</span>
          <span className="font-headline font-extrabold tabular-nums text-tertiary">{formatXp(progress.xpTotal)}</span>
        </div>
        {progress.streak.restEarned && (
          <>
            <Rule />
            <p className="flex items-center gap-2 font-body text-[13px] leading-[18px] text-on-surface-variant">
              <span className="material-symbols-outlined text-[18px] text-tertiary" aria-hidden="true">
                bedtime
              </span>
              Rest day earned. It covers one missed day.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
