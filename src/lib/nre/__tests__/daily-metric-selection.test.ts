import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import JSZip from "jszip";
import { DAILY_BASE_METRIC_KEYS, dailyHiddenColumns, projectDailyGrid } from "../daily-metric-selection";
import { dailyExcludedMetricKeysSchema } from "../../validators/report-wizard";
import { buildDayBreakdownReportData } from "../day-breakdown-report-data";
import { buildHistoricalComparisonTableGrid } from "../report-data";
import { parseCsvText } from "../parse-csv";
import { buildDayBreakdownShareReportData } from "../share-report";
import { renderDayBreakdownPptx } from "../../pptx/render";
const source=parseCsvText("Campaign name,Day,Amount spent (USD),Results,Result type,Impressions,Reach,Clicks (all),Link clicks\nExample,2026-10-31,10,2,Website leads,1000,100,40,20");
const base={accountName:"Example",currencySymbol:"$",timezone:"UTC",mtdDailyRows:source.rows,dateRange:{startIso:"2026-10-31",endIso:"2026-10-31"}};
describe("Daily removable base metrics",()=>{
  it("requires one main metric and rejects unknown exclusion keys",()=>{
    expect(dailyExcludedMetricKeysSchema.safeParse([...DAILY_BASE_METRIC_KEYS]).success).toBe(false);
    expect(dailyExcludedMetricKeysSchema.safeParse(["unknown"]).success).toBe(false);
    expect(dailyExcludedMetricKeysSchema.safeParse(["spend","reach"]).success).toBe(true);
  });
  it("removes results and costs independently for every campaign objective",()=>{
    expect(dailyHiddenColumns(3,["objective_results"])).toEqual([6,8,10]);
    expect(dailyHiddenColumns(3,["objective_cost"])).toEqual([7,9,11]);
  });
  it("keeps calculations intact while saved share tables omit removed columns",()=>{
    const plain=buildDayBreakdownReportData(base);
    const data=buildDayBreakdownReportData({...base,dailyExcludedMetricKeys:["reach","objective_cost"]});
    expect(data.dayRows).toEqual(plain.dayRows);
    const share=buildDayBreakdownShareReportData(data);
    expect(share.dailyExcludedMetricKeys).toEqual(["reach","objective_cost"]);
    const grid=projectDailyGrid(buildHistoricalComparisonTableGrid(data.dayRows,data.tableHeaderLabels),1,share.dailyExcludedMetricKeys);
    expect(grid[0]).not.toContain("Reach");
    expect(grid[0]).not.toContain("COST PER WEBSITE LEAD");
    expect(grid[0][0]).toBe("Date");
    expect(share.metricGuide.some(metric=>metric.term==="REACH")).toBe(false);
  });
});
describe.each(["dark.pptx","meta-ads-light.pptx"])("Daily metric selection in %s",template=>{
  it.each([...DAILY_BASE_METRIC_KEYS.map(key=>({excluded:[key]})), {excluded:DAILY_BASE_METRIC_KEYS.slice(0,6)}])("hides $excluded in actual native table columns",async ({excluded})=>{
    const data=buildDayBreakdownReportData({...base,dailyExcludedMetricKeys:excluded});
    const output=await renderDayBreakdownPptx({templateBuffer:readFileSync(`templates/${template}`),data,isLightTemplate:template.includes("light")});
    const zip=await JSZip.loadAsync(output);
    const xml=await zip.file("ppt/slides/slide2.xml")!.async("string");
    const row=xml.match(/<a:tr\b[^>]*>[\s\S]*?<\/a:tr>/)![0];
    const labels=[...row.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(match=>match[1]);
    const expected=projectDailyGrid(buildHistoricalComparisonTableGrid(data.dayRows,data.tableHeaderLabels),1,excluded)[0];
    expect(labels).toEqual(expected);
    expect(await zip.file("ppt/slides/slide3.xml")!.async("string")).toContain("METRIC ABBREVIATION GUIDE");
  });
});
