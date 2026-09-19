import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsvText } from "../parse-csv";
import { buildCampaignObjectiveMapWithConfidence, normalizeCampaignName } from "../objective";
import { pickResultAction } from "../fetch-meta-report-rows";
import type { MetaInsightRow } from "@/lib/meta-api";

const WEEKLY_CSV_PATH = resolve(
  process.cwd(),
  "src/lib/nre/__tests__/fixtures/bumpertech-sep-weekly-quote-requests.csv",
);

/** Build a synthetic API insight row from one manual CSV row (same shape the sync pipeline emits). */
function csvRowToSyntheticInsight(row: {
  campaign_name?: string | null;
  ad_set_name?: string | null;
  result_type?: string | null;
  results?: string | number | null;
  spend?: string | number | null;
  link_clicks?: string | number | null;
  landing_page_views?: string | number | null;
}): MetaInsightRow {
  const quotes = Number(row.results) || 0;
  const linkClicks = Number(row.link_clicks) || 0;
  const lpv = Number(row.landing_page_views) || 0;
  const actions: { action_type: string; value: string }[] = [];
  if (linkClicks > 0) actions.push({ action_type: "link_click", value: String(linkClicks) });
  if (lpv > 0) actions.push({ action_type: "landing_page_view", value: String(lpv) });
  if (quotes > 0 && row.result_type?.toLowerCase().includes("quote")) {
    actions.push({ action_type: "offsite_conversion.custom.9876543210", value: String(quotes) });
  }
  if (quotes > 0) {
    actions.push({ action_type: "offsite_conversion.fb_pixel_lead", value: "1" });
    actions.push({ action_type: "onsite_conversion.messaging_conversation_started_7d", value: "1" });
  }
  return {
    campaign_name: row.campaign_name ?? "",
    adset_name: row.ad_set_name ?? "",
    date_start: "2026-09-18",
    spend: String(row.spend ?? "0"),
    optimization_goal: "OUTCOME_LEADS",
    actions,
  };
}

describe("BumperTech CSV vs API-sync parity", () => {
  const { rows } = parseCsvText(readFileSync(WEEKLY_CSV_PATH, "utf8"));
  const manualMap = buildCampaignObjectiveMapWithConfidence(rows);

  it("manual CSV detects QUOTE REQUESTS on all five BumperTech campaigns", () => {
    const expected = [
      "re-targeting quote requests",
      "website retargeting campaign-september",
      "brisbane north - cold traffic - website leads",
      "brisbane south - cold traffic - website leads",
      "brisbane north - remarketing - website leads",
    ];
    for (const key of expected) {
      expect(manualMap.get(key)?.resultLabel).toBe("QUOTE REQUESTS");
    }
  });

  it("API pickResultAction prefers custom quote conversions over fb_pixel_lead and messaging noise", () => {
    const sampleByCampaign = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      const key = normalizeCampaignName(row.campaign_name);
      if (!sampleByCampaign.has(key) && row.result_type === "Quote Request Submitted") {
        sampleByCampaign.set(key, row);
      }
    }
    expect(sampleByCampaign.size).toBe(5);

    for (const [key, csvRow] of sampleByCampaign) {
      const insight = csvRowToSyntheticInsight(csvRow);
      const picked = pickResultAction(insight);
      expect(picked?.action_type, key).toMatch(/custom\.|quote/i);
    }
  });

  it("synthetic API-sync CSV rows resolve to the same objectives as manual CSV", () => {
    const syntheticRows = rows
      .filter((r) => r.result_type === "Quote Request Submitted")
      .map((csvRow) => {
        const insight = csvRowToSyntheticInsight(csvRow);
        const picked = pickResultAction(insight);
        return {
          ...csvRow,
          result_type: picked ? "Quote Request Submitted" : csvRow.result_type,
          results: picked?.value ?? csvRow.results,
        };
      });

    const apiMap = buildCampaignObjectiveMapWithConfidence(syntheticRows);
    for (const [key, manual] of manualMap) {
      const api = apiMap.get(key);
      expect(api?.resultLabel, key).toBe(manual.resultLabel);
    }
  });
});
