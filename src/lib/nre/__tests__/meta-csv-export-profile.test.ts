import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsvText } from "../parse-csv";
import { validateMtdDailyCsv } from "../validate";
import {
  detectMetaCsvExportProfile,
  enrichMetaCampaignsTableRows,
  rowsIncludeNamedAdSets,
} from "../meta-csv-export-profile";

const REPORTING = resolve(__dirname, "fixtures/dc-credit-firm-reporting-week-oct14-20.csv");
const CAMPAIGNS = resolve(__dirname, "fixtures/dc-leads-campaigns-table-oct2026.csv");

describe("detectMetaCsvExportProfile", () => {
  it("classifies Ads Reporting export (Day + Ad set name)", () => {
    const { colMap, rows, headers } = parseCsvText(readFileSync(REPORTING, "utf8"));
    const profile = detectMetaCsvExportProfile(colMap, rows, headers);
    expect(profile.kind).toBe("ads_reporting");
    expect(profile.includesAdSetBreakdown).toBe(true);
    expect(rowsIncludeNamedAdSets(rows)).toBe(true);
  });

  it("classifies Campaigns-screen export (Reporting starts/ends, no ad sets)", () => {
    const { colMap, rows, headers } = parseCsvText(readFileSync(CAMPAIGNS, "utf8"));
    const profile = detectMetaCsvExportProfile(colMap, rows, headers);
    expect(profile.kind).toBe("campaigns_table");
    expect(profile.includesAdSetBreakdown).toBe(false);
    expect(profile.hasWebsiteSubmissionColumn).toBe(true);
    expect(profile.hasResultIndicatorColumn).toBe(true);
  });

  it("enriches Result type from Result indicator on campaigns-table rows", () => {
    const { colMap, rows, headers } = parseCsvText(readFileSync(CAMPAIGNS, "utf8"));
    const profile = detectMetaCsvExportProfile(colMap, rows, headers);
    enrichMetaCampaignsTableRows(rows, profile);
    const withType = rows.filter((r) => (r.result_type ?? "").includes("website submission"));
    expect(withType.length).toBeGreaterThan(0);
  });

  it("validate adds short import hint for campaigns-table uploads", () => {
    const { colMap, rows, headers } = parseCsvText(readFileSync(CAMPAIGNS, "utf8"));
    const result = validateMtdDailyCsv(colMap, rows, new Date("2026-10-21T12:00:00Z"), headers, "META");
    expect(result.valid).toBe(true);
    expect(result.metaCsvExportProfile?.kind).toBe("campaigns_table");
    expect(result.warnings.some((w) => w.field === "meta_csv_export")).toBe(true);
  });
});
