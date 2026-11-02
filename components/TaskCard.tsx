"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import SubmitButton from "./SubmitButton";
import { REWARD_AMOUNT, REWARD_TOKEN_SYMBOL } from "@/lib/constants";
import { validateReason } from "@/lib/validators";
import { GAMIFICATION_ON } from "@/lib/gamification/flag";
import { TIERS } from "@/lib/gamification/tiers";
import { PHONE_QUERY, useMediaQuery } from "@/lib/use-media-query";

type Side = "A" | "B";

/** How the pair is laid out: side by side or stacked, or one at a time on a phone (board 04). */
export type PairLayout = "pair" | "flip";

interface Task {
  id: string;
  prompt: string;
  responseA: string;
  responseB: string;
  submissionsRemaining?: number | null;
}

interface TaskCardProps {
  task: Task;
  onSubmit: (choice: Side, reason: string) => Promise<void>;
  loading: boolean;
  /** The last submission's failure, announced as an alert beside the submit action. */
  error?: string | null;
  reward?: string;
  tokenSymbol?: string;
  /** #201: what the answer earns in XP if accepted; null when it earns none. */
  xp?: number | null;
  /** #202: the tier whose band holds the task; above Starter it shows a chip. */
  tier?: number;
  /** The answer was accepted in place: the task stays, dimmed and read-only (board 03). */
  answered?: boolean;
}

const SIDES: readonly Side[] = ["A", "B"];
const SWIPE_PX = 48;

/**
 * #35: the pair is a radiogroup. Arrow keys move to the other response and
 * select it, as native radios do (two choices, so every arrow wraps); Space and
 * Enter select the focused one. Anything else — Tab above all — is left alone.
 */
export function choiceForKey(key: string, focused: Side): Side | null {
  switch (key) {
    case "ArrowDown":
    case "ArrowRight":
    case "ArrowUp":
    case "ArrowLeft":
      return focused === "A" ? "B" : "A";
    case " ":
    case "Enter":
      return focused;
  }
  return null;
}

