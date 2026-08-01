import { describe, expect, it } from "vitest";
import { buildGoogleColumnMap, detectPlatform, readGoogleRowsWithAutoMap } from "../google-columns";

describe("buildGoogleColumnMap", () => {
  it("maps a realistic Google Ads Editor export's headers to the right fields", () => {
    const headers = [
      "Campaign",
      "Ad group",
      "Day",
      "Campaign state",
      "Cost",
      "Clicks",
      "Impr.",
      "CTR",
      "Avg. CPC",
      "Conversions",
      "Cost / conv.",
      "Conv. rate",
    ];
    const map = buildGoogleColumnMap(headers);
    expect(map.campaign_name).toBe("Campaign");
    expect(map.ad_group_name).toBe("Ad group");
    expect(map.day).toBe("Day");
    expect(map.status).toBe("Campaign state");
    expect(map.cost).toBe("Cost");
    expect(map.clicks).toBe("Clicks");
    expect(map.impressions).toBe("Impr.");
    expect(map.ctr).toBe("CTR");
    expect(map.avg_cpc).toBe("Avg. CPC");
    expect(map.conversions).toBe("Conversions");
    expect(map.cost_per_conv).toBe("Cost / conv.");
    expect(map.conv_rate).toBe("Conv. rate");
  });

  it("does not let the generic 'cost' keyword steal 'Cost / conv.' — the same collision class columns.ts's spend field had to avoid for Meta", () => {
    // "Cost / conv." appears BEFORE the real "Cost" column here — the exact
    // ordering that would trigger the bug if cost's own generic "cost"
    // keyword were checked before cost_per_conv's more specific phrase.
    const headers = ["Campaign", "Cost / conv.", "Cost", "Clicks", "Impr.", "Avg. CPC"];
    const map = buildGoogleColumnMap(headers);
    expect(map.cost_per_conv).toBe("Cost / conv.");
    expect(map.cost).toBe("Cost");
  });

  it("does not let the generic 'conv.' keyword steal 'Conv. rate' or 'Conv. value'", () => {
    const headers = ["Campaign", "Conv. rate", "Conv. value", "Conversions"];
    const map = buildGoogleColumnMap(headers);
    expect(map.conv_rate).toBe("Conv. rate");
    expect(map.conv_value).toBe("Conv. value");
    expect(map.conversions).toBe("Conversions");
  });

  it("does not let the generic 'impr.'/'impressions' keyword steal 'Search impr. share'", () => {
    const headers = ["Campaign", "Search impr. share", "Impr."];
    const map = buildGoogleColumnMap(headers);
    expect(map.search_impr_share).toBe("Search impr. share");
    expect(map.impressions).toBe("Impr.");
  });

  it("does not let the generic 'status' keyword collision with 'campaign' steal the status column", () => {
    const headers = ["Campaign", "Campaign status"];
    const map = buildGoogleColumnMap(headers);
    expect(map.campaign_name).toBe("Campaign");
    expect(map.status).toBe("Campaign status");
  });

  it("does not let 'conv. value' steal the ROAS column ('Conv. value / cost')", () => {
    const headers = ["Campaign", "Conv. value / cost", "Conv. value"];
    const map = buildGoogleColumnMap(headers);
    expect(map.roas).toBe("Conv. value / cost");
    expect(map.conv_value).toBe("Conv. value");
  });
});

describe("readGoogleRowsWithAutoMap", () => {
  it("builds rows keyed by canonical field name, skipping fully-blank rows", () => {
    const headers = ["Campaign", "Cost", "Clicks", "Day"];
    const dataRows = [
      ["Shoes - Search", "100", "50", "01-07-2026"],
      ["", "", "", ""],
      ["Shoes - Display", "80", "40", "02-07-2026"],
    ];
    const { rows } = readGoogleRowsWithAutoMap(headers, dataRows);
    expect(rows).toHaveLength(2);
    expect(rows[0].campaign_name).toBe("Shoes - Search");
    expect(rows[0].cost).toBe("100");
    expect(rows[1].campaign_name).toBe("Shoes - Display");
  });
});

describe("detectPlatform", () => {
  it("detects a Google Ads export (Campaign + Clicks + Impressions + Avg. CPC, no Amount spent)", () => {
    const headers = ["Campaign", "Clicks", "Impressions", "Avg. CPC", "Cost", "Conversions"];
    expect(detectPlatform(headers)).toBe("GOOGLE");
  });

  it("detects a Google Ads export using 'Impr.' and 'Average CPC' wording", () => {
    const headers = ["Campaign name", "Clicks", "Impr.", "Average CPC"];
    expect(detectPlatform(headers)).toBe("GOOGLE");
  });

  it("detects a Meta export (has Amount spent) even if it also has Clicks/Impressions", () => {
    const headers = ["Campaign name", "Amount spent", "Clicks", "Impressions", "Avg. CPC"];
    expect(detectPlatform(headers)).toBe("META");
  });

  it("defaults to META when Google's signal is incomplete (no Avg. CPC column)", () => {
    const headers = ["Campaign", "Clicks", "Impressions"];
    expect(detectPlatform(headers)).toBe("META");
  });

  it("defaults to META for a typical Meta Ads Manager export", () => {
    const headers = ["Campaign name", "Ad set name", "Amount spent", "Reach", "Impressions", "Results"];
    expect(detectPlatform(headers)).toBe("META");
  });
});
