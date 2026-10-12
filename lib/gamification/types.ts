// Shapes the XP loop's API returns (#201). Kept free of server imports so client
// components can use them.

export const DAILY_GOAL = 5;

export type XpKindName = "ANSWER" | "QUALITY_CHECK" | "DAILY_GOAL" | "STREAK_MILESTONE";

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
