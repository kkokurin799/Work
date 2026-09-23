import { describe, expect, it } from "vitest";
import { addDays, daysBetween, isWeekdayMorningWindow, moscowToday, parseUserDate } from "./dates";

describe("dates", () => {
  it("formats the Moscow calendar day", () => {
    expect(moscowToday(new Date("2026-03-01T21:30:00Z"))).toBe("2026-03-02");
    expect(moscowToday(new Date("2026-03-01T20:30:00Z"))).toBe("2026-03-01");
  });

  it("adds calendar days across a month boundary", () => {
    expect(addDays("2026-10-25", 14)).toBe("2026-11-08");
    expect(daysBetween("2026-10-10", "2026-10-22")).toBe(12);
    expect(daysBetween("2026-10-10", "2026-10-09")).toBe(-1);
  });

  it("accepts dotted and ISO dates and rejects impossible ones", () => {
    expect(parseUserDate("10.10.2026")).toBe("2026-10-10");
    expect(parseUserDate("2026-10-10")).toBe("2026-10-10");
    expect(parseUserDate("31.02.2026")).toBeNull();
    expect(parseUserDate("10/10/2026")).toBeNull();
  });

  it("opens the digest window on weekday mornings in Moscow", () => {
    expect(isWeekdayMorningWindow(new Date("2026-10-12T06:30:00Z"))).toBe(true);
    expect(isWeekdayMorningWindow(new Date("2026-10-12T10:30:00Z"))).toBe(false);
    expect(isWeekdayMorningWindow(new Date("2026-10-10T07:00:00Z"))).toBe(false);
  });
});
