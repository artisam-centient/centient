"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import TaskCard from "./TaskCard";
import EarningsBadge from "./EarningsBadge";
import WalletChip from "./WalletChip";
import TaskRail, { type RecentAnswers } from "./TaskRail";
import { REWARD_AMOUNT, REWARD_TOKEN_SYMBOL } from "@/lib/constants";
import { GAMIFICATION_ON } from "@/lib/gamification/flag";
import { DAILY_GOAL, type ProgressView } from "@/lib/gamification/types";
import { DESKTOP_QUERY, useMediaQuery } from "@/lib/use-media-query";
import TodayStrip from "./gamification/TodayStrip";

const RECENT_COUNT = 5;

export interface WorkspaceTask {
  id: string;
  prompt: string;
  responseA: string;
  responseB: string;
  submissionsRemaining?: number | null;
  rewardDisplay?: string;
  rewardSymbol?: string;
  xp?: number | null;
  tier?: number;
}

/** An answer accepted on this task, shown in place of the success screen from 1024px. */
export interface AnsweredInPlace {
  submissionId: string | null;
  at: Date;
  /** XP the answer earned; null when none was recorded. */
  xpGained: number | null;
}

interface TaskWorkspaceProps {
  /** Null while the next task loads: the workspace shows its skeleton. */
  task: WorkspaceTask | null;
  wallet: string | null;
  totalEarned: string;
  progress?: ProgressView | null;
  submitting: boolean;
  submitError: string | null;
  onSubmit: (choice: "A" | "B", reason: string) => Promise<void>;
  answered?: AnsweredInPlace | null;
  onNext: () => void;
  onOpenAccount: () => void;
  explorerUrl: string;
}

/**
 * The task screen: the ranking surface with its session panel. From 1024px the
 * panel is a sticky rail beside the task, the pair sits side by side and an
 * accepted answer is confirmed in place; below that the panel opens as a sheet
 * from the header's Session button.
 */
