import { describe, expect, it } from "vitest";
import { parseCsvText } from "../parse-csv";
import { duplicateDailyFacts } from "../source-contract";
import { extractCampaignNames, extractCampaignSpend } from "../campaigns";

const header =
  "Campaign name,Ad set name,Day,Amount spent (USD),Results,Impressions,Link clicks,Adds to cart\n";
describe("inactive campaigns in multi-campaign exports", () => {
  it("preserves every campaign while allowing repeated inactive name-only rows", () => {
    const rows = parseCsvText(
      header +
        Array.from(
          { length: 1024 },
          (_, i) => `Campaign ${i},Set,2026-11-02,${i < 3 ? 10 : 0},0,0,0,0`,
        ).join("\n") +
        "\nCampaign 10,Set,2026-11-02,0,0,0,0,0",
    ).rows;
    expect(extractCampaignNames(rows)).toHaveLength(1024);
    expect(duplicateDailyFacts(rows)).toEqual([]);
    expect(
      Object.values(extractCampaignSpend(rows)).filter((value) => value > 0),
    ).toHaveLength(3);
    expect(rows).toHaveLength(1025);
  });
  it.each([
    ["1,0,0,0,0"],
    ["-1,0,0,0,0"],
    ["0,1,0,0,0"],
    ["0,0,1,0,0"],
    ["0,0,0,1,0"],
    ["0,0,0,0,1"],
  ])("still rejects duplicate delivered or financial facts: %s", (values) => {
    const row = `Campaign,Set,2026-11-02,${values}`;
    expect(
      duplicateDailyFacts(parseCsvText(header + row + "\n" + row).rows),
    ).toHaveLength(1);
  });
});
