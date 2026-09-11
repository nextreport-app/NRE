import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { buildReportData } from "../report-data";
import { fetchMetaReportCsv, pickResultAction } from "../fetch-meta-report-rows";
import { readRowsWithAutoMap } from "../columns";
import { validateMtdDailyCsv } from "../validate";
import type { MetaInsightRow } from "@/lib/meta-api";

describe("pickResultAction", () => {
  it("prefers lead actions over higher link_click counts", () => {
    const row: MetaInsightRow = {
      actions: [
        { action_type: "link_click", value: "120" },
        { action_type: "onsite_conversion.lead_grouped", value: "8" },
      ],
      optimization_goal: "LEAD_GENERATION",
    };
    expect(pickResultAction(row)).toEqual({
      action_type: "onsite_conversion.lead_grouped",
      value: "8",
    });
  });

  it("uses website lead action for OFFSITE_CONVERSIONS goal", () => {
    const row: MetaInsightRow = {
      actions: [
        { action_type: "link_click", value: "90" },
        { action_type: "landing_page_view", value: "40" },
        { action_type: "offsite_conversion.fb_pixel_lead", value: "12" },
      ],
      optimization_goal: "OFFSITE_CONVERSIONS",
    };
    expect(pickResultAction(row)).toEqual({
      action_type: "offsite_conversion.fb_pixel_lead",
      value: "12",
    });
  });
});

describe("fetchMetaReportCsv", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("/insights")) {
          return {
            ok: true,
            json: async () => ({
              data: [
                {
                  campaign_name: "Shoes Campaign",
                  adset_name: "Broad",
                  date_start: "2026-07-19",
                  spend: "50.00",
                  reach: "1000",
                  impressions: "5000",
                  ctr: "0.02",
                  cpc: "0.85",
                  inline_link_clicks: "40",
                  frequency: "1.5",
                  optimization_goal: "LINK_CLICKS",
                  actions: [{ action_type: "link_click", value: "40" }],
                  cost_per_action_type: [{ action_type: "link_click", value: "1.25" }],
                },
                {
                  campaign_name: "Lead Gen Campaign",
                  adset_name: "Instant Form",
                  date_start: "2026-07-19",
                  spend: "200.00",
                  reach: "3000",
                  impressions: "8000",
                  ctr: "0.03",
                  cpc: "1.10",
                  inline_link_clicks: "150",
                  frequency: "2.1",
                  optimization_goal: "LEAD_GENERATION",
                  actions: [
                    { action_type: "link_click", value: "150" },
                    { action_type: "landing_page_view", value: "80" },
                    { action_type: "onsite_conversion.lead_grouped", value: "25" },
                  ],
                  cost_per_action_type: [
                    { action_type: "link_click", value: "1.33" },
                    { action_type: "onsite_conversion.lead_grouped", value: "8.00" },
                  ],
                },
              ],
            }),
          };
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("produces CSV that passes Meta validation", async () => {
    const result = await fetchMetaReportCsv({
      accessToken: "token",
      adAccountId: "act_123",
      timezone: "UTC",
      now: new Date("2026-07-20T12:00:00Z"),
      days: 30,
    });

    expect(result.rowCount).toBe(2);
    const lines = result.csvText.split("\n");
    const headers = lines[0].split(",");
    const dataRows = lines.slice(1).map((line) => line.split(","));
    const { colMap, rows } = readRowsWithAutoMap(headers, dataRows);
    const validation = validateMtdDailyCsv(colMap, rows, new Date("2026-07-20T12:00:00Z"), headers);
    expect(validation.valid).toBe(true);
  });

  it("maps lead-gen rows with dedicated lead columns and Leads (form) result type", async () => {
    const result = await fetchMetaReportCsv({
      accessToken: "token",
      adAccountId: "act_123",
      timezone: "UTC",
      now: new Date("2026-07-20T12:00:00Z"),
      days: 30,
    });

    expect(result.csvText).toContain("Lead Gen Campaign");
    expect(result.csvText).toContain("Leads (form)");

    const lines = result.csvText.split("\n");
    const headers = lines[0].split(",");
    const dataRows = lines.slice(1).map((line) => line.split(","));
    const { colMap, rows } = readRowsWithAutoMap(headers, dataRows);
    const mapped = rows.find((row) => row.campaign_name === "Lead Gen Campaign")!;

    expect(colMap.meta_leads).toBe("Meta leads");
    expect(mapped.meta_leads).toBe("25");
    expect(mapped.results).toBe("25");
    expect(mapped.result_type).toBe("Leads (form)");
    expect(mapped.link_clicks).toBe("150");
  });

  it("buildReportData resolves META FORM LEADS from API-sync-shaped CSV rows", async () => {
    const result = await fetchMetaReportCsv({
      accessToken: "token",
      adAccountId: "act_123",
      timezone: "UTC",
      now: new Date("2026-07-20T12:00:00Z"),
      days: 30,
    });

    const lines = result.csvText.split("\n");
    const headers = lines[0].split(",");
    const dataRows = lines.slice(1).map((line) => line.split(","));
    const { rows } = readRowsWithAutoMap(headers, dataRows);

    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "UTC",
      monthlyBudget: null,
      mtdDailyRows: rows,
      now: new Date("2026-07-20T12:00:00Z"),
    });

    const leadSlide = data.campaignSlides.find((s) => s.campaignName === "Lead Gen Campaign")!;
    expect(leadSlide.resultLabel).toBe("META FORM LEADS");
    expect(leadSlide.metrics.results).toBe("25");
  });
});
