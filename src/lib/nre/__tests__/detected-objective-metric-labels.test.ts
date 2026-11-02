import { describe, expect, it } from "vitest";
import { parseCsvText } from "../parse-csv";
import { buildReportData, buildComparisonReportData } from "../report-data";
import { buildDayBreakdownReportData } from "../day-breakdown-report-data";
import { dailyBaseMetrics, dailyHiddenColumns, dailyMetricIsExcluded, dailyObjectiveMetricKey, expandDailyExclusions } from "../daily-metric-selection";
import { dailyExcludedMetricKeysSchema } from "../../validators/report-wizard";
import { dailyExtraMetricGuide } from "../daily-extra-metrics";
import { buildCampaignObjectiveMap } from "../objective";
import { aggregateRows } from "../aggregate";
import { readFileSync } from "node:fs";
import JSZip from "jszip";
import { renderDayBreakdownPptx } from "../../pptx/render";
const source=parseCsvText(`Campaign name,Day,Amount spent (USD),Results,Result type,Reach,Impressions,Clicks (all),Link clicks\n${Array.from({length:14},(_,index)=>`Example,2026-10-${index+18},10,2,website submission,100,1000,40,20`).join("\n")}`);
const base={accountName:"Example",currencySymbol:"$",timezone:"UTC",monthlyBudget:null,mtdDailyRows:source.rows,now:new Date("2026-11-01T12:00:00Z")};
const lead={resultLabel:"WEBSITE LEADS",costLabel:"COST PER WEBSITE LEAD"};
const purchase={resultLabel:"PURCHASES",costLabel:"COST PER PURCHASE"};
const clicks={resultLabel:"LINK CLICKS",costLabel:"COST PER LINK CLICK"};
describe("detected objective metric names",()=>{
  it("uses Weekly's website-submission classification across all four report formats",()=>{
    const weekly=buildReportData({...base,reportType:"WEEKLY"});
    const monthly=buildReportData({...base,reportType:"MONTHLY"});
    const comparison=buildComparisonReportData({...base,periodA:{startIso:"2026-10-25",endIso:"2026-10-31"},periodB:{startIso:"2026-10-18",endIso:"2026-10-24"}});
    const daily=buildDayBreakdownReportData({...base,dateRange:{startIso:"2026-10-25",endIso:"2026-10-31"}});
    expect(weekly.campaignSlides[0].resultLabel).toBe(lead.resultLabel);
    expect(monthly.campaignSlides[0].resultLabel).toBe(lead.resultLabel);
    expect(comparison.campaigns[0].objective).toBe(lead.resultLabel);
    expect(daily.tableHeaderLabels.resultColumns[0]).toEqual({label:lead.resultLabel,costLabel:lead.costLabel});
    const detected=[...buildCampaignObjectiveMap(aggregateRows(source.rows)).values()];
    expect(dailyBaseMetrics(detected).slice(-2).map(metric=>metric.label)).toEqual([lead.resultLabel,lead.costLabel]);
  });
  it("deduplicates shared objectives and preserves separate labels for three different objectives",()=>{
    const metrics=dailyBaseMetrics([lead,purchase,clicks,lead]);
    expect(metrics).toHaveLength(11);
    expect(new Set(metrics.map(metric=>metric.key)).size).toBe(11);
    expect(metrics.map(metric=>metric.label)).toEqual(expect.arrayContaining([lead.resultLabel,lead.costLabel,purchase.resultLabel,purchase.costLabel,clicks.resultLabel,clicks.costLabel]));
  });
  it("uses the confirmed campaign labels when an objective is corrected",()=>{
    expect(dailyBaseMetrics([purchase]).slice(-2).map(metric=>metric.label)).toEqual([purchase.resultLabel,purchase.costLabel]);
    expect(dailyBaseMetrics([purchase]).map(metric=>metric.label)).not.toContain(lead.resultLabel);
  });
  it("removes one objective's result or cost without removing other objectives",()=>{
    const columns=[lead,purchase,clicks].map(value=>({label:value.resultLabel,costLabel:value.costLabel}));
    const key=dailyObjectiveMetricKey("objective_results",lead.resultLabel);
    expect(dailyHiddenColumns(columns,[key])).toEqual([6]);
    expect(dailyHiddenColumns(columns,[dailyObjectiveMetricKey("objective_cost",purchase.resultLabel)])).toEqual([9]);
    expect(dailyExcludedMetricKeysSchema.safeParse([key]).success).toBe(true);
    const guide=dailyExtraMetricGuide([],columns,[key]);
    expect(guide.map(entry=>entry.term)).not.toContain(lead.resultLabel);
    expect(guide.map(entry=>entry.term)).toContain(lead.costLabel);
    expect(guide.map(entry=>entry.term)).toContain(purchase.resultLabel);
  });
  it("restores a single result metric from older saved group exclusions",()=>{
    const metrics=dailyBaseMetrics([lead,purchase,clicks]);
    const excluded=expandDailyExclusions(["objective_results"],metrics).filter(key=>key!==dailyObjectiveMetricKey("objective_results",lead.resultLabel));
    expect(dailyMetricIsExcluded(dailyObjectiveMetricKey("objective_results",lead.resultLabel),excluded)).toBe(false);
    expect(dailyMetricIsExcluded(dailyObjectiveMetricKey("objective_results",purchase.resultLabel),excluded)).toBe(true);
    expect(dailyHiddenColumns(3,["objective_results"])).toEqual([6,8,10]);
  });
});
describe.each(["dark.pptx","meta-ads-light.pptx"])("objective-specific Daily columns in %s",template=>{
  it("retains purchase columns when website leads is removed",async()=>{
    const parsed=parseCsvText("Campaign name,Day,Amount spent (USD),Results,Result type,Reach,Impressions,Clicks (all),Link clicks\nLeads,2026-10-31,10,2,website submission,100,1000,40,20\nPurchase,2026-10-31,20,1,Purchases,100,1000,40,20");
    const data=buildDayBreakdownReportData({...base,mtdDailyRows:parsed.rows,dateRange:{startIso:"2026-10-31",endIso:"2026-10-31"},dailyExcludedMetricKeys:[dailyObjectiveMetricKey("objective_results",lead.resultLabel)]});
    const output=await renderDayBreakdownPptx({templateBuffer:readFileSync(`templates/${template}`),data,isLightTemplate:template.includes("light")});
    const zip=await JSZip.loadAsync(output);
    const xml=await zip.file("ppt/slides/slide2.xml")!.async("string");
    const header=xml.match(/<a:tr\b[^>]*>[\s\S]*?<\/a:tr>/)![0];
    const labels=[...header.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(match=>match[1]);
    expect(labels).not.toContain(lead.resultLabel);expect(labels).toContain(lead.costLabel);expect(labels).toContain(purchase.resultLabel);expect(labels).toContain(purchase.costLabel);
  });
});
