import { describe, expect, it } from "vitest";
import { NO_DATA_ROWS_MESSAGE, validateMtdDailyCsv } from "../validate";
import { readRowsWithAutoMap } from "../columns";

const NOW = new Date("2026-07-20T12:00:00Z");

function parse(headers: string[], rows: string[][]) {
  return readRowsWithAutoMap(headers, rows);
}

describe("validateMtdDailyCsv", () => {
  it("passes for a well-formed CSV", () => {
    const { colMap, rows } = parse(
      ["Campaign name", "Ad set name", "Day", "Amount spent (USD)", "Results", "Result type"],
      [["Shoes", "Set 1", "19-07-2026", "100", "5", "Purchase"]],
    );
    const result = validateMtdDailyCsv(colMap, rows, NOW);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("fails when required columns are missing", () => {
    const { colMap, rows } = parse(["Some Column"], [["x"]]);
    const result = validateMtdDailyCsv(colMap, rows, NOW);
    expect(result.valid).toBe(false);
    const fields = result.errors.map((e) => e.field);
    expect(fields).toContain("campaign_name");
    expect(fields).toContain("spend");
    expect(fields).toContain("results");
  });

  it("fails when every campaign name is empty", () => {
    const { colMap, rows } = parse(
      ["Campaign name", "Day", "Amount spent (USD)", "Results"],
      [["", "19-07-2026", "100", "5"]],
    );
    const result = validateMtdDailyCsv(colMap, rows, NOW);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "campaign_name")).toBe(true);
  });

  it("fails when dates are in the future", () => {
    const { colMap, rows } = parse(
      ["Campaign name", "Day", "Amount spent (USD)", "Results"],
      [["Shoes", "25-12-2026", "100", "5"]],
    );
    const result = validateMtdDailyCsv(colMap, rows, NOW);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "date" && e.message.includes("future"))).toBe(true);
  });

  it("fails when the date range spans more than 90 days", () => {
    const { colMap, rows } = parse(
      ["Campaign name", "Day", "Amount spent (USD)", "Results"],
      [
        ["Shoes", "01-01-2026", "100", "5"],
        ["Shoes", "01-06-2026", "100", "5"],
      ],
    );
    const result = validateMtdDailyCsv(colMap, rows, NOW);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "date" && e.message.includes("90 days"))).toBe(true);
  });

  it("passes when campaign name and date are populated but every metric column is blank (paused/zero-spend campaign)", () => {
    const headers = [
      "Campaign name",
      "Ad set name",
      "Day",
      "Amount spent (USD)",
      "Reach",
      "Impressions",
      "Results",
      "Result type",
    ];
    const rows = Array.from({ length: 7 }, (_, i) => {
      const day = `${String(i + 1).padStart(2, "0")}-07-2026`;
      return ["Paused Campaign", "Set A", day, "", "", "", "", ""];
    });
    const { colMap, rows: parsedRows } = parse(headers, rows);
    const result = validateMtdDailyCsv(colMap, parsedRows, new Date("2026-07-23T12:00:00Z"));
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("fails with the same actionable message when rows exist but none have both a campaign name and a resolvable date", () => {
    const { colMap, rows } = parse(
      ["Campaign name", "Day", "Amount spent (USD)", "Results"],
      [
        ["", "19-07-2026", "100", "5"], // has a date, but no campaign name
        ["Real Campaign", "", "50", "2"], // has a campaign name, but no date
      ],
    );
    const result = validateMtdDailyCsv(colMap, rows, NOW);
    expect(result.valid).toBe(false);
    const rowsError = result.errors.find((e) => e.field === "rows");
    expect(rowsError).toBeDefined();
    expect(rowsError!.message).toBe(NO_DATA_ROWS_MESSAGE);
    expect(result.noCampaignData).toBe(true);
  });

  it("fails on an empty CSV with a clear, actionable explanation of likely causes", () => {
    const { colMap, rows } = parse(["Campaign name", "Day", "Amount spent (USD)", "Results"], []);
    const result = validateMtdDailyCsv(colMap, rows, NOW);
    expect(result.valid).toBe(false);
    const rowsError = result.errors.find((e) => e.field === "rows");
    expect(rowsError).toBeDefined();
    expect(rowsError!.message).toBe(NO_DATA_ROWS_MESSAGE);
    expect(rowsError!.message).toContain("Your CSV contains no campaign data");
    expect(rowsError!.message).toContain("Check Meta Ads Manager");
    expect(result.noCampaignData).toBe(true);
  });

  describe("noCampaignData — Previous Month Summary alternative-path signal", () => {
    it("is false for a well-formed, fully valid CSV", () => {
      const { colMap, rows } = parse(
        ["Campaign name", "Ad set name", "Day", "Amount spent (USD)", "Results", "Result type"],
        [["Shoes", "Set 1", "19-07-2026", "100", "5", "Purchase"]],
      );
      const result = validateMtdDailyCsv(colMap, rows, NOW);
      expect(result.noCampaignData).toBe(false);
    });

    it("is false for a genuinely malformed CSV (missing required columns) — never offers the Previous Month Summary alternative for an unrelated failure", () => {
      const { colMap, rows } = parse(["Some Column"], [["x"]]);
      const result = validateMtdDailyCsv(colMap, rows, NOW);
      expect(result.valid).toBe(false);
      expect(result.noCampaignData).toBe(false);
    });

    it("is false for a $0-spend but otherwise well-formed CSV — the Campaigns Paused path handles that case on its own, not this flag", () => {
      const headers = ["Campaign name", "Ad set name", "Day", "Amount spent (USD)", "Reach", "Impressions", "Results", "Result type"];
      const rows = Array.from({ length: 7 }, (_, i) => {
        const day = `${String(i + 1).padStart(2, "0")}-07-2026`;
        return ["Paused Campaign", "Set A", day, "", "", "", "", ""];
      });
      const { colMap, rows: parsedRows } = parse(headers, rows);
      const result = validateMtdDailyCsv(colMap, parsedRows, new Date("2026-07-23T12:00:00Z"));
      expect(result.valid).toBe(true);
      expect(result.noCampaignData).toBe(false);
    });
  });

  it("passes a real-shaped Meta export: ISO 'Day' column plus constant 'Reporting starts/ends' noise (regression)", () => {
    // Reproduces the reported bug report exactly: 22 days of July, each row
    // carrying a per-day ISO "Day" value alongside the export's constant
    // "Reporting starts"/"Reporting ends" range — must validate using Day,
    // and Day must parse correctly as ISO, not blow up into a ~7670 day span.
    const headers = [
      "Campaign name",
      "Day",
      "Reporting starts",
      "Reporting ends",
      "Amount spent (USD)",
      "Results",
    ];
    const rows = Array.from({ length: 22 }, (_, i) => {
      const day = `2026-07-${String(i + 1).padStart(2, "0")}`;
      return ["Shoes", day, "2026-07-01", "2026-07-22", "100", "5"];
    });
    const { colMap, rows: parsedRows } = parse(headers, rows);
    const result = validateMtdDailyCsv(colMap, parsedRows, new Date("2026-07-23T12:00:00Z"));
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("passes with campaign Starts/Ends and export Reporting starts/ends as decoy columns (regression)", () => {
    // Reproduces the exact reported CSV shape: Day (DD-MM-YY, the real
    // per-row date), Starts (campaign start date — constant per campaign),
    // Ends (campaign end date — "Ongoing" text for active campaigns), and
    // Reporting starts/ends (export date range — constant across all rows).
    // Only Day should determine the validated date range.
    const headers = [
      "Campaign name",
      "Day",
      "Starts",
      "Ends",
      "Reporting starts",
      "Reporting ends",
      "Amount spent (USD)",
      "Results",
    ];
    const rows = Array.from({ length: 22 }, (_, i) => {
      const day = `${String(i + 1).padStart(2, "0")}-07-26`;
      return ["Shoes", day, "01-05-26", "Ongoing", "01-07-26", "22-07-26", "100", "5"];
    });
    const { colMap, rows: parsedRows } = parse(headers, rows);
    const result = validateMtdDailyCsv(colMap, parsedRows, new Date("2026-07-23T12:00:00Z"));
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("passes the full real-world Meta daily-export column set (regression)", () => {
    // Exact header set reported by the product owner from a real Meta Ads
    // Manager daily export, including several columns validate.ts must
    // ignore for date/results purposes: Delivery status/level, Attribution
    // setting, Starts/Ends (campaign dates), Meta leads, Landing page views,
    // Cost per landing page view, and Reporting starts/ends.
    const headers = [
      "Campaign name",
      "Ad set name",
      "Day",
      "Delivery status",
      "Delivery level",
      "Reach",
      "Impressions",
      "Frequency",
      "Attribution setting",
      "Result type",
      "Results",
      "Amount spent (USD)",
      "Cost per result",
      "Starts",
      "Ends",
      "CTR (all)",
      "CPC (all)",
      "Link clicks",
      "Meta leads",
      "Landing page views",
      "Cost per landing page view",
      "Reporting starts",
      "Reporting ends",
    ];
    const rows = Array.from({ length: 22 }, (_, i) => {
      const day = `${String(i + 1).padStart(2, "0")}-07-26`;
      return [
        "Shoes",
        "Prospecting",
        day,
        "active",
        "ad",
        "1000",
        "3000",
        "3",
        "",
        "Purchase",
        "5",
        "100",
        "20",
        "01-05-26",
        "Ongoing",
        "1.5",
        "3",
        "50",
        "2",
        "10",
        "5",
        "01-07-26",
        "22-07-26",
      ];
    });
    const { colMap, rows: parsedRows } = parse(headers, rows);
    const result = validateMtdDailyCsv(colMap, parsedRows, new Date("2026-07-23T12:00:00Z"), headers);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(colMap.campaign_name).toBe("Campaign name");
    expect(colMap.spend).toBe("Amount spent (USD)");
    expect(colMap.results).toBe("Results");
    expect(colMap.date_start).toBe("Reporting starts");
  });

  it("includes a diagnostic listing detected headers when every structural check fails", () => {
    const { colMap, rows } = parse(["Some Unrelated Column"], [["x"]]);
    const result = validateMtdDailyCsv(colMap, rows, NOW, ["Some Unrelated Column"]);
    const diagnostic = result.errors.find((e) => e.field === "diagnostic");
    expect(diagnostic).toBeDefined();
    expect(diagnostic!.message).toContain("Some Unrelated Column");
  });

  describe("Fix 7 — specific, actionable error messages", () => {
    it("gives a specific Campaign Name message, not the old generic one", () => {
      const { colMap, rows } = parse(["Day", "Amount spent (USD)", "Results", "Result type"], [["19-07-2026", "100", "5", "Purchase"]]);
      const result = validateMtdDailyCsv(colMap, rows, NOW);
      const err = result.errors.find((e) => e.field === "campaign_name");
      expect(err?.message).toBe(
        "Your CSV is missing the Campaign Name column which is required. Please ensure Campaign Name is included in your download.",
      );
    });

    it("gives a specific Amount Spent message, not the old generic one", () => {
      const { colMap, rows } = parse(["Campaign name", "Day", "Results", "Result type"], [["Shoes", "19-07-2026", "5", "Purchase"]]);
      const result = validateMtdDailyCsv(colMap, rows, NOW);
      const err = result.errors.find((e) => e.field === "spend");
      expect(err?.message).toBe(
        "Your CSV is missing the Amount Spent column. Please add Amount Spent to your column selection in Meta Ads Manager and re-download.",
      );
    });

    it("gives a specific Result Type/Results message pointing at the Download Guide", () => {
      const { colMap, rows } = parse(["Campaign name", "Day", "Amount spent (USD)"], [["Shoes", "19-07-2026", "100"]]);
      const result = validateMtdDailyCsv(colMap, rows, NOW);
      const err = result.errors.find((e) => e.field === "results");
      expect(err?.message).toBe(
        "Your CSV is missing the Result Type column. Without it NextReport cannot detect your campaign objective. Please add Result Type and Results to your columns and re-download. See our Download Guide for the recommended column list.",
      );
    });

    it("flags a CSV with only file-wide Reporting starts/ends (no real per-row Day/Date column) as weekly/monthly totals", () => {
      // A weekly- or monthly-granularity Meta export: every row shares the
      // SAME "Reporting starts"/"Reporting ends" pair, with no per-row Day.
      const headers = ["Campaign name", "Reporting starts", "Reporting ends", "Amount spent (USD)", "Results", "Result type"];
      const rows = [
        ["Shoes", "01-07-2026", "31-07-2026", "3000", "50", "Purchase"],
        ["Boots", "01-07-2026", "31-07-2026", "1500", "20", "Purchase"],
      ];
      const { colMap, rows: parsedRows } = parse(headers, rows);
      const result = validateMtdDailyCsv(colMap, parsedRows, NOW);
      expect(result.valid).toBe(false);
      const err = result.errors.find((e) => e.field === "date_granularity");
      expect(err?.message).toBe(
        "Your CSV appears to use weekly or monthly totals instead of daily data. Please re-download from Meta Ads Manager with the Time Increment set to Day before uploading.",
      );
    });

    it("does not flag a real daily export (per-row Day column) as weekly/monthly totals, even alongside Reporting starts/ends", () => {
      const headers = ["Campaign name", "Day", "Reporting starts", "Reporting ends", "Amount spent (USD)", "Results", "Result type"];
      const rows = Array.from({ length: 7 }, (_, i) => {
        const day = `${String(i + 1).padStart(2, "0")}-07-2026`;
        return ["Shoes", day, "01-07-2026", "07-07-2026", "100", "5", "Purchase"];
      });
      const { colMap, rows: parsedRows } = parse(headers, rows);
      const result = validateMtdDailyCsv(colMap, parsedRows, new Date("2026-07-23T12:00:00Z"));
      expect(result.errors.some((e) => e.field === "date_granularity")).toBe(false);
    });
  });
});