export default function TaskWorkspace({
  task,
  wallet,
  totalEarned,
  progress,
  submitting,
  submitError,
  onSubmit,
  answered = null,
  onNext,
  onOpenAccount,
  explorerUrl,
}: TaskWorkspaceProps) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [recent, setRecent] = useState<RecentAnswers>({ state: "loading" });
  const loadedFor = useRef<string | null>(null);

  const loadRecent = useCallback(async () => {
    setRecent((prev) => (prev.state === "ready" ? prev : { state: "loading" }));
    try {
      const res = await fetch("/api/me/submissions?page=1");
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      setRecent({ state: "ready", items: (data.submissions ?? []).slice(0, RECENT_COUNT) });
    } catch {
      setRecent({ state: "error" });
    }
  }, []);

  // Once per task and once per accepted answer, and only when the panel can be
  // seen: the rail on desktop, or the sheet once it is opened on a phone.
  const loadKey = task ? `${task.id}:${answered?.submissionId ?? ""}` : null;
  useEffect(() => {
    if (!loadKey || (!isDesktop && !sheetOpen)) return;
    if (loadedFor.current === loadKey) return;
    loadedFor.current = loadKey;
    void loadRecent();
  }, [isDesktop, sheetOpen, loadKey, loadRecent]);

  const reward = task?.rewardDisplay ?? REWARD_AMOUNT;
  const symbol = task?.rewardSymbol ?? REWARD_TOKEN_SYMBOL;

  const openAccount = useCallback(() => {
    setSheetOpen(false);
    onOpenAccount();
  }, [onOpenAccount]);

  const rail = (inSheet: boolean) => (
    <TaskRail
      taskLoading={!task}
      reward={reward}
      symbol={symbol}
      xp={task?.xp}
      tier={task?.tier}
      submissionsRemaining={task?.submissionsRemaining}
      totalEarned={totalEarned}
      progress={progress}
      recent={recent}
      highlightId={answered?.submissionId ?? null}
      onRetryRecent={() => void loadRecent()}
      explorerUrl={explorerUrl}
      onOpenAccount={openAccount}
      wallet={inSheet ? wallet : undefined}
    />
  );

  const chipButton =
    "rounded-full transition-transform duration-200 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

  return (
    <div className="relative min-h-screen bg-surface">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -right-[10%] -top-[25%] h-[60vw] w-[60vw] rounded-full bg-primary/5 blur-[110px]" />
        <div className="absolute -left-[15%] top-[45%] h-[50vw] w-[50vw] rounded-full bg-secondary/5 blur-[100px]" />
        {GAMIFICATION_ON && (
          <div className="absolute -right-[20%] top-[60%] h-[50vw] w-[50vw] rounded-full bg-tertiary/[0.07] blur-[110px]" />
        )}
      </div>

      <header className="sticky top-0 z-40 w-full bg-surface-container-low">
        <div
          className={`mx-auto flex w-full max-w-[84rem] items-center justify-between gap-3 px-4 lg:px-8 ${
            GAMIFICATION_ON ? "pb-2.5 pt-3.5 lg:pb-3.5" : "py-3.5"
          }`}
        >
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="" width={32} height={32} priority className="select-none" />
            <span className="text-xl font-headline font-extrabold tracking-tighter text-primary">Centient</span>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onOpenAccount} aria-label="View account" className={`hidden sm:block ${chipButton}`}>
              <WalletChip address={wallet} />
            </button>
            <button type="button" onClick={onOpenAccount} aria-label="View account" className={chipButton}>
              <EarningsBadge totalEarned={totalEarned} />
            </button>
            {!isDesktop && (
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={sheetOpen}
                className={`relative flex h-9 items-center gap-1.5 bg-surface-container-lowest pl-2.5 pr-3 font-label text-sm font-bold text-on-surface shadow-[0_4px_12px_rgba(25,28,30,0.05)] after:absolute after:-inset-1.5 ${chipButton}`}
              >
                <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">
                  space_dashboard
                </span>
                Session
              </button>
            )}
          </div>
        </div>
        {GAMIFICATION_ON && progress && (
          <div className="mx-auto w-full max-w-[84rem] lg:hidden">
            <TodayStrip counted={progress.today.counted} streakDays={progress.streak.days} />
          </div>
        )}
      </header>

      <div className="relative z-10 mx-auto w-full max-w-[84rem] px-4 py-6 lg:grid lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start lg:gap-8 lg:px-8 lg:py-8 xl:grid-cols-[minmax(0,1fr)_22rem] xl:gap-10">
        <main className="mx-auto flex w-full min-w-0 max-w-lg flex-col gap-5 md:max-w-4xl lg:max-w-none">
          {!task ? (
            <TaskSkeleton />
          ) : (
            <>
              {answered && (
                <AcceptedPanel
                  reward={reward}
                  symbol={symbol}
                  answered={answered}
                  todayCounted={GAMIFICATION_ON && progress ? progress.today.counted : null}
                  onNext={onNext}
                />
              )}
              <TaskCard
                key={task.id}
                task={task}
                onSubmit={onSubmit}
                loading={submitting}
                error={submitError}
                reward={task.rewardDisplay}
                tokenSymbol={task.rewardSymbol}
                xp={task.xp}
                tier={task.tier}
                answered={answered !== null}
              />
            </>
          )}
        </main>
        {isDesktop && (
          <aside
            aria-label="Your session"
            className="task-rail sticky top-[5.75rem] -mr-2 max-h-[calc(100dvh-7.25rem)] overflow-y-auto overscroll-contain pb-2 pr-2"
          >
            {rail(false)}
          </aside>
        )}
      </div>

      {!isDesktop && <SessionSheet open={sheetOpen} onClose={() => setSheetOpen(false)}>{rail(true)}</SessionSheet>}
    </div>
  );
}

/** A receipt row inside the accepted card. */
function Row({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2 font-body text-sm leading-5">
      <span className="text-on-surface-variant">{name}</span>
      <span aria-hidden="true" className="flex-1 border-b-2 border-dotted border-outline-variant" />
      <span className="font-semibold text-on-surface">{children}</span>
    </div>
  );
}

/**
 * Board 03: the accepted answer, confirmed above the task it answered, with
 * Next task focused so Enter moves on. Tier-up, quality-check and failure
 * screens still take over the page.
 */
