import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ShareReportView } from "../share-report-view";
import { buildReportData } from "@/lib/nre/report-data";
import { buildShareReportData } from "@/lib/nre/share-report";

function fixture() {
  const rows = [
    { campaign_name: "Form campaign", result_type: "On-Facebook leads", spend: "1534.88", results: "186" },
    { campaign_name: "Click campaign", result_type: "Link clicks", spend: "546.38", results: "2055" },
  ].map(row => ({ ...row, reach: "1000", impressions: "2000", link_clicks: "100", date_start: "2026-10-15", date_end: "2026-10-15", _raw: {} }));
  const report = buildReportData({ accountName: "Express Text", currencySymbol: "$", timezone: "America/Chicago", monthlyBudget: null, mtdDailyRows: rows, now: new Date("2026-11-01T18:00:00Z"), reportType: "MONTHLY", selectedAdSets: [] });
  return buildShareReportData(report, new Map(), new Date("2026-11-17T12:00:00Z"), { currencySymbol: "$" });
}

describe("browser report presentation", () => {
  it("cleans saved mixed-objective chart copy while preserving source figures and the stored report", () => {
    const data = fixture();
    const model = data.chart!.visualSlide!;
    model.panelSubheading = "Top 5 of 7 · Bars show spend (different goals)";
    const before = JSON.stringify(data);
    const html = renderToStaticMarkup(<ShareReportView data={data} clientTimezone="America/Chicago" />);
    expect(html).not.toContain("Bars show spend");
    expect(html).toContain("Top 5 of 7");
    expect(html).not.toContain("Reach can be estimated from daily data; campaign audiences may overlap.");
    expect(html).toContain("META ADS");
    expect(html).toContain("Meta Form Leads - ");
    expect(html).toContain("Link Clicks - ");
    expect(html).toContain("73.7% of spend");
    expect(html).toContain("26.3% of spend");
    expect(html).toContain("$1,534.88");
    expect(html).toContain("$546.38");
    expect(JSON.stringify(data)).toBe(before);
  });

  it("uses the PPT definitions for Meta cost and rate metrics instead of generic fallbacks", () => {
    const data = fixture();
    data.metricGuide = [{ term: "CPLC", explanation: "" }, { term: "CTR (ALL)", explanation: "" }];
    const html = renderToStaticMarkup(<ShareReportView data={data} />);
    expect(html).toContain("Spend divided by link clicks. This differs from CPC (all).");
    expect(html).not.toContain("Cplc delivered through your ads");
    expect(html).toContain("All ad clicks divided by impressions");
  });
});
