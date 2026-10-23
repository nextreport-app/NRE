import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsvText } from "../parse-csv";
import {
  detectMetaCsvExportProfile,
  enrichMetaCampaignsTableRows,
} from "../meta-csv-export-profile";
import { buildCampaignCsvResultTypeMap, csvResultTypeMatchesDetection } from "../campaign-csv-result-type";
import { buildCampaignObjectiveMapWithConfidence, normalizeCampaignName } from "../objective";

const FIXTURE = resolve(__dirname, "fixtures/bumpertech-campaigns-table-sep-oct2026.csv");
const CAMPAIGN = "Website Retargeting Campaign-September";

describe("BumperTech campaigns-table export — Result indicator objective", () => {
  it("derives QUOTE REQUESTS from known custom conversion id (no Result type column)", () => {
    const { colMap, rows, headers } = parseCsvText(readFileSync(FIXTURE, "utf8"));
    expect(headers?.some((h) => String(h).toLowerCase() === "result type")).toBe(false);
    expect(headers?.some((h) => String(h).toLowerCase() === "result indicator")).toBe(true);

    const profile = detectMetaCsvExportProfile(colMap, rows, headers);
    expect(profile.kind).toBe("campaigns_table");
    enrichMetaCampaignsTableRows(rows, profile);

    const key = normalizeCampaignName(CAMPAIGN);
    const withType = rows.filter(
      (r) =>
        normalizeCampaignName(r.campaign_name ?? "") === key &&
        (r.result_type ?? "").toLowerCase().includes("quote request submitted"),
    );
    expect(withType.length).toBeGreaterThan(0);

    const detected = buildCampaignObjectiveMapWithConfidence(rows).get(key);
    expect(detected?.resultLabel).toBe("QUOTE REQUESTS");

    const summary = buildCampaignCsvResultTypeMap(rows).get(key);
    expect(summary?.primary).toBe("Quote Request Submitted");
    expect(summary?.expectedResultLabel).toBe("QUOTE REQUESTS");
    expect(csvResultTypeMatchesDetection(summary!, "QUOTE REQUESTS")).toBe(true);
  });
});