function AcceptedPanel({
  reward,
  symbol,
  answered,
  todayCounted,
  onNext,
}: {
  reward: string;
  symbol: string;
  answered: AnsweredInPlace;
  todayCounted: number | null;
  onNext: () => void;
}) {
  const next = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    next.current?.focus();
  }, []);
  const time = answered.at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  return (
    <section aria-labelledby="accepted-heading" className="flex flex-col gap-4 motion-safe:animate-[task-rise_320ms_cubic-bezier(0.16,1,0.3,1)]">
      <div className="flex items-center gap-2.5">
        <h1 id="accepted-heading" className="font-headline text-2xl font-extrabold tracking-[-0.02em] text-on-surface">
          Answer accepted
        </h1>
        <span className="flex items-center gap-1 font-label text-sm font-semibold text-primary">
          <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">
            verified
          </span>
          {time}
        </span>
      </div>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-6 rounded-[1.75rem] bg-surface-container-lowest p-7 shadow-[0_0_0_2px_rgba(0,109,61,0.12),0_16px_40px_-12px_rgba(0,109,61,0.25)] xl:grid-cols-[auto_minmax(0,1fr)_auto]">
        <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-container shadow-[0_12px_40px_-12px_rgba(0,109,61,0.5)] motion-safe:animate-[task-pop_360ms_cubic-bezier(0.16,1,0.3,1)]">
          <span className="material-symbols-outlined text-[40px] text-white" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">
            check
          </span>
        </span>
        <div className="flex flex-col gap-2.5">
          <p className="font-headline text-[22px] font-bold text-on-surface">
            <span className="font-extrabold text-secondary">{`+${reward} ${symbol}`}</span> on its way
          </p>
          <div className="flex max-w-[30rem] flex-col gap-1.5">
            <Row name="Payout">
              <span className="flex items-center gap-1 text-outline">
                <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
                  schedule
                </span>
                Pending
              </span>
            </Row>
            {GAMIFICATION_ON && answered.xpGained !== null && (
              <Row name="XP">
                <span className="font-headline font-extrabold tabular-nums text-tertiary">+{answered.xpGained}</span>
              </Row>
            )}
            {todayCounted !== null && (
              <Row name="Today">
                <span className="tabular-nums">
                  {Math.min(todayCounted, DAILY_GOAL)} of {DAILY_GOAL}
                </span>
              </Row>
            )}
          </div>
        </div>
        <button
          ref={next}
          type="button"
          onClick={onNext}
          className="col-span-2 flex h-16 items-center justify-center gap-2 rounded-full bg-gradient-to-br from-primary to-primary-container px-7 font-label text-lg font-bold text-white shadow-[0_8px_24px_rgba(0,109,61,0.2)] transition-all duration-200 hover:shadow-[0_12px_32px_rgba(0,109,61,0.3)] active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container-lowest xl:col-span-1"
        >
          Next task
          <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
            arrow_forward
          </span>
        </button>
      </div>
    </section>
  );
}

/** Board 08: the workspace holds its shape while the next task loads. */
function TaskSkeleton() {
  const bar = "rounded-lg bg-surface-container-high motion-safe:animate-pulse";
  return (
    <div aria-busy="true" className="flex flex-col gap-4 lg:gap-5">
      <p role="status" className="sr-only">
        Loading the next task…
      </p>
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-headline text-xl font-extrabold tracking-[-0.02em] text-on-surface lg:text-2xl">
          Pick the better answer
        </h1>
        <span className={`h-8 w-36 !rounded-full ${bar}`} />
      </div>
      <div className="flex flex-col gap-3 rounded-3xl bg-surface-container-lowest p-6 shadow-[0_8px_24px_rgba(25,28,30,0.06)] lg:p-7">
        <span className={`h-3.5 w-28 ${bar}`} />
        <span className={`h-[18px] w-[92%] ${bar}`} />
        <span className={`h-[18px] w-[64%] ${bar}`} />
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
        {(["A", "B"] as const).map((side) => (
          <div
            key={side}
            className="flex min-h-56 flex-col gap-3 rounded-3xl bg-surface-container-lowest p-6 shadow-[0_8px_24px_rgba(25,28,30,0.06)] md:min-h-80"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-container-high font-headline text-base font-extrabold text-outline">
                {side}
              </span>
              <span className={`h-3 w-24 ${bar}`} />
            </div>
            <span className={`h-3.5 ${bar}`} />
            <span className={`h-3.5 w-[92%] ${bar}`} />
            <span className={`h-3.5 w-[78%] ${bar}`} />
            <span className={`mt-auto h-11 !rounded-full ${bar}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The session panel on a phone: a native modal dialog docked to the bottom
 * edge, so focus stays inside it, Escape closes it and focus returns to the
 * Session button. A tap on the scrim closes it too.
 */
function SessionSheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="session-sheet-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="task-sheet fixed inset-x-0 bottom-0 top-auto m-0 max-h-[88dvh] w-full max-w-none overflow-hidden rounded-t-3xl bg-surface p-0 text-on-surface shadow-[0_-12px_40px_rgba(25,28,30,0.12)] backdrop:bg-on-surface/30 open:motion-safe:animate-[task-sheet-up_320ms_cubic-bezier(0.16,1,0.3,1)] sm:mx-auto sm:max-w-lg"
    >
      <div className="flex max-h-[88dvh] flex-col">
        <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-3">
          <span aria-hidden="true" className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-outline-variant" />
          <h2 id="session-sheet-title" className="pt-3 font-headline text-lg font-extrabold tracking-[-0.02em]">
            Your session
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="mt-2 flex h-11 w-11 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
              close
            </span>
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-1">
          {children}
        </div>
      </div>
    </dialog>
  );
}
