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

describe("getMetaCsvDownloadTip — two rules", () => {
  it("on the 1st recommends Previous Month only", () => {
    const tip = getMetaCsvDownloadTip(new Date("2026-09-01T12:00:00Z"), "UTC");
    expect(tip).toContain("1st");
    expect(tip).toContain("Previous Month");
    expect(tip).not.toContain("Last 30 Days");
    expect(tip).not.toContain("This Month");
  });

  it("on days 2–31 recommends Last 30 Days only (same message on the 2nd and the 15th)", () => {
    for (const iso of ["2026-09-02T12:00:00Z", "2026-09-15T12:00:00Z"]) {
      const tip = getMetaCsvDownloadTip(new Date(iso), "UTC");
      expect(tip).toBe("Export Last 30 Days with Day breakdown.");
      expect(tip).not.toContain("This Month");
      expect(tip).not.toContain("1st");
    }
  });

  it("uses the client timezone for the 1st vs not-1st rule", () => {
    const instant = new Date("2026-09-01T03:00:00Z");
    expect(getMetaCsvDownloadTip(instant, "UTC")).toContain("1st");
    expect(getMetaCsvDownloadTip(instant, "America/New_York")).toBe("Export Last 30 Days with Day breakdown.");
    expect(getMetaCsvDownloadTip(instant, "Asia/Kolkata")).toContain("1st");
  });
});

describe("analyzeCsvDateGuidance", () => {
  it("Sep 1 + Last 30 days CSV missing Aug 1 warns once", () => {
    const rows = daysInclusive("2026-08-02", "2026-08-31");
    const guidance = analyzeCsvDateGuidance(rows, new Date("2026-09-01T12:00:00Z"), "UTC");

    expect(guidance.mtdRange).toEqual({ startIso: "2026-08-01", endIso: "2026-08-31" });
    expect(guidance.warnings).toHaveLength(1);
    expect(guidance.warnings[0]?.kind).toBe("first_of_month");
    expect(guidance.warnings[0]?.missingDateLabel).toBe("August 1");
    expect(guidance.warnings[0]?.suggestedDownload).toBe("previous_month");
    expect(guidance.suggestPreviousMonthReport).toBe(true);
  });

  it("Sep 1 + full August CSV has no post-upload warning", () => {
    const rows = daysInclusive("2026-08-01", "2026-08-31");
    const guidance = analyzeCsvDateGuidance(rows, new Date("2026-09-01T12:00:00Z"), "UTC");

    expect(guidance.warnings).toHaveLength(0);
    expect(guidance.suggestPreviousMonthReport).toBe(false);
  });

  it("Sep 2 + full CSV through Sep 1 has no warning and MTD is one day", () => {
    const rows = daysInclusive("2026-08-03", "2026-09-01");
    const guidance = analyzeCsvDateGuidance(rows, new Date("2026-09-02T12:00:00Z"), "UTC");

    expect(guidance.mtdRange).toEqual({ startIso: "2026-09-01", endIso: "2026-09-01" });
    expect(guidance.warnings).toHaveLength(0);
  });

  it("Sep 5 + CSV starting Sep 2 warns missing September 1 with Last 30 Days", () => {
    const rows = daysInclusive("2026-09-02", "2026-09-04");
    const guidance = analyzeCsvDateGuidance(rows, new Date("2026-09-05T12:00:00Z"), "UTC");

    expect(guidance.warnings).toHaveLength(1);
    expect(guidance.warnings[0]?.kind).toBe("missing_month_start");
    expect(guidance.warnings[0]?.suggestedDownload).toBe("last_30_days");
    expect(guidance.warnings[0]?.missingDateLabel).toBe("September 1");
  });
});
