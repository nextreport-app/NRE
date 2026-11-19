import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ShareReportView } from "../share-report-view";
import { buildReportData } from "@/lib/nre/report-data";
import {adSetKey} from "@/lib/nre/ad-sets";
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

it("preserves estimated reach on campaign/ad-set browser cards and keeps names readable on mobile",()=>{
  const rows=Array.from({length:7},(_,i)=>({campaign_name:"Form campaign",ad_set_name:"Forms",result_type:"On-Facebook leads",spend:"10",results:"2",reach:"100",impressions:"200",clicks_all:"10",link_clicks:"8",landing_page_views:"3",date_start:`2026-11-${12+i}`,date_end:`2026-11-${12+i}`,_raw:{}}));
  const report=buildReportData({accountName:"Test",currencySymbol:"$",timezone:"UTC",monthlyBudget:null,mtdDailyRows:rows,selectedAdSets:[adSetKey("Form campaign","Forms")],now:new Date("2026-11-19T12:00:00Z"),reportType:"WEEKLY"});
  expect(report.campaignSlides[0].ai.reachEstimated).toBe(true);
  const data=buildShareReportData(report,new Map());
  expect(data.campaigns[0].reachEstimated).toBe(true);
  expect(data.adSets[0].reachEstimated).toBe(true);
  data.adSets[0].aiSummary = "This ad set produced results.";
  const html=renderToStaticMarkup(<ShareReportView data={data}/>);
  expect(html).toContain("REACH (EST.)");
  expect(html.match(/Reach estimated from daily data\./g)).toHaveLength(2);
  expect(html).toContain("Ad Set Summary");
  expect(html).toContain("[overflow-wrap:anywhere]");
  expect(html).not.toMatch(/class="[^"]*truncate[^"]*"[^>]*>META FORM LEADS/);
  const exact={...data,campaigns:data.campaigns.map(c=>({...c,reachEstimated:false})),adSets:data.adSets.map(a=>({...a,reachEstimated:false}))};
  expect(renderToStaticMarkup(<ShareReportView data={exact}/>)).not.toContain("REACH (EST.)");
});

it("labels the previous month in the browser without changing stored table data",()=>{
  const data=fixture();data.reportType="WEEKLY";
  data.periodRow={...data.periodRow,hasData:true,monthLabel:"Oct 1 - 31",sameMonthAsCurrentMTD:false};
  data.mtdRow={...data.mtdRow,monthLabel:"Nov 1 - 18"};
  const before=JSON.stringify(data),html=renderToStaticMarkup(<ShareReportView data={data}/>);
  expect(html).toContain('class="block">Previous month</span>');
  expect(html).toContain('class="block">Oct 1 - 31</span>');
  expect(JSON.stringify(data)).toBe(before);
});

it("shows an enabled cover budget alongside branding and omits it when disabled",()=>{
 const data=fixture();data.cover.budgetSummary="Monthly Ad Budget: $1,227.06 of $1,500 used (82%) — 11 days remaining";data.agencyName="NextReport";data.reportBranding={mode:"nextreport",agencyName:"NextReport"};
 const before=JSON.stringify(data);const html=renderToStaticMarkup(<ShareReportView data={data}/>);
 expect(html).toContain(data.cover.budgetSummary);expect(html).toContain("Prepared by NextReport");expect(JSON.stringify(data)).toBe(before);
 expect(renderToStaticMarkup(<ShareReportView data={{...data,cover:{...data.cover,budgetSummary:""}}}/>)).not.toContain("Monthly Ad Budget:");
});
