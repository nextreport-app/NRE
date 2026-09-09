import { describe, expect, it } from "vitest";
import {
  mergeComparisonPeriodRows,
  validateComparisonReportCoverage,
} from "../comparison-coverage";
import type { NreRow } from "../columns";

function row(day: string, campaign: string, spend: string): NreRow {
  return {
    _raw: { Day: day },
    campaign_name: campaign,
    ad_set_name: "Set 1",
    spend,
  };
}

describe("validateComparisonReportCoverage", () => {
  const primaryBounds = { minIso: "2026-08-16", maxIso: "2026-09-14" };
  const supplementalBounds = { minIso: "2026-08-01", maxIso: "2026-08-31" };

  it("accepts month-vs-month when Period B is covered by stored previous month data", () => {
    const result = validateComparisonReportCoverage(
      { startIso: "2026-09-01", endIso: "2026-09-14" },
      { startIso: "2026-08-01", endIso: "2026-08-14" },
      primaryBounds,
      supplementalBounds,
    );
    expect(result.valid).toBe(true);
    expect(result.periodBUsesSupplemental).toBe(true);
  });

  it("rejects month-vs-month when Period B is outside primary CSV and no supplemental exists", () => {
    const result = validateComparisonReportCoverage(
      { startIso: "2026-09-01", endIso: "2026-09-14" },
      { startIso: "2026-08-01", endIso: "2026-08-14" },
      primaryBounds,
      null,
    );
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Period B/i);
  });

  it("accepts week-vs-week when both periods fit the primary CSV", () => {
    const bounds = { minIso: "2026-08-01", maxIso: "2026-09-14" };
    const result = validateComparisonReportCoverage(
      { startIso: "2026-09-08", endIso: "2026-09-14" },
      { startIso: "2026-09-01", endIso: "2026-09-07" },
      bounds,
      null,
    );
    expect(result.valid).toBe(true);
    expect(result.periodBUsesSupplemental).toBeUndefined();
  });
});

describe("mergeComparisonPeriodRows", () => {
  it("fills Period B gaps from supplemental rows without duplicating primary days", () => {
    const primary = [
      row("16-08-2026", "Shoes", "100"),
      row("17-08-2026", "Shoes", "100"),
    ];
    const supplemental = [
      row("01-08-2026", "Shoes", "50"),
      row("16-08-2026", "Shoes", "999"),
    ];
    const merged = mergeComparisonPeriodRows(primary, supplemental, {
      startIso: "2026-08-01",
      endIso: "2026-08-17",
    });
    expect(merged).toHaveLength(3);
    expect(merged.find((r) => r._raw.Day === "01-08-2026")?.spend).toBe("50");
    expect(merged.find((r) => r._raw.Day === "16-08-2026")?.spend).toBe("100");
  });
});
