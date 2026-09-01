import { describe, expect, it } from "vitest";
import { analyzeCsvDateGuidance, getMetaCsvDownloadTip } from "../csv-date-guidance";
import type { NreRow } from "../columns";

function dailyRow(iso: string): NreRow {
  return { _raw: { Day: iso }, campaign_name: "Test" };
}

function daysInclusive(startIso: string, endIso: string): NreRow[] {
  const rows: NreRow[] = [];
  const start = new Date(startIso + "T00:00:00Z");
  const end = new Date(endIso + "T00:00:00Z");
  for (let ts = start.getTime(); ts <= end.getTime(); ts += 24 * 60 * 60 * 1000) {
    const d = new Date(ts);
    const day = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    rows.push(dailyRow(day));
  }
  return rows;
}

describe("getMetaCsvDownloadTip", () => {
  it("on the 1st recommends Previous Month for complete monthly data", () => {
    const tip = getMetaCsvDownloadTip(new Date("2026-09-01T12:00:00Z"));
    expect(tip).toContain("1st");
    expect(tip).toContain("Previous Month");
  });

  it("on days 2–7 recommends Last 30 Days", () => {
    const tip = getMetaCsvDownloadTip(new Date("2026-09-05T12:00:00Z"));
    expect(tip).toContain("Last 30 Days");
    expect(tip).not.toContain("Previous Month");
  });

  it("after day 7 recommends This Month", () => {
    const tip = getMetaCsvDownloadTip(new Date("2026-09-10T12:00:00Z"));
    expect(tip).toContain("This Month");
  });
});

describe("analyzeCsvDateGuidance", () => {
  it("Sep 1 + Last 30 days CSV missing Aug 1 warns and suggests previous-month monthly report", () => {
    const rows = daysInclusive("2026-08-02", "2026-08-31");
    const guidance = analyzeCsvDateGuidance(rows, new Date("2026-09-01T12:00:00Z"));

    expect(guidance.mtdRange).toEqual({ startIso: "2026-08-01", endIso: "2026-08-31" });
    expect(guidance.warnings.some((w) => w.kind === "first_of_month")).toBe(true);
    expect(guidance.warnings.some((w) => w.kind === "missing_month_start")).toBe(true);
    expect(guidance.suggestPreviousMonthReport).toBe(true);
    expect(guidance.warnings.find((w) => w.kind === "missing_month_start")?.missingDateLabel).toBe("August 1");
  });

  it("Sep 1 + full August CSV has no missing-month-start warning", () => {
    const rows = daysInclusive("2026-08-01", "2026-08-31");
    const guidance = analyzeCsvDateGuidance(rows, new Date("2026-09-01T12:00:00Z"));

    expect(guidance.warnings.some((w) => w.kind === "missing_month_start")).toBe(false);
    expect(guidance.suggestPreviousMonthReport).toBe(false);
  });

  it("Sep 1 weekly last 7 ends Aug 25–31", () => {
    const rows = daysInclusive("2026-08-02", "2026-08-31");
    const guidance = analyzeCsvDateGuidance(rows, new Date("2026-09-01T12:00:00Z"));

    expect(guidance.warnings[0]?.weeklyRangeLabel).toContain("August 25");
    expect(guidance.warnings[0]?.weeklyRangeLabel).toContain("31");
  });

  it("Sep 5 + CSV starting Sep 2 warns missing September 1", () => {
    const rows = daysInclusive("2026-09-02", "2026-09-04");
    const guidance = analyzeCsvDateGuidance(rows, new Date("2026-09-05T12:00:00Z"));

    expect(guidance.warnings.some((w) => w.kind === "missing_month_start")).toBe(true);
    expect(guidance.warnings.some((w) => w.kind === "early_month_last30")).toBe(true);
  });
});
