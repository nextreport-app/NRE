import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { readRowsWithAutoMap } from "../columns";
import {
  buildCampaignObjectiveMapWithConfidence,
  resolveCampaignObjectiveWithConfidence,
} from "../objective";
import { fetchMetaReportCsv, pickResultAction } from "../fetch-meta-report-rows";
import type { MetaInsightRow } from "@/lib/meta-api";

const RETARGET_CAMPAIGN = "Re-Targeting Quote Requests";
const RETARGET_ADSET = "Retargeting - Quote Requests";
const WEBSITE_LEADS_CAMPAIGN = "Brisbane North - cold traffic - website leads";
const WEBSITE_LEADS_ADSET = "Brisbane North - cold traffic - website leads - broad";

function retargetQuoteDay(date: string, quotes: number, spend: string, messaging = 1): MetaInsightRow {
  return {
    campaign_name: RETARGET_CAMPAIGN,
    adset_name: RETARGET_ADSET,
    date_start: date,
    spend,
    reach: "1500",
    impressions: "2200",
    ctr: "0.02",
    cpc: "1.50",
    inline_link_clicks: "11",
    frequency: "1.4",
    optimization_goal: "OUTCOME_LEADS",
    actions: [
      { action_type: "link_click", value: "11" },
      { action_type: "landing_page_view", value: "8" },
      { action_type: "offsite_conversion.custom.quote_request_submitted", value: String(quotes) },
      ...(messaging > 0
        ? [{ action_type: "onsite_conversion.messaging_conversation_started_7d", value: String(messaging) }]
        : []),
    ],
    cost_per_action_type: [
      { action_type: "offsite_conversion.custom.quote_request_submitted", value: "1.28" },
      ...(messaging > 0
        ? [{ action_type: "onsite_conversion.messaging_conversation_started_7d", value: "25.00" }]
        : []),
    ],
  };
}

