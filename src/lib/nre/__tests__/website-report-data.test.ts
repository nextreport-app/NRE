import { describe, expect, it } from "vitest";
import {
  buildWebsiteReportData,
  detectWebsiteClientKind,
  emptyGa4OverviewTotals,
  ga4OverviewTotalsFromMetrics,
} from "@/lib/nre/website-report-data";

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
  });
});
