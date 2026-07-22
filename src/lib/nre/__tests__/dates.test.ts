import { describe, expect, it } from "vitest";
import { formatDateUS, getDateRangeShortLabel, parseDate } from "../dates";

describe("parseDate", () => {
  it("detects Indian DD-MM-YY when the first number > 12", () => {
    expect(parseDate("13-07-2026")).toEqual({ day: 13, month: 7, year: 2026 });
  });

  it("detects US MM-DD-YY when the second number > 12", () => {
    expect(parseDate("07/19/2026")).toEqual({ day: 19, month: 7, year: 2026 });
  });

  it("assumes Indian DD-MM-YY when ambiguous (both <= 12)", () => {
    // "07-08-2026" could be Jul 8 (US) or Aug 7 (Indian) — script always
    // assumes Indian DD-MM-YY in the ambiguous case.
    expect(parseDate("07-08-2026")).toEqual({ day: 7, month: 8, year: 2026 });
  });

  it("expands 2-digit years to 20xx", () => {
    expect(parseDate("13-07-26")).toEqual({ day: 13, month: 7, year: 2026 });
  });

  it("returns null for empty or unparseable input", () => {
    expect(parseDate("")).toBeNull();
    expect(parseDate(null)).toBeNull();
    expect(parseDate("not a date")).toBeNull();
  });
});

describe("formatDateUS", () => {
  it("formats as MM/DD/YYYY", () => {
    expect(formatDateUS("13-07-2026")).toBe("07/13/2026");
  });
});

describe("getDateRangeShortLabel", () => {
  it("shows a single date when start === end", () => {
    expect(getDateRangeShortLabel("13-07-2026", "13-07-2026")).toBe("Jul 13");
  });

  it("shows a same-month range", () => {
    expect(getDateRangeShortLabel("13-07-2026", "19-07-2026")).toBe("Jul 13 - Jul 19");
  });

  it("shows a cross-month range", () => {
    expect(getDateRangeShortLabel("28-06-2026", "04-07-2026")).toBe("Jun 28 - Jul 4");
  });

  it("returns N/A when start is unparseable", () => {
    expect(getDateRangeShortLabel("", "13-07-2026")).toBe("N/A");
  });
});
