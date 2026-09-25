import { describe, expect, it, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsvText } from "../parse-csv";
import { buildReportData } from "../report-data";
import { buildCampaignObjectiveMap } from "../objective";
import { fetchMetaReportCsv } from "../fetch-meta-report-rows";
import { readRowsWithAutoMap } from "../columns";
import type { MetaInsightRow } from "@/lib/meta-api";

const MANUAL_CSV = resolve(process.cwd(), "src/lib/nre/__tests__/fixtures/dc-credit-firm-weekly-upload.csv");
const USER_UPLOAD_CSV = resolve(
  process.cwd(),
  "src/lib/nre/__tests__/fixtures/dc-credit-firm-user-upload-sep2026.csv",
);

/** Synthetic Meta Insights row from one manual Credit Firm CSV day. */
function manualRowToInsight(row: ReturnType<typeof parseCsvText>["rows"][number]): MetaInsightRow {
  const linkClicks = Number(row.link_clicks) || 0;
  const lpv = Number(row.landing_page_views) || 0;
  const results = Number(row.results) || 0;
  const rt = (row.result_type || "").toLowerCase();
  const actions: { action_type: string; value: string }[] = [];
  if (linkClicks > 0) actions.push({ action_type: "link_click", value: String(linkClicks) });
  if (lpv > 0) actions.push({ action_type: "landing_page_view", value: String(lpv) });
  if (results > 0 && rt.includes("website submission")) {
    actions.push({ action_type: "offsite_conversion.fb_pixel_lead", value: String(results) });
  }
  // Incidental noise Meta often attaches on non-lead days in API responses.
  if (results === 0 && linkClicks > 0) {
    actions.push({ action_type: "lead", value: "1" });
    actions.push({ action_type: "onsite_conversion.lead_grouped", value: "1" });
  }
  const day = String(row._raw?.Day ?? row.date_start ?? "2026-09-23");
  const isoDay = day.includes("-") && day.length === 10 ? day : day.split("-").reverse().join("-");
  return {
    campaign_name: row.campaign_name ?? "",
    adset_name: row.ad_set_name ?? "",
    date_start: isoDay,
    spend: String(row.spend ?? "0"),
    reach: row.reach ?? "100",
    impressions: row.impressions ?? "200",
    ctr: row.ctr ?? "0.03",
    cpc: row.cpc ?? "1.00",
    inline_link_clicks: String(linkClicks),
    frequency: row.frequency ?? "1.5",
    optimization_goal: "OUTCOME_LEADS",
    actions,
    cost_per_action_type:
      results > 0 && rt.includes("website submission")
        ? [{ action_type: "offsite_conversion.fb_pixel_lead", value: String(Number(row.spend) / results) }]
        : [],
  };
}

async function apiRowsFromManual(manualRows: ReturnType<typeof parseCsvText>["rows"]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: manualRows.map(manualRowToInsight) }),
    })),
  );
  const apiCsv = await fetchMetaReportCsv({
    accessToken: "token",
    adAccountId: "act_123",
    timezone: "America/New_York",
    sinceIso: "2026-08-25",
    untilIso: "2026-09-23",
  });
  const lines = apiCsv.csvText.split("\n");
  const headers = lines[0].split(",");
  const dataRows = lines.slice(1).map((line) => line.split(","));
  return readRowsWithAutoMap(headers, dataRows).rows;
}

