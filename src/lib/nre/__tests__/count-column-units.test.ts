import { describe, expect, it } from "vitest";
import { parseCsvText } from "../parse-csv";
import { buildReportData } from "../report-data";
import { sumRawColumnByKeywords } from "../objective";

describe("event counts keep cost and rate columns out of quantities", () => {
  it.each([
    ["Initiate checkout", "Cost per initiate checkout", "initiate checkout"],
    ["Adds to cart", "Cost per adds to cart", "adds to cart"],
    ["Mobile app installs", "Cost per mobile app install", "mobile app install"],
    ["Messaging conversations started", "Cost per messaging conversations started", "messaging conversations started"],
    ["ThruPlays", "Cost per ThruPlay", "thruplay"],
  ])("reads %s without adding %s", (countHeader, costHeader, keyword) => {
    expect(sumRawColumnByKeywords({ [countHeader]: "2", [costHeader]: "50" }, [keyword])).toBe(2);
    expect(sumRawColumnByKeywords({ [costHeader]: "50" }, [keyword])).toBe(0);
  });

  it("ignores count-matching rate and percent headers", () => {
    expect(sumRawColumnByKeywords({
      "Mobile app installs": "2", "Mobile app install rate": "25", "Mobile app installs (%)": "10",
    }, ["mobile app install"])).toBe(2);
  });

  it.each([
    ["Initiate checkout", "Initiate checkout", "Cost per initiate checkout", "INITIATE CHECKOUT"],
    ["Add to cart", "Adds to cart", "Cost per adds to cart", "ADD TO CART"],
  ])("preserves explicit %s Results and $50 CPR through the report builder", (resultType, countHeader, costHeader, label) => {
    const csv = [
      `Campaign name,Ad set name,Day,Result type,Results,Amount spent (USD),${countHeader},${costHeader},Reach,Impressions`,
      `Campaign A,Set A,2026-10-01,${resultType},2,100,2,50,100,200`,
    ].join("\n");
    const data = buildReportData({
      accountName: "Count units regression", currencySymbol: "$", timezone: "UTC", monthlyBudget: null,
      mtdDailyRows: parseCsvText(csv).rows, reportType: "WEEKLY", now: new Date("2026-10-03T12:00:00Z"),
      weeklyRange: { startIso: "2026-10-01", endIso: "2026-10-02" },
    });
    expect(data.mtdRow.resultColumns.find(c => c.label === label)).toMatchObject({ value: "2", cprValue: "$50.00" });
    expect(data.campaignSlides[0].metrics).toMatchObject({ results: "2", cpr: "$50.00" });
  });
});
