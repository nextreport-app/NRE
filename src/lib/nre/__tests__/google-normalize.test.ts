import { describe, expect, it } from "vitest";
import { normalizeGoogleCsvHeaders } from "../google-columns";
import { parseMtdCsvForAdPlatform } from "../tiktok-columns";

describe("Google CSV normalization", () => {
  it("maps Google headers to Meta-shaped names", () => {
    const normalized = normalizeGoogleCsvHeaders(["Campaign", "Day", "Cost", "Clicks", "Impressions", "CTR", "Avg. CPC"]);
    expect(normalized).toContain("Campaign name");
    expect(normalized).toContain("Amount spent");
    expect(normalized).toContain("Link clicks");
    expect(normalized).toContain("Day");
  });

  it("parses Google platform CSV through the shared pipeline", () => {
    const csv = [
      "Campaign,Day,Cost,Clicks,Impressions,CTR,Avg. CPC,Conversions",
      "Brand Search,2026-09-01,100,50,1000,5%,2.00,10",
    ].join("\n");
    const buf = Buffer.from(csv, "utf8");
    const parsed = parseMtdCsvForAdPlatform(buf, "GOOGLE");
    expect(parsed.rows.length).toBe(1);
    expect(parsed.rows[0].campaign_name).toBe("Brand Search");
    expect(parsed.rows[0].spend).toBe("100");
    expect(parsed.rows[0].reach).toBe("50");
  });
});
