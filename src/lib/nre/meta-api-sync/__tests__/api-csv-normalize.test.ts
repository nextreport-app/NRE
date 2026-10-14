import { describe, expect, it } from "vitest";
import {
  formatCtrForManualCsv,
  normalizeDateFormat,
  normalizePercentage,
} from "../api-csv-normalize";
import { META_CSV_HEADERS, insightToManualCsvRow } from "../insight-engine";
import type { MetaInsightRow } from "@/lib/meta-api";

describe("api-csv-normalize", () => {
  it("normalizeDateFormat converts DD-MM-YYYY to YYYY-MM-DD", () => {
    expect(normalizeDateFormat("27-09-2026")).toBe("2026-09-27");
    expect(normalizeDateFormat("2026-09-27")).toBe("2026-09-27");
  });

  it("normalizePercentage handles percent strings and Meta fractions", () => {
    expect(normalizePercentage("6.02%")).toBe(6.02);
    expect(normalizePercentage("0.0602")).toBeCloseTo(6.02);
    expect(normalizePercentage(3.26086957)).toBeCloseTo(3.26086957);
  });

  it("formatCtrForManualCsv never emits a trailing % sign", () => {
    expect(formatCtrForManualCsv("0.0326")).not.toContain("%");
    expect(formatCtrForManualCsv("6.02%")).toBe("6.02");
  });

  it("insightToManualCsvRow uses manual CSV Day, CTR, and CPC (all) column names", () => {
    expect(META_CSV_HEADERS).toContain("CPC (all)");
    expect(META_CSV_HEADERS).not.toContain("CPC (cost per link click)");

    const row: MetaInsightRow = {
      campaign_name: "Test",
      adset_name: "Set",
      date_start: "2026-09-27",
      spend: "23.26",
      ctr: "0.0602",
      cpc: "1.25",
      reach: "100",
      impressions: "200",
      inline_link_clicks: "10",
      frequency: "2",
      actions: [],
      results: [],
      cost_per_result: [],
    };
    const cells = insightToManualCsvRow(row);
    const dayIdx = META_CSV_HEADERS.indexOf("Day");
    const ctrIdx = META_CSV_HEADERS.indexOf("CTR (all)");
    const cpcIdx = META_CSV_HEADERS.indexOf("CPC (all)");
    expect(cells[dayIdx]).toBe("2026-09-27");
    expect(cells[ctrIdx]).toBe("6.02");
    expect(cells[cpcIdx]).toBe("1.25");
  });
});
