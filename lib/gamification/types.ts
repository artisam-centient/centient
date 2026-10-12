// Shapes the XP loop's API returns (#201). Kept free of server imports so client
// components can use them.

export const DAILY_GOAL = 5;

export type XpKindName = "ANSWER" | "QUALITY_CHECK" | "DAILY_GOAL" | "STREAK_MILESTONE" | "CROWD_MATCH";

export interface ProgressLine {
  kind: XpKindName;
  amount: number;
}

/** The `progress` block on an accepted or quality-check-passed submit response. */
export interface Progress {
  lines: ProgressLine[];
  xpGained: number;
  xpTotal: number;
  today: { counted: number; goal: typeof DAILY_GOAL; goalMet: boolean; goalJustMet: boolean };
  streak: {
    days: number;
    best: number;
    restDays: number;
    restEarned: boolean;
    /** Rest days spent covering missed days when today's goal settled the streak. */
    restUsed: number;
    /** Set once, when today's goal starts a new streak after one ended. */
    endedAtDays: number | null;
  };
  /** #202: the labeler's tier after this answer; `tierUp` is set once, on the answer that opened it. */
  tier: TierStatus;
  /** #202: stamps this answer earned. */
  stampsAwarded: string[];
}

export interface TierStatus {
  tier: number;
  onHold: boolean;
  tierUp: number | null;
  /** Passes in a row since a hold began. */
  holdChecksPassed: number;
}

export type WeekDayStatus = "met" | "rest" | "protected" | "today" | "missed" | "open";

/** `GET /api/me/progress`. */
export interface ProgressSummary {
  xpTotal: number;
  xpThisWeek: number;
  today: { dayKey: string; counted: number; goal: typeof DAILY_GOAL; goalMet: boolean };
  week: { dayKey: string; status: WeekDayStatus }[];
  /** `days` is the effective streak: one whose gap can't be covered reads as ended. */
  streak: { days: number; best: number; restDays: number; endedAtDays: number | null };
}

/** #202: the tier card on Home and Progress. */
export interface TierSummary {
  tier: number;
  name: string;
  onHold: boolean;
  holdChecksPassed: number;
  /** Passes in a row that reopen a held tier. */
  reopenAfter: number;
  checks: { passed: number; total: number };
  crowd: { matched: number; total: number };
  activeDays: number;
  answers: number;
  /** The band this tier opened: what the tier-up screen lists. Null for Starter. */
  band: TierBand | null;
  next: {
    tier: number;
    name: string;
    xp: number;
    xpToGo: number;
    /** The most a task in the next tier's band pays, in USDC; null when none is open. */
    payUpTo: string | null;
  } | null;
}

export interface TierBand {
  /** "4–5". */
  difficulty: string;
  /** Live tasks in the band this labeler hasn't answered. */
  tasks: number;
  /** USDC range, e.g. "0.4" and "1.15"; null when none is open. */
  payFrom: string | null;
  payTo: string | null;
  /** "15" or "15–20". */
  xp: string;
}

/** #202: one stamp on Progress. Titles and criteria come from lib/gamification/stamps. */
export interface StampStatus {
  id: string;
  awardedAt: string | null;
  progress: { current: number; target: number } | null;
}

/** #202: added to `GET /api/me/progress`. */
export interface StandingSummary {
  tier: TierSummary;
  stamps: StampStatus[];
}

/** What `GET /api/me/progress` returns since #202. */
export type ProgressView = ProgressSummary & StandingSummary;
