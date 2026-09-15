import { describe, expect, it } from "vitest";
import { aggregateReach, estimatePeriodReach, sainsburyPeriodReach } from "../reach-aggregation";
import type { MetricRow } from "../types";

function dailyRow(day: string, adSet: string, reach: number, campaign = "Reach Campaign"): MetricRow {
  return {
    campaign_name: campaign,
    ad_set_name: adSet,
    date_start: day,
    reach,
    impressions: reach * 1.25,
    spend: 10,
  };
}

describe("reach-aggregation", () => {
  it("returns a straight sum for a single period-level row", () => {
    expect(aggregateReach([{ reach: 41711 }])).toBe(41711);
  });

  it("applies Sainsbury across days within one ad set", () => {
    const rows = Array.from({ length: 7 }, (_, i) => dailyRow(`2026-09-${8 + i}`, "A", 10_000));
    expect(sainsburyPeriodReach(rows)).toBeCloseTo(37_692, 0);
  });

  it("matches Ads Manager campaign reach for two parallel ad sets (Southaven fixture)", () => {
    const adSet1 = [5227, 5699, 5693, 4589, 5230, 4577, 5220];
    const adSet2 = [4965, 5610, 5330, 4568, 6598, 5051, 5190];
    const rows: MetricRow[] = [
      ...adSet1.map((reach, i) => dailyRow(`2026-09-${8 + i}`, "5xFreq", reach)),
      ...adSet2.map((reach, i) => dailyRow(`2026-09-${8 + i}`, "10xFreq", reach)),
    ];
    const estimated = estimatePeriodReach(rows);
    expect(estimated).toBeGreaterThan(41_000);
    expect(estimated).toBeLessThan(42_500);
    // Plain sum would be 73,547 — must not regress to that.
    expect(estimated).toBeLessThan(50_000);
  });

  it("yields Ads Manager–aligned cost per 1K reach for Southaven-style parallel ad sets", () => {
    const adSet1 = [5227, 5699, 5693, 4589, 5230, 4577, 5220];
    const adSet2 = [4965, 5610, 5330, 4568, 6598, 5051, 5190];
    const spendPerDay = [29.26, 29.26, 29.26, 29.26, 29.26, 29.26, 29.26];
    const rows: MetricRow[] = [
      ...adSet1.map((reach, i) => ({
        ...dailyRow(`2026-09-${8 + i}`, "5xFreq", reach),
        spend: spendPerDay[i]! / 2,
      })),
      ...adSet2.map((reach, i) => ({
        ...dailyRow(`2026-09-${8 + i}`, "10xFreq", reach),
        spend: spendPerDay[i]! / 2,
      })),
    ];
    const reach = estimatePeriodReach(rows);
    const totalSpend = rows.reduce((s, r) => s + (r.spend ?? 0), 0);
    const costPer1k = (totalSpend * 1000) / reach;
    expect(reach).toBeGreaterThan(41_000);
    expect(reach).toBeLessThan(42_500);
    expect(costPer1k).toBeCloseTo(4.91, 0);
  });
});
