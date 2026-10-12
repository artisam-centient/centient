import { describe, it, expect, afterEach } from "vitest";
import { addDays, dayKeysBetween, manilaDayKey, manilaWeekKey, weekDayKeys } from "../time";

const ORIGINAL_TZ = process.env.GAMIFICATION_TZ;

afterEach(() => {
  if (ORIGINAL_TZ === undefined) delete process.env.GAMIFICATION_TZ;
  else process.env.GAMIFICATION_TZ = ORIGINAL_TZ;
});

describe("manilaDayKey", () => {
  it("rolls over at Manila midnight, 16:00Z", () => {
    expect(manilaDayKey(new Date("2026-10-12T15:59:59.999Z"))).toBe("2026-10-12");
    expect(manilaDayKey(new Date("2026-10-12T16:00:00.000Z"))).toBe("2026-10-13");
  });

  it("reads the zone from GAMIFICATION_TZ", () => {
    process.env.GAMIFICATION_TZ = "UTC";
    expect(manilaDayKey(new Date("2026-10-12T16:00:00.000Z"))).toBe("2026-10-12");
  });

  it("falls back to Asia/Manila when GAMIFICATION_TZ is blank", () => {
    process.env.GAMIFICATION_TZ = "";
    expect(manilaDayKey(new Date("2026-10-12T16:00:00.000Z"))).toBe("2026-10-13");
  });
});

describe("manilaWeekKey", () => {
  it("is the Monday of the Manila week", () => {
    // Monday 12 Oct 2026, Manila
    expect(manilaWeekKey(new Date("2026-10-12T01:00:00Z"))).toBe("2026-10-12");
    // Sunday 18 Oct, 23:59 Manila
    expect(manilaWeekKey(new Date("2026-10-18T15:59:59Z"))).toBe("2026-10-12");
  });

  it("turns over Sunday to Monday at Manila midnight", () => {
    // 16:00Z Sunday 18 Oct is 00:00 Monday 19 Oct in Manila
    expect(manilaWeekKey(new Date("2026-10-18T16:00:00Z"))).toBe("2026-10-19");
  });

  it("crosses a month boundary", () => {
    // Sunday 1 Nov 2026 belongs to the week starting Monday 26 Oct
    expect(manilaWeekKey(new Date("2026-11-01T04:00:00Z"))).toBe("2026-10-26");
  });
});

describe("day arithmetic", () => {
  it("adds days across months and years", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("lists the days strictly between two keys", () => {
    expect(dayKeysBetween("2026-10-10", "2026-10-13")).toEqual(["2026-10-11", "2026-10-12"]);
    expect(dayKeysBetween("2026-10-12", "2026-10-13")).toEqual([]);
    expect(dayKeysBetween("2026-10-13", "2026-10-13")).toEqual([]);
  });

  it("lists Monday to Sunday for a week key", () => {
    expect(weekDayKeys("2026-10-26")).toEqual([
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
    ]);
  });
});
