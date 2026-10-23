import { describe, expect, it } from "vitest";
import { detectMetaCsvExportProfile, enrichMetaCampaignsTableRows } from "../meta-csv-export-profile";
import { buildColumnMap } from "../columns";
import { buildCampaignObjectiveMapWithConfidence, normalizeCampaignName } from "../objective";
import {
  buildCampaignCsvResultTypeMap,
  csvResultTypeMatchesDetection,
} from "../campaign-csv-result-type";
import type { NreRow } from "../columns";

describe("Campaigns-table Result indicator — SCHEDULE_WEBSITE parity with Ad Reporting", () => {
  const catalog = { "888777666": "CONVERSIONS:SCHEDULE_WEBSITE" };
  const headers = [
    "Reporting starts",
    "Reporting ends",
    "Campaign name",
    "Results",
    "Result indicator",
    "Amount spent (USD)",
  ];

  const rows: NreRow[] = [
    {
      campaign_name: "Unstoppable365_Website_Leads",
      spend: "100",
      results: "1",
      _raw: {
        "Reporting starts": "2026-10-22",
        "Reporting ends": "2026-10-22",
        "Campaign name": "Unstoppable365_Website_Leads",
        Results: "1",
        "Result indicator": "actions:offsite_conversion.custom.888777666",
        "Amount spent (USD)": "100",
      },
    },
  ];

  it("enriches result_type and detects WEBSITE SCHEDULE (not WEBSITE LEADS from name)", () => {
    const colMap = buildColumnMap(headers);
    const profile = detectMetaCsvExportProfile(colMap, rows, headers);
    expect(profile.kind).toBe("campaigns_table");
    enrichMetaCampaignsTableRows(rows, profile, catalog);
    expect(rows[0].result_type).toBe("Website appointments scheduled");

    const key = normalizeCampaignName("Unstoppable365_Website_Leads");
    const detected = buildCampaignObjectiveMapWithConfidence(rows, catalog).get(key);
    expect(detected?.resultLabel).toBe("WEBSITE SCHEDULE");

    const csvMap = buildCampaignCsvResultTypeMap(rows, catalog);
    const summary = csvMap.get(key);
    expect(summary?.expectedResultLabel).toBe("WEBSITE SCHEDULE");
    expect(csvResultTypeMatchesDetection(summary!, "WEBSITE SCHEDULE")).toBe(true);
  });

  it("engine matches CSV banner when Result indicator is set but result_type was not enriched yet", () => {
    const colMap = buildColumnMap(headers);
    const profile = detectMetaCsvExportProfile(colMap, rows, headers);
    expect(profile.kind).toBe("campaigns_table");
    rows[0].result_type = undefined;

    const key = normalizeCampaignName("Unstoppable365_Website_Leads");
    const csvMap = buildCampaignCsvResultTypeMap(rows, catalog);
    const summary = csvMap.get(key);
    expect(summary?.expectedResultLabel).toBe("WEBSITE SCHEDULE");

    const detected = buildCampaignObjectiveMapWithConfidence(rows, catalog).get(key);
    expect(detected?.resultLabel).toBe("WEBSITE SCHEDULE");
    expect(csvResultTypeMatchesDetection(summary!, detected!.resultLabel)).toBe(true);
  });

  it("catalog beats stale website submission on result_type (analyze without API catalog)", () => {
    rows[0].result_type = "website submission";
    const key = normalizeCampaignName("Unstoppable365_Website_Leads");
    const csvMap = buildCampaignCsvResultTypeMap(rows, catalog);
    const summary = csvMap.get(key)!;
    expect(summary.expectedResultLabel).toBe("WEBSITE SCHEDULE");
    const detected = buildCampaignObjectiveMapWithConfidence(rows, catalog).get(key);
    expect(detected?.resultLabel).toBe("WEBSITE SCHEDULE");
    expect(csvResultTypeMatchesDetection(summary, detected!.resultLabel)).toBe(true);
  });
});
