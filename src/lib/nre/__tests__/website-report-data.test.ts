import { describe, expect, it } from "vitest";
import {
  buildWebsiteReportData,
  detectWebsiteClientKind,
  emptyGa4OverviewTotals,
  ga4OverviewTotalsFromMetrics,
} from "@/lib/nre/website-report-data";
import {
  estimateWebsiteSlideCount,
  parseWebsiteBreakdownOptions,
  parseWebsiteReportConfig,
  previousPeriodRange,
  resolveWebsiteReportRanges,
} from "@/lib/nre/website-report-config";

describe("website-report-data", () => {
  it("detects ecommerce from revenue", () => {
    const totals = { ...emptyGa4OverviewTotals(), purchaseRevenue: 1000, transactions: 5 };
    expect(detectWebsiteClientKind(totals)).toBe("ecommerce");
  });

  it("detects lead gen from conversions", () => {
    const totals = { ...emptyGa4OverviewTotals(), conversions: 12 };
    expect(detectWebsiteClientKind(totals)).toBe("lead_gen");
  });

  it("builds overview cards with month-over-month change labels", () => {
    const current = ga4OverviewTotalsFromMetrics({
      sessions: 1000,
      totalUsers: 800,
      newUsers: 600,
      engagedSessions: 700,
      engagementRate: 0.7,
      bounceRate: 0.3,
      averageSessionDuration: 120,
      userEngagementDuration: 50000,
      screenPageViews: 2500,
      conversions: 40,
      purchaseRevenue: 0,
      transactions: 0,
    });
    const previous = ga4OverviewTotalsFromMetrics({
      sessions: 800,
      totalUsers: 700,
      newUsers: 500,
      engagedSessions: 560,
      engagementRate: 0.65,
      bounceRate: 0.35,
      averageSessionDuration: 100,
      userEngagementDuration: 40000,
      screenPageViews: 2000,
      conversions: 30,
      purchaseRevenue: 0,
      transactions: 0,
    });

    const report = buildWebsiteReportData({
      propertyId: "123",
      propertyName: "Example Site",
      dateRangeLabel: "Aug 1 – Aug 31",
      comparisonRangeLabel: "Jul 1 – Jul 31",
      currencySymbol: "$",
      current,
      previous,
      channels: [{ channel: "Organic Search", sessions: 400, engagementRate: 0.72, conversions: 10 }],
      topPages: [{ page: "/", sessions: 200, engagementRate: 0.68 }],
    });

    expect(report.kind).toBe("website");
    expect(report.overviewMetrics[0]?.label).toBe("Sessions");
    expect(report.overviewMetrics[0]?.changeLabel).toBe("+25.0%");
    expect(report.clientKind).toBe("lead_gen");
    expect(report.channels).toHaveLength(1);
    expect(report.campaigns).toEqual([]);
  });

  it("builds device and geo rows with share labels", () => {
    const current = ga4OverviewTotalsFromMetrics({
      sessions: 1000,
      totalUsers: 800,
      newUsers: 600,
      engagedSessions: 700,
      engagementRate: 0.7,
      bounceRate: 0.3,
      averageSessionDuration: 120,
      userEngagementDuration: 50000,
      screenPageViews: 2500,
      conversions: 40,
      purchaseRevenue: 0,
      transactions: 0,
    });

    const report = buildWebsiteReportData({
      propertyId: "123",
      propertyName: "Example Site",
      dateRangeLabel: "Aug 1 – Aug 31",
      currencySymbol: "$",
      current,
      channels: [],
      devices: [{ device: "mobile", sessions: 600, engagementRate: 0.65, conversions: 20 }],
      geoLocations: [{ location: "Mumbai", sessions: 240, conversions: 8 }],
      geoDimension: "city",
      topPages: [],
    });

    expect(report.devices[0]?.device).toBe("mobile");
    expect(report.geoCities[0]?.shareLabel).toBe("24.0%");
    expect(report.geoCities[0]?.conversionRateLabel).toBe("3.3%");
  });

  it("respects client kind override", () => {
    const current = ga4OverviewTotalsFromMetrics({ sessions: 100, conversions: 0, purchaseRevenue: 0, transactions: 0 });
    const report = buildWebsiteReportData({
      propertyId: "1",
      propertyName: "Site",
      dateRangeLabel: "Jan 1 – Jan 31",
      currencySymbol: "$",
      current,
      clientKindOverride: "content",
      channels: [],
      topPages: [],
    });
    expect(report.clientKind).toBe("content");
  });
});

describe("website-report-config", () => {
  it("parses legacy geoCities flag", () => {
    expect(parseWebsiteBreakdownOptions({ geoCities: "0" }).geo).toBe(false);
    expect(parseWebsiteBreakdownOptions({ geo: "1", geoDimension: "country" }).geoDimension).toBe("country");
  });

  it("estimates slide count with new breakdowns", () => {
    expect(
      estimateWebsiteSlideCount({
        device: true,
        geo: true,
        geoDimension: "city",
        channels: true,
        campaigns: true,
        sources: false,
        demographics: false,
        operatingSystem: false,
        browser: false,
        topPages: false,
        newVsReturning: false,
        dayOfWeek: false,
        hourOfDay: false,
        conversionEvents: false,
      }),
    ).toBe(7);
  });

  it("resolves last 30 days and previous period", () => {
    const config = parseWebsiteReportConfig({ datePreset: "last_30_days", comparePreviousPeriod: true });
    const { current, previous } = resolveWebsiteReportRanges(config, "UTC", new Date("2026-09-07T12:00:00Z"));
    expect(current.endIso).toBe("2026-09-06");
    expect(previous).toBeDefined();
    expect(previous!.endIso < current.startIso).toBe(true);
  });

  it("computes equal-length previous period", () => {
    const prev = previousPeriodRange({ startIso: "2026-09-01", endIso: "2026-09-07" });
    expect(prev).toEqual({ startIso: "2026-08-25", endIso: "2026-08-31" });
  });
});
