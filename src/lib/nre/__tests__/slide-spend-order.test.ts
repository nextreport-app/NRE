import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { renderPptx } from "../../pptx/render";
import { describe, expect, it } from "vitest";
import { buildReportData, buildComparisonReportData } from "../report-data";
import { adSetKey } from "../ad-sets";
import { orderSlidesBySpend } from "../slide-spend-order";
import type { NreRow } from "../columns";
const now = new Date("2026-11-13T12:00:00Z");
const row = (campaign: string, adset: string, spend: number, day = "2026-11-12"): NreRow => ({
  _raw: { Day: day }, date_start: day, date_end: day, campaign_name: campaign, ad_set_name: adset,
  spend: String(spend), impressions: "1000", reach: "500", results: "10", result_type: "Website leads", link_clicks: "50",
});
const rows = [row("A low", "A tiny", 5), row("A low", "Z larger", 15), row("Z high", "B biggest", 100), row("Z high", "C medium", 40)];
function orderingFixture() {
  return buildReportData({ accountName: "Slide ordering", currencySymbol: "₹", timezone: "UTC", monthlyBudget: null, mtdDailyRows: rows, now, weeklyRange: { startIso: "2026-11-06", endIso: "2026-11-12" }, selectedAdSets: rows.map(r => adSetKey(String(r.campaign_name), String(r.ad_set_name))) });
}
describe("report slide spend sequence", () => {
  it("omits selected zero-period campaigns and ad sets while retaining earlier summary spend", () => {
    const source = [...rows, row("Stopped", "Stopped set", 50, "2026-11-02"), row("Stopped", "Stopped set", 0), row("A low", "Stopped sibling", 30, "2026-11-02"), row("A low", "Stopped sibling", 0)];
    const data = buildReportData({accountName:"Zero spend",currencySymbol:"$",timezone:"UTC",monthlyBudget:null,mtdDailyRows:source,selectedCampaigns:["Stopped","A low","Z high"],selectedAdSets:source.map(r=>adSetKey(String(r.campaign_name),String(r.ad_set_name))),weeklyRange:{startIso:"2026-11-06",endIso:"2026-11-12"},now});
    expect(data.campaignSlides.map(s=>s.campaignName)).toEqual(["Z high","A low"]);
    expect(data.adSetSlides.every(s=>s.ai.spendNum>0)).toBe(true);
    expect(data.adSetSlides.map(s=>s.adSetName)).not.toContain("Stopped sibling");
    expect(data.mtdRow.spend).toBe("$240");
    expect(data.chart?.totalAllSpend).toBe(240);
  });
  it("omits comparison campaigns with no spend in either period", () => {
    const data=buildComparisonReportData({accountName:"Compare",currencySymbol:"$",timezone:"UTC",mtdDailyRows:[...rows,row("Zero","Zero set",0)],selectedCampaigns:["A low","Z high","Zero"],periodA:{startIso:"2026-11-06",endIso:"2026-11-12"},periodB:{startIso:"2026-10-30",endIso:"2026-11-05"},now});
    expect(data.campaigns.map(c=>c.campaignName)).toEqual(["Z high","A low"]);
  });

  it("orders campaign totals and all ad sets by reporting-period spend rather than name", () => {
    const data = orderingFixture();
    expect(data.campaignSlides.map(slide => slide.campaignName)).toEqual(["Z high", "A low"]);
    expect(data.campaignSlides.map(slide => slide.ai.spendNum)).toEqual([140, 20]);
    expect(data.adSetSlides.map(slide => slide.adSetName)).toEqual(["B biggest", "C medium", "Z larger", "A tiny"]);
    expect(data.adSetSlides.map(slide => slide.ai.spendNum)).toEqual([100, 40, 15, 5]);
  });
  it("uses the selected reporting period rather than the rest of the month's spend", () => {
    const data = buildReportData({ accountName: "Period ordering", currencySymbol: "$", timezone: "UTC", monthlyBudget: null, mtdDailyRows: [...rows, row("A low", "A tiny", 10000, "2026-11-01")], now, weeklyRange: { startIso: "2026-11-06", endIso: "2026-11-12" } });
    expect(data.campaignSlides.map(slide => slide.campaignName)).toEqual(["Z high", "A low"]);
  });
  it("orders comparisons by period A spend", () => {
    const data = buildComparisonReportData({ accountName: "Compare", currencySymbol: "$", timezone: "UTC", mtdDailyRows: rows, periodA: { startIso: "2026-11-06", endIso: "2026-11-12" }, periodB: { startIso: "2026-10-30", endIso: "2026-11-05" }, now });
    expect(data.campaigns.map(slide => slide.campaignName)).toEqual(["Z high", "A low"]);
  });
  it("writes campaign and ad set slides in descending spend order in the PPTX itself", async () => {
    const data = orderingFixture();
    // Deliberately reverse archived arrays: the renderer also enforces ordering.
    data.campaignSlides.reverse(); data.adSetSlides.reverse();
    // Older persisted reports may already contain zero-spend detail slides.
    data.campaignSlides.push({...data.campaignSlides[0],campaignName:"Zero campaign",ai:{...data.campaignSlides[0].ai,spendNum:0}});
    data.adSetSlides.push({...data.adSetSlides[0],adSetName:"Zero ad set",ai:{...data.adSetSlides[0].ai,spendNum:0}});
    const originalCampaignOrder = data.campaignSlides.map(slide => slide.campaignName);
    const buffer = await renderPptx({ templateBuffer: fs.readFileSync(path.resolve("templates/dark.pptx")), data, currencySymbol: "₹" });
    const zip = await JSZip.loadAsync(buffer);
    const paths = Object.keys(zip.files).filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name)).sort((a,b) => Number(a.match(/slide(\d+)/)![1]) - Number(b.match(/slide(\d+)/)![1]));
    const xml = await Promise.all(paths.map(name => zip.file(name)!.async("string")));
    const campaigns = xml.filter(slide => slide.includes("(Campaign)")).map(slide => ["A low","Z high"].find(name => slide.includes(`>${name}</a:t>`)));
    const adsets = xml.filter(slide => slide.includes("(Ad Set)")).map(slide => ["A tiny","Z larger","B biggest","C medium"].find(name => slide.includes(`>${name}</a:t>`)));
    expect(campaigns).toEqual(["Z high","A low"]);
    expect(adsets).toEqual(["B biggest","C medium","Z larger","A tiny"]);
    expect(data.campaignSlides.map(slide => slide.campaignName)).toEqual(originalCampaignOrder);
  });
  it("keeps name ties deterministic, month totals last, and the source array unchanged", () => {
    const slides = [{campaignName:"Z",ai:{spendNum:10}}, {campaignName:"Month total",isMonthTotal:true,ai:{spendNum:100}}, {campaignName:"A",ai:{spendNum:10}}, {campaignName:"Zero",ai:{spendNum:0}}, {campaignName:"Refund",ai:{spendNum:-5}}];
    expect(orderSlidesBySpend(slides).map(slide => slide.campaignName)).toEqual(["A","Z","Zero","Refund","Month total"]);
    expect(slides[0].campaignName).toBe("Z");
  });
});
