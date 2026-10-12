// #203 — the board, names and event-code copy, and how the board and stamps render.
import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import BoardList from "../BoardList";
import StampGrid from "../StampGrid";
import EventCodeCard from "../EventCodeCard";
import {
  boardRowLabel,
  dayRange,
  daysLeft,
  endsLine,
  nameError,
  redeemError,
  tierChip,
  weekHeading,
} from "../social-format";
import { stampCaption } from "../tier-format";
import { STAMPS } from "@/lib/gamification/stamps";
import type { BoardView } from "@/lib/gamification/types";
import type { StampStatus } from "@/lib/gamification/types";

const text = (html: string) =>
  html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

describe("week copy", () => {
  it("names the week by its Monday and says when it ends, Manila time", () => {
    expect(weekHeading("2026-10-12")).toBe("Week of 12 Oct");
    expect(endsLine("2026-10-18")).toBe("Ends Sun 18 Oct, 11:59 PM PHT.");
  });

  it("counts the days left, today included", () => {
    expect(daysLeft("2026-10-18", "2026-10-16")).toBe("3 days left");
    expect(daysLeft("2026-10-18", "2026-10-17")).toBe("2 days left");
    expect(daysLeft("2026-10-18", "2026-10-18")).toBe("Last day");
  });
});

describe("dayRange", () => {
  it("writes an event's days the way board 10 does", () => {
    expect(dayRange("2026-10-10", "2026-10-12")).toBe("10–12 Oct");
    expect(dayRange("2026-10-15", "2026-10-15")).toBe("15 Oct");
    expect(dayRange("2026-10-30", "2026-11-02")).toBe("30 Oct – 2 Nov");
  });
});

describe("tierChip", () => {
  it("climbs the indigo ramp, Starter palest and Expert darkest", () => {
    expect(tierChip(0)).toEqual({ name: "Starter", className: "bg-tertiary-fixed text-on-tertiary-fixed-variant" });
    expect(tierChip(1).className).toBe("bg-tertiary-container text-on-tertiary-fixed");
    expect(tierChip(2).className).toBe("bg-tertiary text-on-tertiary");
    expect(tierChip(3).className).toBe("bg-on-tertiary-fixed text-on-tertiary");
  });
});

describe("error copy", () => {
  it("names the problem and what to do, for every redeem outcome", () => {
    expect(redeemError("unknown_code")).toBe("That code doesn't match an event. Check it and try again.");
    expect(redeemError("already_redeemed")).toBe("You've already added this code.");
    expect(redeemError("ended")).toBe("This event's code has closed.");
    expect(redeemError("not_open")).toBe("This code opens on its event day.");
    expect(redeemError("rate_limited")).toBe("Too many tries. Wait a little, then try again.");
    expect(redeemError("network")).toBe("Couldn't add the code. Check your connection and try again.");
  });

  it("explains a refused name without blaming", () => {
    expect(nameError("too_short")).toBe("Use 3 to 20 characters.");
    expect(nameError("bad_chars")).toBe("Use letters, numbers, dots and underscores.");
    expect(nameError("bad_start")).toBe("Start with a letter.");
    expect(nameError("not_allowed")).toBe("That name isn't allowed. Try another.");
    expect(nameError("name_taken")).toBe("Someone has that name. Try another.");
    expect(nameError("name_retired")).toBe("That name can't be used again. Try another.");
  });
});

describe("boardRowLabel", () => {
  it("reads a row aloud with its rank, name and XP", () => {
    expect(boardRowLabel({ rank: 2, name: null, tier: 3, xp: 545, you: false })).toBe("2nd, Hidden labeler, Expert, 545 XP");
    expect(boardRowLabel({ rank: 6, name: "tala.labels", tier: 1, xp: 330, you: true })).toBe(
      "6th, tala.labels, you, Skilled, 330 XP",
    );
  });
});