/** The response a horizontal swipe of `dx` by `dy` pixels shows from `side`, or null when it isn't one. */
export function sideForSwipe(dx: number, dy: number, side: Side): Side | null {
  if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return null;
  if (dx < 0 && side === "A") return "B";
  if (dx > 0 && side === "B") return "A";
  return null;
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** One ranking task: holds the chosen response and the reason, and submits them. */
export default function TaskCard({
  task,
  onSubmit,
  loading,
  error = null,
  reward,
  tokenSymbol,
  xp,
  tier,
  answered = false,
}: TaskCardProps) {
  const [choice, setChoice] = useState<Side | null>(null);
  const [reason, setReason] = useState("");
  const isPhone = useMediaQuery(PHONE_QUERY);

  /** Submits only a complete ranking, and never a second one while one is in flight. */
  function handleSubmit() {
    if (!choice || !validateReason(reason) || loading) return;
    onSubmit(choice, reason.trim());
  }

  return (
    <TaskCardView
      task={task}
      choice={choice}
      reason={reason}
      loading={loading}
      error={error}
      reward={reward}
      tokenSymbol={tokenSymbol}
      xp={xp}
      tier={tier}
      layout={isPhone ? "flip" : "pair"}
      answered={answered}
      onChoose={setChoice}
      onReasonChange={setReason}
      onSubmit={handleSubmit}
    />
  );
}

interface TaskCardViewProps {
  task: Task;
  choice: Side | null;
  reason: string;
  loading: boolean;
  error: string | null;
  reward?: string;
  tokenSymbol?: string;
  xp?: number | null;
  tier?: number;
  layout?: PairLayout;
  answered?: boolean;
  onChoose: (side: Side) => void;
  onReasonChange: (reason: string) => void;
  onSubmit: () => void;
}

const PAPER = "rounded-3xl bg-surface-container-lowest shadow-[0_8px_24px_rgba(25,28,30,0.06)]";
const MICRO = "text-xs font-label font-bold uppercase tracking-[0.2em] text-outline";

function TierChip({ tier }: { tier?: number }) {
  // #202 (board 04): read from difficulty alone, so a quality check looks like any task.
  if (!GAMIFICATION_ON || tier === undefined || tier <= 0 || !TIERS[tier]) return null;
  return (
    <span className="flex items-center gap-1 rounded-full bg-tertiary-container px-2 py-[3px] font-label text-[11px] font-bold text-on-tertiary-fixed">
      <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
        lock_open
      </span>
      {TIERS[tier].name} task
    </span>
  );
}

function SideDisc({ side, picked, small = false }: { side: Side; picked: boolean; small?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full font-headline font-extrabold transition-colors duration-200 ${
        small ? "h-7 w-7 text-sm" : "h-8 w-8 text-base"
      } ${picked ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface"}`}
    >
      {side}
    </span>
  );
}

/** The ranking surface for one state, so each state renders on its own in tests. */
export function TaskCardView({
  task,
  choice,
  reason,
  loading,
  error,
  reward,
  tokenSymbol,
  xp,
  tier,
  layout = "pair",
  answered = false,
  onChoose,
  onReasonChange,
  onSubmit,
}: TaskCardViewProps) {
  const displayReward = reward ?? REWARD_AMOUNT;
  const displaySymbol = tokenSymbol ?? REWARD_TOKEN_SYMBOL;
  const radios = useRef<Record<Side, HTMLElement | null>>({ A: null, B: null });
  // Board 04: which response a phone shows, whether B has been opened, and
  // whether the prompt is unfolded once a response is chosen.
  const [viewing, setViewing] = useState<Side>("A");
  const [seenB, setSeenB] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const flip = layout === "flip";

  // Run the shared validation logic locally for immediate user feedback
  const isReasonValid = validateReason(reason);
  // Anything typed that would be refused says why: too short, or too thin.
  const reasonLength = reason.trim().length;
  const reasonError =
    reasonLength === 0 || isReasonValid
      ? null
      : reasonLength < 10
        ? "Write at least 10 characters."
        : "Please enter a meaningful explanation. Avoid spam characters or keyboard mashing.";
  const showReasonError = reasonError !== null;
  const canSubmit = choice !== null && isReasonValid && !loading;
  const text = (side: Side) => (side === "A" ? task.responseA : task.responseB);

  function view(side: Side) {
    setViewing(side);
    if (side === "B") setSeenB(true);
  }

  /** On a phone, the first choice brings the reason field into view. */
  function choose(side: Side) {
    const first = choice === null;
    onChoose(side);
    if (flip && first && typeof window !== "undefined") {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      requestAnimationFrame(() =>
        document.getElementById("reason")?.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" }),
      );
    }
  }

  /** Applies choiceForKey to a keydown on `side`'s radio and moves focus to the result. */
  function handleKeyDown(side: Side, e: KeyboardEvent<HTMLElement>) {
    const next = choiceForKey(e.key, side);
    if (!next) return;
    e.preventDefault();
    choose(next);
    radios.current[next]?.focus();
  }

  function onSwipeStart(e: PointerEvent<HTMLDivElement>) {
    swipe.current = { x: e.clientX, y: e.clientY };
  }

  function onSwipeEnd(e: PointerEvent<HTMLDivElement>) {
    const start = swipe.current;
    swipe.current = null;
    if (!start) return;
    const next = sideForSwipe(e.clientX - start.x, e.clientY - start.y, viewing);
    if (next) view(next);
  }

  /** The props every choice control shares: a radio in a roving tab order. */
  function radioProps(side: Side) {
    const isSelected = choice === side;
    return {
      ref: (el: HTMLElement | null) => {
        radios.current[side] = el;
      },
      id: `choice-${side}`,
      role: "radio" as const,
      "aria-checked": isSelected,
      // Roving tab stop: the checked response, or A before anything is checked.
      tabIndex: (choice ? isSelected : side === "A") ? 0 : -1,
      onClick: () => choose(side),
      onKeyDown: (e: KeyboardEvent<HTMLElement>) => handleKeyDown(side, e),
    };
  }

  if (answered) return <AnsweredTask task={task} choice={choice} reason={reason} tier={tier} />;

  const titleRow = (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="flex min-w-0 items-center gap-2.5">
        <h1 className="font-headline text-xl font-extrabold tracking-[-0.02em] text-on-surface lg:text-2xl">
          Pick the better answer
        </h1>
        {task.submissionsRemaining != null && (
          <span className="rounded-full bg-secondary-container px-2 py-0.5 text-[11px] font-label font-bold text-on-secondary-container">
            {task.submissionsRemaining} remaining
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5 rounded-full bg-surface-container-lowest px-3 py-1.5 shadow-[0_4px_12px_rgba(25,28,30,0.04)]">
        <span
          className="material-symbols-outlined text-[16px] text-secondary"
          style={{ fontVariationSettings: "'FILL' 1" }}
          aria-hidden="true"
        >
          monetization_on
        </span>
        <span className="font-headline text-sm font-extrabold tabular-nums text-secondary">
          {displayReward} {displaySymbol}
        </span>
        {GAMIFICATION_ON && xp != null && (
          <>
            <span aria-hidden="true" className="h-3.5 w-px bg-outline-variant" />
            <span className="font-headline text-sm font-extrabold tabular-nums text-tertiary">+{xp} XP</span>
          </>
        )}
      </div>
    </div>
  );

  // Board 05: on a phone, once a response is chosen the prompt folds to one line.
  const promptFolded = flip && choice !== null && !promptOpen;
  const prompt = promptFolded ? (
    <button
      type="button"
      onClick={() => setPromptOpen(true)}
      aria-expanded={false}
      className={`${PAPER} flex min-h-12 items-center gap-2.5 px-5 py-3.5 text-left focus-visible:ring-2 focus-visible:ring-primary`}
    >
      <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">
        chat
      </span>
      <span className="sr-only">Show the prompt: </span>
      <span className="min-w-0 flex-1 truncate font-body text-sm text-on-surface">{task.prompt}</span>
      <span className="material-symbols-outlined text-[20px] text-outline" aria-hidden="true">
        expand_more
      </span>
    </button>
  ) : (
    <section className={`${PAPER} p-6 lg:p-7`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px] text-primary" aria-hidden="true">
            chat
          </span>
          <span className={MICRO}>The Prompt</span>
        </div>
        <TierChip tier={tier} />
      </div>
      <p className="max-w-[72ch] break-words font-body text-base leading-relaxed text-on-surface lg:text-lg lg:leading-[1.6]">
        {task.prompt}
      </p>
    </section>
  );

  const pair = (
    <div role="radiogroup" aria-label="Which response is better?" className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
      {SIDES.map((side) => {
        const isSelected = choice === side;
        return (
          <div
            key={side}
            {...radioProps(side)}
            aria-labelledby={`choice-${side}-label`}
            aria-describedby={`choice-${side}-text`}
            className={`group flex cursor-pointer flex-col ${PAPER} p-6 outline-none transition-[box-shadow,translate] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface motion-reduce:transition-none ${
              isSelected
                ? "ring-2 ring-primary shadow-[0_12px_32px_rgba(0,109,61,0.12)]"
                : "hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(25,28,30,0.09)]"
            }`}
          >
            <div className="mb-4 flex items-center justify-between gap-2">
              <span className="flex items-center gap-2.5">
                <SideDisc side={side} picked={isSelected} />
                <span id={`choice-${side}-label`} className={MICRO}>
                  Response {side}
                </span>
              </span>
              {isSelected ? (
                <span
                  className="flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-xs font-label font-bold text-on-primary motion-safe:animate-[task-pop_260ms_cubic-bezier(0.16,1,0.3,1)]"
                  aria-hidden="true"
                >
                  <span className="material-symbols-outlined text-[14px]">check</span>
                  Selected
                </span>
              ) : (
                <span aria-hidden="true" className="font-label text-xs text-outline">
                  {wordCount(text(side))} words
                </span>
              )}
            </div>
            <p
              id={`choice-${side}-text`}
              className="mb-5 whitespace-pre-line break-words font-body text-[15px] leading-relaxed text-on-surface"
            >
              {text(side)}
            </p>
            {/* The visible affordance; the card itself is the control. It sits
                at the foot, so the pair's buttons line up side by side. */}
            <span
              aria-hidden="true"
              className={`mt-auto block w-full rounded-full px-4 py-3 text-center text-sm font-label font-bold transition-colors duration-200 ${
                isSelected
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container-high text-on-surface-variant group-hover:bg-surface-container-highest group-hover:text-on-surface"
              }`}
            >
              {isSelected ? `${side} is better` : `Choose ${side}`}
            </span>
          </div>
        );
      })}
    </div>
  );

  // Board 04: one response at a time, flipped by the tabs or a swipe. The
  // choice is its own radiogroup: pinned in thumb reach until a pick, then
  // above the reason so it can still be changed.
  const flipView = (
    <>
      <div role="tablist" aria-label="Responses" className="flex gap-1 rounded-full bg-surface-container-high p-1">
        {SIDES.map((side) => {
          const on = viewing === side;
          return (
            <button
              key={side}
              type="button"
              role="tab"
              id={`tab-${side}`}
              aria-selected={on}
              aria-controls={`panel-${side}`}
              tabIndex={on ? 0 : -1}
              onClick={() => view(side)}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                  e.preventDefault();
                  const other = side === "A" ? "B" : "A";
                  view(other);
                  document.getElementById(`tab-${other}`)?.focus();
                }
              }}
              className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-full font-label text-sm font-bold transition-[background-color,box-shadow] duration-200 focus-visible:ring-2 focus-visible:ring-primary ${
                on ? "bg-surface-container-lowest text-on-surface shadow-[0_2px_8px_rgba(25,28,30,0.08)]" : "text-on-surface-variant"
              }`}
            >
              {choice === side && (
                <span className="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">
                  check
                </span>
              )}
              {side}
              <span className="font-medium text-xs text-outline">{wordCount(text(side))} words</span>
              {side === "B" && !seenB && (
                <span className="h-[7px] w-[7px] rounded-full bg-tertiary">
                  <span className="sr-only">, not read yet</span>
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="touch-pan-y" onPointerDown={onSwipeStart} onPointerUp={onSwipeEnd} onPointerCancel={() => (swipe.current = null)}>
        {SIDES.map((side) => (
          <section
            key={side}
            role="tabpanel"
            id={`panel-${side}`}
            aria-labelledby={`tab-${side}`}
            hidden={viewing !== side}
            className={`${PAPER} p-5 motion-safe:animate-[task-rise_220ms_cubic-bezier(0.16,1,0.3,1)]`}
          >
            <div className="mb-3 flex items-center gap-2.5">
              <SideDisc side={side} picked={choice === side} small />
              <span id={`choice-${side}-label`} className={MICRO}>
                Response {side}
              </span>
            </div>
            <p id={`choice-${side}-text`} className="whitespace-pre-line break-words font-body text-[15px] leading-relaxed text-on-surface">
              {text(side)}
            </p>
            {side === "A" && !seenB && (
              <button
                type="button"
                onClick={() => view("B")}
                className="mt-4 flex min-h-11 items-center gap-1 font-label text-sm font-bold text-primary focus-visible:ring-2 focus-visible:ring-primary"
              >
                Read B
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                  arrow_forward
                </span>
              </button>
            )}
          </section>
        ))}
      </div>
    </>
  );

  const chooseRow = (
    <div role="radiogroup" aria-label="Which response is better?" className="flex gap-2.5">
      {SIDES.map((side) => {
        const isSelected = choice === side;
        return (
          <button
            key={side}
            type="button"
            {...radioProps(side)}
            aria-describedby={`choice-${side}-text`}
            className={`flex h-13 flex-1 items-center justify-center gap-1.5 rounded-full font-label text-[15px] font-bold transition-colors duration-200 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
              isSelected ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface"
            }`}
          >
            {isSelected && (
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                check
              </span>
            )}
            {side} is better
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="flex flex-col gap-4 lg:gap-5">
      {titleRow}
      {prompt}
      {flip ? flipView : pair}

      {flip && !choice && (
        // Pinned like the submit bar, and for the same reason sticky, not fixed.
        <div className="sticky bottom-0 z-30 -mx-4 bg-gradient-to-t from-surface from-70% to-transparent px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-8">
          <p className="mb-2.5 text-center font-body text-xs text-on-surface-variant">
            {seenB ? "You've read both. Which is better?" : "Swipe or tap B to read the other answer."}
          </p>
          {chooseRow}
        </div>
      )}

      {choice && flip && chooseRow}

      {choice && (
        <section className={`${PAPER} p-6 motion-safe:animate-[task-rise_280ms_cubic-bezier(0.16,1,0.3,1)] lg:p-7`}>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <label htmlFor="reason" className="block font-headline text-base font-bold text-on-surface">
              Why is {choice} better?{" "}
              <span id="reason-hint" className="text-xs font-normal text-outline">(min 10 characters)</span>
            </label>
            {/* Visual only: the hint and the error line say the same to a screen reader. */}
            <span
              aria-hidden="true"
              className={`flex shrink-0 items-center gap-1 font-label text-xs font-semibold tabular-nums ${
                isReasonValid ? "text-primary" : "text-outline"
              }`}
            >
              {isReasonValid && (
                <span className="material-symbols-outlined text-[15px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  check_circle
                </span>
              )}
              {reasonLength < 10 ? `${reasonLength} / 10` : `${reasonLength} characters`}
            </span>
          </div>
          <textarea
            id="reason"
            rows={3}
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            aria-invalid={showReasonError}
            aria-describedby={showReasonError ? "reason-hint reason-error" : "reason-hint"}
            placeholder={`Say what ${choice} does that ${choice === "A" ? "B" : "A"} doesn't…`}
            className="min-h-24 w-full resize-y rounded-2xl border-none bg-surface-container-low px-4 py-3 font-body text-[15px] leading-relaxed text-on-surface caret-primary outline-none placeholder:text-on-surface-variant/60 focus:ring-0 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container-lowest lg:min-h-28"
          />

          {showReasonError && (
            <p id="reason-error" className="mt-2 text-xs font-medium text-error">
              {reasonError}
            </p>
          )}
        </section>
      )}

      {choice && (
        // Sticky, not fixed: the bar keeps its own space at the end of the flow,
        // so it never covers the reason field or an error line on a narrow screen.
        // globals.css pads the page's scroll region while it is shown, so tabbing
        // to a choice or the reason scrolls it clear of the bar.
        <div
          data-testid="submit-bar"
          data-sticky-submit
          className="sticky bottom-0 z-30 -mx-4 bg-gradient-to-t from-surface via-surface/95 to-transparent px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6 md:mx-0 md:px-0"
        >
          {/* Mounted before anything goes wrong, so a later message is announced. */}
          <p
            data-testid="submit-error"
            role="alert"
            className="mb-3 empty:hidden rounded-xl bg-error-container px-4 py-3 text-sm font-medium text-on-error-container"
          >{error ?? ""}</p>
          <p data-testid="submit-status" role="status" className="sr-only">{loading ? "Submitting your ranking…" : ""}</p>
          <div className="flex items-center gap-6">
            {/* From md the bar says what is about to be sent beside the action. */}
            <p className="hidden min-w-0 flex-1 font-body text-sm leading-snug text-on-surface-variant md:block">
              <span className="font-semibold text-on-surface">Response {choice}</span>
              {isReasonValid ? ", with your reason. " : ". Add a reason to send it. "}
              Pays{" "}
              <span className="font-headline font-extrabold tabular-nums text-secondary">
                {displayReward} {displaySymbol}
              </span>{" "}
              once accepted.
            </p>
            <div className="w-full md:w-80 md:shrink-0">
              <SubmitButton
                id="submit-ranking"
                label="Submit & Get Paid"
                loadingLabel="Submitting"
                onClick={onSubmit}
                disabled={!canSubmit}
                loading={loading}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Board 03: the task an answer was just accepted for, under the accepted card.
 * Dimmed and inert, so focus and screen readers stay on the card and Next task.
 */
function AnsweredTask({
  task,
  choice,
  reason,
  tier,
}: {
  task: Task;
  choice: Side | null;
  reason: string;
  tier?: number;
}) {
  return (
    <div inert className="flex flex-col gap-4 opacity-55">
      <section className={`${PAPER} px-7 py-5`}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-primary" aria-hidden="true">
              chat
            </span>
            <span className={MICRO}>The Prompt</span>
          </div>
          <TierChip tier={tier} />
        </div>
        <p className="font-body text-base leading-relaxed text-on-surface">{task.prompt}</p>
      </section>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {SIDES.map((side) => (
          <div key={side} className={`${PAPER} px-6 py-5 ${choice === side ? "ring-2 ring-primary" : ""}`}>
            <div className="mb-2.5 flex items-center gap-2.5">
              <SideDisc side={side} picked={choice === side} small />
              <span className={MICRO}>{choice === side ? "Your pick" : `Response ${side}`}</span>
            </div>
            <p className="line-clamp-4 whitespace-pre-line break-words font-body text-[15px] leading-relaxed text-on-surface">
              {side === "A" ? task.responseA : task.responseB}
            </p>
          </div>
        ))}
      </div>
      {reason.trim() && (
        <section className={`${PAPER} px-7 py-4`}>
          <p className="font-body text-sm leading-relaxed text-on-surface-variant">
            <span className="font-semibold text-on-surface">Your reason:</span> {reason.trim()}
          </p>
        </section>
      )}
    </div>
  );
}
