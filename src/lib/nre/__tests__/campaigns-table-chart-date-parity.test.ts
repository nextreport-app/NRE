import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsvText } from "../parse-csv";
import { validateMtdDailyCsv } from "../validate";
import { buildReportData } from "../report-data";
import { buildVisualChartSlideModel } from "../visual-chart-slide";
import type { NreRow } from "../columns";
import {
  detectMetaCsvExportProfile,
  normalizeMetaCampaignsTableToAdsReportingShape,
} from "../meta-csv-export-profile";

const ADS_REPORTING = resolve(__dirname, "fixtures/dc-unstoppable-website-schedule-weekly.csv");
const NOW = new Date("2026-10-23T12:00:00Z");
const TZ = "America/New_York";
const CAMPAIGN = "Unstoppable365_Website_Leads";
const WEEKLY = { startIso: "2026-10-16", endIso: "2026-10-22" };

function buildCampaignsTableRowsFromAdsReporting(source: NreRow[]): NreRow[] {
  return source
    .filter((r) => String(r.campaign_name ?? "").trim() === CAMPAIGN)
    .map((r) => {
      const raw = { ...(r._raw ?? {}) };
      const day = raw["Day"] ?? "";
      delete raw["Day"];
      delete raw["Ad set name"];
      return {
        ...r,
        ad_set_name: undefined,
        _raw: {
          ...raw,
          "Reporting starts": day,
          "Reporting ends": day,
          "Campaign delivery": "active",
          "Result indicator": "actions:offsite_conversion.custom.schedule-test",
        },
      };
    });
}

describe("Campaigns-table normalizer — chart dates match Ad Reporting", () => {
  const adsParsed = parseCsvText(readFileSync(ADS_REPORTING, "utf8"));
  validateMtdDailyCsv(adsParsed.colMap, adsParsed.rows, NOW, adsParsed.headers, "META");

  const campaignsRows = buildCampaignsTableRowsFromAdsReporting(adsParsed.rows);
  // Ghost pre-start days that Campaigns-screen exports sometimes include.
  campaignsRows.unshift({
    campaign_name: CAMPAIGN,
    spend: "99",
    impressions: "1000",
    reach: "500",
    results: "0",
    _raw: {
      "Reporting starts": "2026-09-23",
      "Reporting ends": "2026-09-23",
      "Campaign name": CAMPAIGN,
      Starts: "2026-10-15",
      "Amount spent (USD)": "99",
    },
  });

  const campaignsHeaders = [
    "Reporting starts",
    "Reporting ends",
    "Campaign name",
    "Campaign delivery",
    "Results",
    "Result indicator",
    "Amount spent (USD)",
    "Impressions",
    "Reach",
    "Starts",
  ];
  const campaignsColMap = { ...adsParsed.colMap };
  delete campaignsColMap.ad_set_name;
  const profile = detectMetaCsvExportProfile(campaignsColMap, campaignsRows, campaignsHeaders);
  expect(profile.kind).toBe("campaigns_table");
  normalizeMetaCampaignsTableToAdsReportingShape(campaignsRows, profile, {
    "schedule-test": "Website appointments scheduled",
  });

  it("drops pre-Starts ghost rows and injects Day like Ad Reporting", () => {
    expect(campaignsRows.some((r) => getRowDateFromRow(r) === "2026-09-23")).toBe(false);
    expect(campaignsRows.every((r) => (r._raw?.["Day"] ?? "").length > 0)).toBe(true);
  });

  it("chart title date span matches Ad Reporting export for the same campaign", () => {
    const objective = { resultLabel: "WEBSITE SCHEDULE" as const, costLabel: "COST PER BOOKING" as const };
    const adsReport = buildReportData({
      accountName: "Unstoppable",
      currencySymbol: "$",
      timezone: TZ,
      monthlyBudget: null,
      mtdDailyRows: adsParsed.rows,
      selectedCampaigns: [CAMPAIGN],
      weeklyRange: WEEKLY,
      reportType: "WEEKLY",
      now: NOW,
      campaignObjectives: { [CAMPAIGN]: objective },
    });
    const campaignsReport = buildReportData({
      accountName: "Unstoppable",
      currencySymbol: "$",
      timezone: TZ,
      monthlyBudget: null,
      mtdDailyRows: campaignsRows,
      selectedCampaigns: [CAMPAIGN],
      weeklyRange: WEEKLY,
      reportType: "WEEKLY",
      now: NOW,
      campaignObjectives: { [CAMPAIGN]: objective },
    });

    expect(adsReport.chart?.periodSubLabel).toBeDefined();
    expect(campaignsReport.chart?.periodSubLabel).toBe(adsReport.chart?.periodSubLabel);
    const adsTitle = buildVisualChartSlideModel(adsReport.chart!, "$").title;
    const campaignsTitle = buildVisualChartSlideModel(campaignsReport.chart!, "$").title;
    expect(campaignsTitle).toBe(adsTitle);
    expect(adsTitle).toContain("Oct 16");
    expect(adsTitle).not.toContain("Sep 23");
  });
});

function getRowDateFromRow(row: NreRow): string {
  const raw = row._raw ?? {};
  return raw["Day"] || raw["Reporting starts"] || "";
}
