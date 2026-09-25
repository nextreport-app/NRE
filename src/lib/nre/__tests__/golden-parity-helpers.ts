import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, vi } from "vitest";
import { campaignNameHaystack, isWebsiteLeadsCampaignHaystack } from "../campaign-name-heuristics";
import { parseCsvText } from "../parse-csv";
import { readRowsWithAutoMap } from "../columns";
import { fetchMetaReportCsv } from "../fetch-meta-report-rows";
import type { MetaInsightRow } from "@/lib/meta-api";
import type { NreRow } from "../columns";
import type { ReportData } from "../report-data";

export const FIXTURES_DIR = resolve(process.cwd(), "src/lib/nre/__tests__/fixtures");

export function loadFixtureCsv(name: string): NreRow[] {
  const path = resolve(FIXTURES_DIR, name);
  return parseCsvText(readFileSync(path, "utf8")).rows;
}

/** Build synthetic Meta Insights from a manual export row — mirrors what API sync sees. */
export function manualRowToMetaInsight(row: NreRow): MetaInsightRow {
  const linkClicks = Number(row.link_clicks) || 0;
  const lpv = Number(row.landing_page_views) || 0;
  const results = Number(row.results) || 0;
  const metaLeads = Number(row.meta_leads) || 0;
  const websiteLeads = Number(row.website_leads) || 0;
  const rt = (row.result_type || "").trim().toLowerCase();
  const actions: { action_type: string; value: string }[] = [];

  const haystack = campaignNameHaystack(row.campaign_name ?? "", row.ad_set_name ?? "");
  const isReachRow = rt.includes("reach");
  const isLinkClickRow = rt.includes("link click");

  if (linkClicks > 0 && !isReachRow) {
    actions.push({ action_type: "link_click", value: String(linkClicks) });
  }
  if (lpv > 0) actions.push({ action_type: "landing_page_view", value: String(lpv) });

  let primaryAction: string | null = null;
  let optimization_goal = "OUTCOME_LEADS";

  if (rt.includes("website submission") || (websiteLeads > 0 && results > 0)) {
    primaryAction = "offsite_conversion.fb_pixel_lead";
    actions.push({ action_type: primaryAction, value: String(results || websiteLeads) });
  } else if (rt.includes("quote")) {
    primaryAction = "offsite_conversion.custom.9876543210";
    actions.push({ action_type: primaryAction, value: String(results) });
  } else if (rt.includes("leads (form)") || (metaLeads > 0 && results > 0)) {
    primaryAction = "onsite_conversion.lead_grouped";
    optimization_goal = "LEAD_GENERATION";
    actions.push({ action_type: primaryAction, value: String(results || metaLeads) });
  } else if (rt.includes("lead")) {
    primaryAction = "onsite_conversion.lead_grouped";
    optimization_goal = "LEAD_GENERATION";
    actions.push({ action_type: primaryAction, value: String(results || metaLeads) });
  } else if (rt.includes("purchase")) {
    primaryAction = "purchase";
    actions.push({ action_type: primaryAction, value: String(results) });
  } else if (rt.includes("messaging")) {
    primaryAction = "onsite_conversion.messaging_conversation_started_7d";
    actions.push({ action_type: primaryAction, value: String(results) });
  } else if (isLinkClickRow && linkClicks > 0) {
    optimization_goal = "LINK_CLICKS";
  } else if (isReachRow) {
    optimization_goal = "REACH";
  }

  // Incidental API noise on blank website-lead days (Credit Firm pattern).
  if (
    results === 0 &&
    linkClicks > 0 &&
    isWebsiteLeadsCampaignHaystack(haystack) &&
    !rt.includes("website submission")
  ) {
    actions.push({ action_type: "lead", value: "1" });
    actions.push({ action_type: "onsite_conversion.lead_grouped", value: "1" });
    actions.push({ action_type: "offsite_conversion.fb_pixel_lead", value: "1" });
  }

  const rawDay = String(row._raw?.Day ?? row.date_start ?? "2026-09-23");
  const isoDay =
    rawDay.includes("-") && rawDay.length === 10
      ? rawDay
      : rawDay.split("-").reverse().join("-");

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
    optimization_goal,
    actions,
    cost_per_action_type:
      results > 0 && primaryAction && row.spend
        ? [{ action_type: primaryAction, value: String(Number(row.spend) / results) }]
        : [],
  };
}

export async function apiRowsFromManual(
  manualRows: NreRow[],
  range: { sinceIso: string; untilIso: string },
  timezone = "America/New_York",
): Promise<NreRow[]> {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: manualRows.map(manualRowToMetaInsight) }),
    })),
  );
  const apiCsv = await fetchMetaReportCsv({
    accessToken: "token",
    adAccountId: "act_123",
    timezone,
    sinceIso: range.sinceIso,
    untilIso: range.untilIso,
  });
  const lines = apiCsv.csvText.split("\n");
  const headers = lines[0].split(",");
  const dataRows = lines.slice(1).filter(Boolean).map((line) => line.split(","));
  return readRowsWithAutoMap(headers, dataRows).rows;
}

export function resultColumn(report: ReportData, label: string) {
  return report.mtdRow.resultColumns.find((c) => c.label === label);
}

/** Assert manual and API-sync reports agree on the numbers that matter for launch. */
export function assertStandardReportParity(manual: ReportData, api: ReportData, resultLabel: string) {
  const manualCol = resultColumn(manual, resultLabel);
  const apiCol = resultColumn(api, resultLabel);
  expect(apiCol?.value).toBe(manualCol?.value);
  expect(apiCol?.cprValue).toBe(manualCol?.cprValue);
  expect(api.mtdRow.spend).toBe(manual.mtdRow.spend);
  expect(api.campaignSlides[0]?.metrics.results).toBe(manual.campaignSlides[0]?.metrics.results);
  expect(api.campaignSlides[0]?.resultLabel).toBe(manual.campaignSlides[0]?.resultLabel);
  if (manual.chart && api.chart) {
    expect(api.chart.totalAllSpend).toBe(manual.chart.totalAllSpend);
    expect(api.chart.campaigns[0]?.results).toBe(manual.chart.campaigns[0]?.results);
    expect(api.chart.campaigns[0]?.resLabel).toBe(manual.chart.campaigns[0]?.resLabel);
  }
}
