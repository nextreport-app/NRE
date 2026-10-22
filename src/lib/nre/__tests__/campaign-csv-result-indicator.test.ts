import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsvText } from "../parse-csv";
import { buildCampaignCsvResultTypeMap, csvResultTypeMatchesDetection } from "../campaign-csv-result-type";

const FIXTURE = resolve(__dirname, "fixtures/dc-leads-campaigns-table-oct2026.csv");

describe("Campaigns-table Result indicator → objective matchup", () => {
  it("summarizes Result indicator for DC Leads fixture", () => {
    const { rows } = parseCsvText(readFileSync(FIXTURE, "utf8"));
    const map = buildCampaignCsvResultTypeMap(rows);
    const summary = map.get("dc leads campaign main");
    expect(summary?.primary).toBe("website submission (custom conversion)");
    expect(summary?.expectedResultLabel).toBe("WEBSITE LEADS");
    expect(csvResultTypeMatchesDetection(summary!, "WEBSITE LEADS")).toBe(true);
  });
});