describe("DC Credit Firm manual CSV vs API-sync parity", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("API-sync CSV produces the same leads, CPL, and objective as manual CSV", async () => {
    const { rows: manualRows } = parseCsvText(readFileSync(MANUAL_CSV, "utf8"));
    const apiRows = await apiRowsFromManual(manualRows);

    const manualMap = buildCampaignObjectiveMap(manualRows);
    const apiMap = buildCampaignObjectiveMap(apiRows);
    expect(apiMap.get("dc leads campaign main")?.resultLabel).toBe(
      manualMap.get("dc leads campaign main")?.resultLabel,
    );

    const reportOpts = {
      accountName: "Credit Firm",
      currencySymbol: "$",
      timezone: "America/New_York",
      monthlyBudget: null,
      now: new Date("2026-09-24T12:00:00Z"),
      reportType: "WEEKLY" as const,
      selectedCampaigns: ["DC Leads Campaign Main"],
    };

    const manualReport = buildReportData({ ...reportOpts, mtdDailyRows: manualRows });
    const apiReport = buildReportData({ ...reportOpts, mtdDailyRows: apiRows });

    const manualWl = manualReport.mtdRow.resultColumns.find((c) => c.label === "WEBSITE LEADS");
    const apiWl = apiReport.mtdRow.resultColumns.find((c) => c.label === "WEBSITE LEADS");

    expect(apiWl?.value).toBe(manualWl?.value);
    expect(apiWl?.cprValue).toBe(manualWl?.cprValue);
    expect(apiReport.chart?.campaigns[0]?.resLabel).toBe(manualReport.chart?.campaigns[0]?.resLabel);
    expect(apiReport.chart?.campaigns[0]?.results).toBe(manualReport.chart?.campaigns[0]?.results);
    expect(apiReport.campaignSlides[0]?.resultLabel).toBe(manualReport.campaignSlides[0]?.resultLabel);
    expect(apiReport.campaignSlides[0]?.metrics.results).toBe(manualReport.campaignSlides[0]?.metrics.results);

    // Credit Firm weekly upload: 9 website leads in the Sep window.
    expect(manualWl?.value).toBe("9");
    expect(apiWl?.value).toBe("9");
  });

  it("uses website submission result type and no stray Meta leads column on blank days", async () => {
    const { rows: manualRows } = parseCsvText(readFileSync(MANUAL_CSV, "utf8"));
    const apiRows = await apiRowsFromManual(manualRows);

    const leadDays = apiRows.filter((r) => parseInt(String(r.results || "0"), 10) > 0);
    expect(leadDays.length).toBeGreaterThan(0);
    expect(leadDays.every((r) => r.result_type === "website submission")).toBe(true);

    const metaLeadsOnBlankDays = apiRows.filter(
      (r) => !r.result_type?.trim() && parseInt(String(r.meta_leads || "0"), 10) > 0,
    ).length;
    expect(metaLeadsOnBlankDays).toBe(0);
  });

  it("ignores incidental fb_pixel_lead on blank days when Meta reports no cost per result", async () => {
    const { rows: manualRows } = parseCsvText(readFileSync(MANUAL_CSV, "utf8"));
    const noisyInsights = manualRows.map((row) => {
      const insight = manualRowToInsight(row);
      const results = Number(row.results) || 0;
      if (results === 0) {
        insight.actions = [
          ...(insight.actions ?? []),
          { action_type: "offsite_conversion.fb_pixel_lead", value: "1" },
        ];
      }
      return insight;
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ data: noisyInsights }) })),
    );
    const apiCsv = await fetchMetaReportCsv({
      accessToken: "token",
      adAccountId: "act_123",
      timezone: "America/New_York",
      sinceIso: "2026-08-25",
      untilIso: "2026-09-23",
    });
    const lines = apiCsv.csvText.split("\n");
    const headers = lines[0].split(",");
    const dataRows = lines.slice(1).map((line) => line.split(","));
    const { rows: apiRows } = readRowsWithAutoMap(headers, dataRows);

    const reportOpts = {
      accountName: "Credit Firm",
      currencySymbol: "$",
      timezone: "America/New_York",
      monthlyBudget: null,
      now: new Date("2026-09-24T12:00:00Z"),
      reportType: "WEEKLY" as const,
      selectedCampaigns: ["DC Leads Campaign Main"],
    };
    const manualReport = buildReportData({ ...reportOpts, mtdDailyRows: manualRows });
    const apiReport = buildReportData({ ...reportOpts, mtdDailyRows: apiRows });

    const manualWl = manualReport.mtdRow.resultColumns.find((c) => c.label === "WEBSITE LEADS");
    const apiWl = apiReport.mtdRow.resultColumns.find((c) => c.label === "WEBSITE LEADS");
    expect(apiWl?.value).toBe(manualWl?.value);
    expect(apiWl?.cprValue).toBe(manualWl?.cprValue);

    const strayWebsiteLeads = apiRows.filter(
      (r) => !r.result_type?.trim() && parseInt(String(r.website_leads || "0"), 10) > 0,
    ).length;
    expect(strayWebsiteLeads).toBe(0);
  });

  it("OUTCOME_LEADS campaigns without 'leads' in the name ignore uncosted pixel leads on traffic days", async () => {
    const { rows: manualRows } = parseCsvText(readFileSync(MANUAL_CSV, "utf8"));
    const insights = manualRows.map((row) => {
      const insight = manualRowToInsight(row);
      insight.campaign_name = "DC Main Campaign";
      const results = Number(row.results) || 0;
      if (results === 0) {
        insight.actions = [
          ...(insight.actions ?? []),
          { action_type: "offsite_conversion.fb_pixel_lead", value: "1" },
        ];
      }
      return insight;
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ data: insights }) })),
    );
    const apiCsv = await fetchMetaReportCsv({
      accessToken: "token",
      adAccountId: "act_123",
      timezone: "America/New_York",
      sinceIso: "2026-08-25",
      untilIso: "2026-09-23",
    });
    const lines = apiCsv.csvText.split("\n");
    const { rows: apiRows } = readRowsWithAutoMap(
      lines[0].split(","),
      lines.slice(1).map((line) => line.split(",")),
    );

    const reportOpts = {
      accountName: "Credit Firm",
      currencySymbol: "$",
      timezone: "America/New_York",
      monthlyBudget: null,
      now: new Date("2026-09-24T12:00:00Z"),
      reportType: "WEEKLY" as const,
      selectedCampaigns: ["DC Main Campaign"],
    };
    const renamedManual = manualRows.map((r) => ({ ...r, campaign_name: "DC Main Campaign" }));
    const manualReport = buildReportData({ ...reportOpts, mtdDailyRows: renamedManual });
    const apiReport = buildReportData({ ...reportOpts, mtdDailyRows: apiRows });
    const manualWl = manualReport.mtdRow.resultColumns.find((c) => c.label === "WEBSITE LEADS");
    const apiWl = apiReport.mtdRow.resultColumns.find((c) => c.label === "WEBSITE LEADS");
    expect(apiWl?.value).toBe(manualWl?.value);
    expect(apiWl?.value).toBe("9");
  });

  it("matches user-reported Sep 2026 upload: weekly 4, MTD 9, chart 12", async () => {
    const { rows: manualRows } = parseCsvText(readFileSync(USER_UPLOAD_CSV, "utf8"));
    const apiRows = await apiRowsFromManual(manualRows);
    const reportOpts = {
      accountName: "Credit Firm",
      currencySymbol: "$",
      timezone: "America/New_York",
      monthlyBudget: null,
      now: new Date("2026-09-25T12:00:00Z"),
      reportType: "WEEKLY" as const,
      selectedCampaigns: ["DC Leads Campaign Main"],
      weeklyRange: { startIso: "2026-09-18", endIso: "2026-09-24" },
    };
    const manualReport = buildReportData({ ...reportOpts, mtdDailyRows: manualRows });
    const apiReport = buildReportData({ ...reportOpts, mtdDailyRows: apiRows });
    expect(manualReport.campaignSlides[0]?.metrics.results).toBe("4");
    expect(manualReport.chart?.campaigns[0]?.results).toBe(12);
    expect(apiReport.campaignSlides[0]?.metrics.results).toBe("4");
    expect(apiReport.mtdRow.resultColumns.find((c) => c.label === "WEBSITE LEADS")?.value).toBe("9");
    expect(apiReport.chart?.campaigns[0]?.results).toBe(12);
  });

  it("does not let incidental meta-form actions on blank days flip website-leads campaigns to META FORM LEADS", async () => {
    const { rows: manualRows } = parseCsvText(readFileSync(MANUAL_CSV, "utf8"));
    const apiRows = await apiRowsFromManual(manualRows);

    const metaLeadsOnBlankDays = apiRows.filter(
      (r) => !r.result_type?.trim() && parseInt(String(r.meta_leads || "0"), 10) > 0,
    ).length;
    expect(metaLeadsOnBlankDays).toBe(0);

    expect(buildCampaignObjectiveMap(apiRows).get("dc leads campaign main")?.resultLabel).toBe("WEBSITE LEADS");
  });
});
