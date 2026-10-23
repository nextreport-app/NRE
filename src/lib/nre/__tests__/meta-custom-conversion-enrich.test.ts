import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsvText } from "../parse-csv";
import { detectMetaCsvExportProfile, reapplyMetaCampaignsTableResultTypes } from "../meta-csv-export-profile";
import { buildCampaignObjectiveMapWithConfidence, normalizeCampaignName } from "../objective";

const FIXTURE = resolve(__dirname, "fixtures/bumpertech-campaigns-table-sep-oct2026.csv");

describe("Meta API custom conversion catalog enrichment", () => {
  it("resolves QUOTE REQUESTS from API map without static id registry", () => {
    const { colMap, rows, headers } = parseCsvText(readFileSync(FIXTURE, "utf8"));
    const apiMap = { "871123778777517": "Quote Request Submitted" };
    reapplyMetaCampaignsTableResultTypes(colMap, rows, headers, apiMap);
    const profile = detectMetaCsvExportProfile(colMap, rows, headers);
    expect(profile.kind).toBe("campaigns_table");

    const key = normalizeCampaignName("Website Retargeting Campaign-September");
    const detected = buildCampaignObjectiveMapWithConfidence(rows).get(key);
    expect(detected?.resultLabel).toBe("QUOTE REQUESTS");
  });
});