const board = (over: Partial<BoardView> = {}): BoardView => ({
  weekKey: "2026-10-12",
  endsDay: "2026-10-18",
  rows: [
    { rank: 1, name: "migs.dela", tier: 2, xp: 610, you: false },
    { rank: 2, name: null, tier: 3, xp: 545, you: false },
    { rank: 3, name: "tala.labels", tier: 1, xp: 330, you: true },
  ],
  you: { rank: 3, xp: 330, placed: true, inTop: true, tier: 1, name: "tala.labels" },
  settings: { displayName: "tala.labels", showOnBoard: true, nameHidden: false },
  bestRank: null,
  ...over,
});

describe("BoardList", () => {
  it("shows names, Hidden labeler, tiers and XP, and marks your row", () => {
    const t = text(renderToStaticMarkup(createElement(BoardList, { board: board() })));
    expect(t).toContain("1 migs.dela Trusted 610 XP");
    expect(t).toContain("2 Hidden labeler Expert 545 XP");
    expect(t).toContain("3 tala.labels · You Skilled 330 XP");
  });

  it("adds your own row under the top rows when you're further down", () => {
    const t = text(
      renderToStaticMarkup(
        createElement(BoardList, {
          board: board({
            rows: board().rows.map((r) => ({ ...r, you: false })),
            you: { rank: 24, xp: 90, placed: true, inTop: false, tier: 0, name: null },
          }),
        }),
      ),
    );
    expect(t).toContain("24 Hidden labeler · You Starter 90 XP");
  });

  it("says why you aren't placed, without red", () => {
    const html = renderToStaticMarkup(
      createElement(BoardList, { board: board({ you: { rank: null, xp: 900, placed: false, inTop: false, tier: 1, name: null } }) }),
    );
    expect(text(html)).toContain("Your quality checks are under 80% this week, so you're not on the board yet. Your 900 XP still counts toward your tier.");
    expect(html).not.toMatch(/error/);
  });

  it("invites the first place on an empty week", () => {
    const t = text(
      renderToStaticMarkup(
        createElement(BoardList, { board: board({ rows: [], you: { rank: null, xp: 0, placed: true, inTop: false, tier: 0, name: null } }) }),
      ),
    );
    expect(t).toContain("No one's on the board yet this week. Answer a task to take the first place.");
  });
});

describe("StampGrid with event stamps", () => {
  const now = new Date("2026-10-15T04:00:00Z");
  const base: StampStatus[] = STAMPS.map((s) => ({ id: s.id, awardedAt: null, progress: s.goal ? { current: 0, target: s.goal.target } : null }));

  it("shows each event stamp with its own title and icon, captioned Event and its day", () => {
    const stamps = [
      ...base,
      { id: "event:abc", awardedAt: "2026-10-10T05:00:00Z", progress: null, event: { title: "BlockQuest Fiesta", icon: "festival" } },
    ];
    const t = text(renderToStaticMarkup(createElement(StampGrid, { stamps, now })));
    expect(t).toContain("BlockQuest Fiesta Event · 10 Oct");
    expect(t).toContain("Event Event code");
  });

  it("captions the locked Top 3 stamp with the best finish", () => {
    const top = base.find((s) => s.id === "top-3-week")!;
    expect(stampCaption("top-3-week", top, now, 6)).toBe("Best: #6");
    expect(stampCaption("top-3-week", top, now, null)).toBe("Weekly top 3");
  });
});

describe("EventCodeCard", () => {
  it("is a labelled form with the board's copy, prefilled from a link", () => {
    const html = renderToStaticMarkup(createElement(EventCodeCard, { initialCode: "WEBINAR1", onRedeemed: () => {} }));
    const t = text(html);
    expect(t).toContain("Event code");
    expect(t).toContain("Got a code at a Centient booth? Add it for that event's stamp.");
    expect(t).toContain("From your link. Tap Add to collect it.");
    expect(html).toContain('value="WEBINAR1"');
    expect(html).toContain('placeholder="e.g. BQF2026"');
  });
});
