import { readFileSync } from "node:fs";
import JSZip from "jszip";
import { renderPptx } from "../../pptx/render";
import { describe, expect, it } from "vitest";
import { parseCsvText } from "../parse-csv";
import { buildComparisonReportData, buildReportData } from "../report-data";
import { aggregateReach } from "../reach-aggregation";
import { adSetKey } from "../ad-sets";
const csv="Campaign name,Ad set name,Day,Amount spent (USD),Results,Result type,Reach,Impressions,Link clicks\nTraffic,A,2026-11-12,10,10,Link clicks,100,500,10\nTraffic,A,2026-11-13,20,20,Link clicks,200,600,20\nTraffic,B,2026-11-12,5,5,Link clicks,500,600,5\nTraffic,B,2026-11-13,10,10,Link clicks,600,700,10";
const rows=parseCsvText(csv).rows;
const range={startIso:"2026-11-07",endIso:"2026-11-13"};
const base={accountName:"Test",currencySymbol:"$",timezone:"UTC",monthlyBudget:null,mtdDailyRows:rows,now:new Date("2026-11-14T12:00:00Z")};
describe("campaign period API reach never becomes ad-set reach", () => {
 it("retains exact campaign reach while estimating each selected ad set independently", () => {
  const data=buildReportData({...base,weeklyRange:range,selectedAdSets:[adSetKey("Traffic","A"),adSetKey("Traffic","B")],metaCampaignPeriodReach:{byRangeKey:{"2026-11-07:2026-11-13":{traffic:850}}}});
  expect(data.campaignSlides[0].metrics.reach).toBe("850");
  expect(data.campaignSlides[0].ai.reachEstimated).toBe(false);
  for(const slide of data.adSetSlides){
   const own=rows.filter(row=>row.ad_set_name===slide.adSetName);
   expect(slide.metrics.reach).toBe(String(aggregateReach(own,{scope:"adset"})));
   expect(slide.metrics.reach).not.toBe("850");
   expect(slide.dynamicMetrics.find(metric => metric?.key === "reach")?.value).toBe(slide.metrics.reach);
   expect(slide.rowFreq).toBeCloseTo(own.reduce((sum,row)=>sum+Number(row.impressions),0)/aggregateReach(own,{scope:"adset"}));
   expect(slide.ai.reachEstimated).toBe(true);
  }
 });
 it("uses full-month campaign period evidence on monthly campaign cards", () => {
  const data=buildReportData({...base,reportType:"MONTHLY",now:new Date("2026-12-01T12:00:00Z"),metaCampaignPeriodReach:{byRangeKey:{"2026-11-01:2026-11-30":{traffic:900}}}});
  expect(data.campaignSlides[0].metrics.reach).toBe("900");
  expect(data.campaignSlides[0].dynamicMetrics.find(metric => metric?.key === "reach")?.value).toBe("900");
  expect(data.mtdRow.reach).toBe("900");
  expect(data.campaignSlides[0].ai.reachEstimated).toBe(false);
 });
 it("identifies comparison reach as estimated when only daily data is available", () => {
  const data=buildComparisonReportData({...base,periodA:range,periodB:{startIso:"2026-10-31",endIso:"2026-11-06"}});
  expect(data.campaigns[0].metricsA.reach.estimated).toBe(true);
 });
});


it("renders the ad-set estimate and disclosure into the actual PPT cards", async () => {
 const data=buildReportData({...base,weeklyRange:range,selectedAdSets:[adSetKey("Traffic","A"),adSetKey("Traffic","B")],metaCampaignPeriodReach:{byRangeKey:{"2026-11-07:2026-11-13":{traffic:850}}}});
 const zip=await JSZip.loadAsync(await renderPptx({templateBuffer:readFileSync("templates/dark.pptx"),data,currencySymbol:"$"}));
 for(const [index,slide] of data.adSetSlides.entries()){
  const xml=await zip.file(`ppt/slides/slide${3+index}.xml`)!.async("string");
  expect(xml).toContain(`<a:t>${slide.metrics.reach}</a:t>`);
  expect(xml).toContain("REACH (EST.)");
  expect(xml).not.toContain("<a:t>850</a:t>");
 }
});


it("does not mark Google's additive click-backed reach field as estimated audience", () => {
 const data=buildComparisonReportData({...base,platform:"GOOGLE",periodA:range,periodB:{startIso:"2026-10-31",endIso:"2026-11-06"}});
 expect(data.campaigns[0].metricsA.reach.estimated).not.toBe(true);
});
