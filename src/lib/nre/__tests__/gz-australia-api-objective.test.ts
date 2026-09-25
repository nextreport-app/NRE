import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { readRowsWithAutoMap } from "../columns";
import { buildReportData } from "../report-data";
import { fetchMetaReportCsv, pickResultAction } from "../fetch-meta-report-rows";
import { buildCampaignObjectiveMap, resolveCampaignObjective } from "../objective";
import type { MetaInsightRow } from "@/lib/meta-api";

const GZ_CAMPAIGN = "GZ Australia | Lead Forms | Top Funnel | A3HD";
const GZ_ADSET = "GZ Australia | Lead Forms | Top Funnel | A3HD - audience";

function gzLeadDay(date: string, leads: number, spend: string, messaging = leads): MetaInsightRow {
  return {
    campaign_name: GZ_CAMPAIGN,
    adset_name: GZ_ADSET,
    date_start: date,
    spend,
    reach: "1500",
    impressions: "2000",
    ctr: "0.02",
    cpc: "1.50",
    inline_link_clicks: "20",
    frequency: "1.3",
    optimization_goal: "LEAD_GENERATION",
    actions: [
      { action_type: "link_click", value: "20" },
      { action_type: "onsite_conversion.lead_grouped", value: String(leads) },
      ...(messaging > 0
        ? [{ action_type: "onsite_conversion.messaging_conversation_started_7d", value: String(messaging) }]
        : []),
    ],
    cost_per_action_type: [
      { action_type: "onsite_conversion.lead_grouped", value: "50.00" },
      ...(messaging > 0
        ? [{ action_type: "onsite_conversion.messaging_conversation_started_7d", value: "50.00" }]
        : []),
    ],
  };
}

describe("GZ Australia API sync — META FORM LEADS not MESSAGING", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          data: [
            gzLeadDay("2026-09-16", 2, "65.55"),
            gzLeadDay("2026-09-15", 0, "53.03", 0),
            gzLeadDay("2026-09-14", 1, "61.43"),
          ],
        }),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("pickResultAction prefers lead_grouped over incidental messaging for Lead Forms campaigns", () => {
    expect(
      pickResultAction({
        campaign_name: GZ_CAMPAIGN,
        adset_name: GZ_ADSET,
        optimization_goal: "LEAD_GENERATION",
        actions: [
          { action_type: "onsite_conversion.lead_grouped", value: "2" },
          { action_type: "onsite_conversion.messaging_conversation_started_7d", value: "2" },
        ],
      }),
    ).toEqual({ action_type: "onsite_conversion.lead_grouped", value: "2" });
  });

  it("objective map and report table use META FORM LEADS despite messaging column in API CSV", async () => {
    const result = await fetchMetaReportCsv({
      accessToken: "token",
      adAccountId: "act_123",
      timezone: "UTC",
      sinceIso: "2026-09-01",
      untilIso: "2026-09-16",
    });

    const lines = result.csvText.split("\n");
    const headers = lines[0].split(",");
    const dataRows = lines.slice(1).map((line) => line.split(","));
    const { rows } = readRowsWithAutoMap(headers, dataRows);

    expect(resolveCampaignObjective(rows).resultLabel).toBe("META FORM LEADS");
    expect([...buildCampaignObjectiveMap(rows).values()][0]?.resultLabel).toBe("META FORM LEADS");

    const data = buildReportData({
      accountName: "GZ Australia",
      currencySymbol: "A$",
      timezone: "UTC",
      monthlyBudget: null,
      mtdDailyRows: rows,
      now: new Date("2026-09-17T12:00:00Z"),
    });

    const col = data.mtdRow.resultColumns.find((c) => c.label === "META FORM LEADS");
    expect(col?.value).toBe("3");
    expect(data.mtdRow.resultColumns.map((c) => c.label)).not.toContain("MESSAGING / CONVERSATIONS");
  });
});
