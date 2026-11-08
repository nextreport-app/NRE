import { describe, expect, it } from "vitest";
import { parseCsvText } from "../parse-csv";
import { campaignSelectionSpend } from "../campaign-selection-spend";
import { CAMPAIGN_SELECTION_POLICY } from "../campaigns";
const now = new Date("2026-11-08T12:00:00Z");
const rows = parseCsvText('Campaign name,Day,Amount spent (USD),Results,Result type,Reach,Impressions\nCurrent,2026-11-07,4,1,Link clicks,10,100\nSmall,2026-11-06,0.50,1,Link clicks,10,100\nMicro,2026-11-06,0.001,1,Link clicks,10,100\nOld,2026-10-10,100,1,Link clicks,10,100\nZero,2026-11-07,0,0,Link clicks,0,0').rows;
describe("campaign defaults follow report spend, never a fixed currency threshold", () => {
  it("checks every positive amount and keeps zero in-period campaigns available", () => {
    const facts = campaignSelectionSpend(rows,{reportType:"WEEKLY",dateSelection:{mode:"last7"}},"UTC",now);
    expect(facts.selectedCampaigns).toEqual(["Current","Small","Micro"]);
    expect(facts.campaignSpend).toEqual({Current:4,Small:0.5,Micro:0.001,Old:0,Zero:0});
    expect(facts.zeroSpendCampaigns).toEqual(["Old","Zero"]);
    expect(facts.ranges).toEqual([{startIso:"2026-11-01",endIso:"2026-11-07"}]);
  });
  it("resets legacy automatic exclusions once but preserves current-policy exclusions", () => {
    const memory = {campaigns:["Current"],deselected:["Current"]};
    expect(campaignSelectionSpend(rows,{reportType:"WEEKLY"},"UTC",now,memory).selectedCampaigns).toContain("Current");
    expect(campaignSelectionSpend(rows,{reportType:"WEEKLY"},"UTC",now,{...memory,policy:CAMPAIGN_SELECTION_POLICY}).selectedCampaigns).not.toContain("Current");
  });
  it("counts either comparison period, excludes the gap, and never double counts overlap", () => {
    const source = parseCsvText('Campaign name,Day,Amount spent (USD)\nA,2026-10-01,4\nB,2026-11-01,5\nGap,2026-10-15,20\nBoth,2026-11-02,2').rows;
    const facts = campaignSelectionSpend(source,{reportType:"COMPARISON",comparisonPeriodA:{startIso:"2026-10-01",endIso:"2026-10-07"},comparisonPeriodB:{startIso:"2026-11-01",endIso:"2026-11-07"}},"UTC",now);
    expect(facts.selectedCampaigns).toEqual(["A","B","Both"]); expect(facts.campaignSpend.Gap).toBe(0);
    const overlap = campaignSelectionSpend(source,{reportType:"COMPARISON",comparisonPeriodA:{startIso:"2026-11-01",endIso:"2026-11-05"},comparisonPeriodB:{startIso:"2026-11-02",endIso:"2026-11-07"}},"UTC",now);
    expect(overlap.campaignSpend.Both).toBe(2);
  });
  it.each(["MONTHLY","HISTORICAL","DAY_BREAKDOWN","DAILY"] as const)("uses the selected %s range", reportType => {
    const dates = reportType === "DAILY" ? {customStart:"2026-11-06",customEnd:"2026-11-06"} : {customStart:"2026-11-01",customEnd:"2026-11-07"};
    const facts = campaignSelectionSpend(rows,{reportType,dateSelection:{mode:"custom",...dates}},"UTC",now);
    expect(facts.campaignSpend.Old).toBe(0); expect(facts.selectedCampaigns).toContain("Small");
  });
});