describe("BumperTech API sync — Re-Targeting Quote Requests", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          data: [
            retargetQuoteDay("2026-09-18", 20, "25.50"),
            retargetQuoteDay("2026-09-17", 9, "28.83"),
            retargetQuoteDay("2026-09-16", 18, "33.53", 0),
          ],
        }),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("pickResultAction prefers numeric custom conversion IDs on quote campaigns", () => {
    expect(
      pickResultAction({
        campaign_name: RETARGET_CAMPAIGN,
        adset_name: RETARGET_ADSET,
        optimization_goal: "OUTCOME_LEADS",
        actions: [
          { action_type: "link_click", value: "11" },
          { action_type: "offsite_conversion.custom.9876543210", value: "20" },
          { action_type: "onsite_conversion.messaging_conversation_started_7d", value: "1" },
        ],
      }),
    ).toEqual({
      action_type: "offsite_conversion.custom.9876543210",
      value: "20",
    });
  });

  it("pickResultAction prefers quote conversions over incidental messaging", () => {
    expect(
      pickResultAction({
        campaign_name: RETARGET_CAMPAIGN,
        adset_name: RETARGET_ADSET,
        optimization_goal: "OUTCOME_LEADS",
        actions: [
          { action_type: "link_click", value: "11" },
          { action_type: "offsite_conversion.custom.quote_request_submitted", value: "20" },
          { action_type: "onsite_conversion.messaging_conversation_started_7d", value: "1" },
        ],
      }),
    ).toEqual({
      action_type: "offsite_conversion.custom.quote_request_submitted",
      value: "20",
    });
  });

  it("writes Quote Request Submitted result type into API-sync CSV rows", async () => {
    const result = await fetchMetaReportCsv({
      accessToken: "token",
      adAccountId: "act_123",
      timezone: "UTC",
      sinceIso: "2026-09-16",
      untilIso: "2026-09-18",
    });

    expect(result.csvText).toContain("Quote Request Submitted");

    const lines = result.csvText.split("\n");
    const headers = lines[0].split(",");
    const dataRows = lines.slice(1).map((line) => line.split(","));
    const { rows } = readRowsWithAutoMap(headers, dataRows);
    const retargetRows = rows.filter((r) => r.campaign_name === RETARGET_CAMPAIGN);

    expect(retargetRows.length).toBe(3);
    expect(retargetRows.every((r) => r.result_type === "Quote Request Submitted")).toBe(true);
  });

  it("detects QUOTE REQUESTS when Meta only returns numeric custom conversion IDs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          data: [
            {
              campaign_name: RETARGET_CAMPAIGN,
              adset_name: RETARGET_ADSET,
              date_start: "2026-09-18",
              spend: "25.50",
              reach: "1500",
              impressions: "2200",
              optimization_goal: "OUTCOME_LEADS",
              actions: [
                { action_type: "offsite_conversion.custom.9876543210", value: "20" },
                { action_type: "onsite_conversion.messaging_conversation_started_7d", value: "1" },
              ],
            },
          ],
        }),
      })),
    );

    const result = await fetchMetaReportCsv({
      accessToken: "token",
      adAccountId: "act_123",
      timezone: "UTC",
      sinceIso: "2026-09-18",
      untilIso: "2026-09-18",
    });

    const lines = result.csvText.split("\n");
    const headers = lines[0].split(",");
    const dataRows = lines.slice(1).map((line) => line.split(","));
    const { rows } = readRowsWithAutoMap(headers, dataRows);
    const retargetRows = rows.filter((r) => r.campaign_name === RETARGET_CAMPAIGN);

    expect(retargetRows[0]?.result_type).toBe("Quote Request Submitted");
    expect(resolveCampaignObjectiveWithConfidence(retargetRows).resultLabel).toBe("QUOTE REQUESTS");
  });

  it("uses campaign naming when API rows only carry incidental messaging columns", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          data: [
            {
              campaign_name: RETARGET_CAMPAIGN,
              adset_name: RETARGET_ADSET,
              date_start: "2026-09-18",
              spend: "25.50",
              reach: "1500",
              impressions: "2200",
              optimization_goal: "OUTCOME_LEADS",
              actions: [
                { action_type: "link_click", value: "11" },
                { action_type: "landing_page_view", value: "8" },
                { action_type: "onsite_conversion.messaging_conversation_started_7d", value: "1" },
              ],
            },
          ],
        }),
      })),
    );

    const result = await fetchMetaReportCsv({
      accessToken: "token",
      adAccountId: "act_123",
      timezone: "UTC",
      sinceIso: "2026-09-18",
      untilIso: "2026-09-18",
    });

    const lines = result.csvText.split("\n");
    const headers = lines[0].split(",");
    const dataRows = lines.slice(1).map((line) => line.split(","));
    const { rows } = readRowsWithAutoMap(headers, dataRows);
    const retargetRows = rows.filter((r) => r.campaign_name === RETARGET_CAMPAIGN);

    expect(retargetRows[0]?.result_type).toBe("");
    expect(resolveCampaignObjectiveWithConfidence(retargetRows).resultLabel).toBe("QUOTE REQUESTS");
  });

  it("detects QUOTE REQUESTS for website-leads-named campaigns when API returns custom conversions", async () => {
    expect(
      pickResultAction({
        campaign_name: WEBSITE_LEADS_CAMPAIGN,
        adset_name: WEBSITE_LEADS_ADSET,
        optimization_goal: "OUTCOME_LEADS",
        actions: [
          { action_type: "offsite_conversion.fb_pixel_lead", value: "1" },
          { action_type: "offsite_conversion.custom.9876543210", value: "3" },
          { action_type: "onsite_conversion.messaging_conversation_started_7d", value: "1" },
        ],
      }),
    ).toEqual({
      action_type: "offsite_conversion.custom.9876543210",
      value: "3",
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          data: [
            {
              campaign_name: WEBSITE_LEADS_CAMPAIGN,
              adset_name: WEBSITE_LEADS_ADSET,
              date_start: "2026-09-18",
              spend: "11.89",
              reach: "621",
              impressions: "764",
              optimization_goal: "OUTCOME_LEADS",
              actions: [
                { action_type: "offsite_conversion.fb_pixel_lead", value: "1" },
                { action_type: "offsite_conversion.custom.9876543210", value: "3" },
              ],
              cost_per_action_type: [
                { action_type: "offsite_conversion.custom.9876543210", value: "3.96" },
              ],
            },
          ],
        }),
      })),
    );

    const result = await fetchMetaReportCsv({
      accessToken: "token",
      adAccountId: "act_123",
      timezone: "UTC",
      sinceIso: "2026-09-18",
      untilIso: "2026-09-18",
    });

    const lines = result.csvText.split("\n");
    const headers = lines[0].split(",");
    const dataRows = lines.slice(1).map((line) => line.split(","));
    const { rows } = readRowsWithAutoMap(headers, dataRows);
    const campRows = rows.filter((r) => r.campaign_name === WEBSITE_LEADS_CAMPAIGN);

    expect(campRows[0]?.result_type).toBe("Quote Request Submitted");
    expect(resolveCampaignObjectiveWithConfidence(campRows).resultLabel).toBe("QUOTE REQUESTS");
  });

  it("detects QUOTE REQUESTS (not MESSAGING) for API-sync rows on first import", async () => {
    const result = await fetchMetaReportCsv({
      accessToken: "token",
      adAccountId: "act_123",
      timezone: "UTC",
      sinceIso: "2026-09-16",
      untilIso: "2026-09-18",
    });

    const lines = result.csvText.split("\n");
    const headers = lines[0].split(",");
    const dataRows = lines.slice(1).map((line) => line.split(","));
    const { rows } = readRowsWithAutoMap(headers, dataRows);
    const retargetRows = rows.filter((r) => r.campaign_name === RETARGET_CAMPAIGN);

    const detected = resolveCampaignObjectiveWithConfidence(retargetRows);
    expect(detected.resultLabel).toBe("QUOTE REQUESTS");
    expect(detected.resultLabel).not.toBe("MESSAGING / CONVERSATIONS");
    expect(detected.confidence).toBe("high");

    const map = buildCampaignObjectiveMapWithConfidence(rows);
    expect(map.get("re-targeting quote requests")?.resultLabel).toBe("QUOTE REQUESTS");
  });
});
