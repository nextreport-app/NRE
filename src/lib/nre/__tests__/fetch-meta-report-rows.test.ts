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

  it("returns null instead of link_click for lead-family goals when only traffic actions exist", () => {
    const row: MetaInsightRow = {
      campaign_name: "Lead Campaign_Messaging",
      actions: [{ action_type: "link_click", value: "248" }],
      optimization_goal: "LEAD_GENERATION",
    };
    expect(pickResultAction(row)).toBeNull();
  });

  it("prefers messaging actions over higher link_click counts for messenger lead campaigns", () => {
    const row: MetaInsightRow = {
      campaign_name: "Lead Campaign_Messaging",
      actions: [
        { action_type: "link_click", value: "248" },
        { action_type: "onsite_conversion.messaging_conversation_started_7d", value: "3" },
      ],
      optimization_goal: "LEAD_GENERATION",
    };
    expect(pickResultAction(row)).toEqual({
      action_type: "onsite_conversion.messaging_conversation_started_7d",
      value: "3",
    });
  });

  it("prefers website lead actions over incidental messaging for OUTCOME_LEADS website-leads campaigns", () => {
    const row: MetaInsightRow = {
      campaign_name: "FullGorillaApparel_Leads",
      actions: [
        { action_type: "link_click", value: "248" },
        { action_type: "offsite_conversion.fb_pixel_lead", value: "12" },
        { action_type: "onsite_conversion.messaging_conversation_started_7d", value: "1" },
      ],
      cost_per_action_type: [{ action_type: "offsite_conversion.fb_pixel_lead", value: "4.50" }],
      optimization_goal: "OUTCOME_LEADS",
    };
    expect(pickResultAction(row)).toEqual({
      action_type: "offsite_conversion.fb_pixel_lead",
      value: "12",
    });
  });

  it("recognizes Website_TOF naming and prefers website leads over stray messaging", () => {
    const row: MetaInsightRow = {
      campaign_name: "Lead Campaign_ Website_TOF",
      adset_name: "Lead Campaign_ Website_TOF-broad",
      actions: [
        { action_type: "link_click", value: "215" },
        { action_type: "landing_page_view", value: "130" },
        { action_type: "offsite_conversion.fb_pixel_lead", value: "5" },
        { action_type: "onsite_conversion.messaging_conversation_started_7d", value: "1" },
      ],
      cost_per_action_type: [{ action_type: "offsite_conversion.fb_pixel_lead", value: "9.00" }],
      optimization_goal: "OUTCOME_LEADS",
    };
    expect(pickResultAction(row)).toEqual({
      action_type: "offsite_conversion.fb_pixel_lead",
      value: "5",
    });
  });

  it("returns null for website-leads campaigns when only generic lead exists (Meta CSV leaves day blank)", () => {
    const row: MetaInsightRow = {
      campaign_name: "New Leads campaign_Kaizen Homes_Website",
      actions: [{ action_type: "lead", value: "2" }],
      optimization_goal: "OUTCOME_LEADS",
    };
    expect(pickResultAction(row)).toBeNull();
  });

  it("returns null for website-leads campaigns when only incidental meta-form lead exists", () => {
    const row: MetaInsightRow = {
      campaign_name: "New Leads campaign_Kaizen Homes_Website",
      actions: [
        { action_type: "link_click", value: "24" },
        { action_type: "landing_page_view", value: "11" },
        { action_type: "onsite_conversion.lead_grouped", value: "1" },
      ],
      optimization_goal: "OUTCOME_LEADS",
    };
    expect(pickResultAction(row)).toBeNull();
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

  it("does not double-count multiple website-lead action types in Website leads column", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          data: [
            {
              campaign_name: "New Leads campaign_Kaizen Homes_Website",
              adset_name: "New Leads campaign_Kaizen Homes_Website",
              date_start: "2026-09-06",
              spend: "15.05",
              reach: "620",
              impressions: "817",
              optimization_goal: "OUTCOME_LEADS",
              actions: [
                { action_type: "offsite_conversion.fb_pixel_lead", value: "3" },
                { action_type: "website_lead", value: "3" },
                { action_type: "onsite_web_lead", value: "3" },
              ],
              cost_per_action_type: [{ action_type: "offsite_conversion.fb_pixel_lead", value: "5.02" }],
            },
          ],
        }),
      })),
    );

    const result = await fetchMetaReportCsv({
      accessToken: "token",
      adAccountId: "act_123",
      timezone: "UTC",
      sinceIso: "2026-09-06",
      untilIso: "2026-09-06",
    });

    const lines = result.csvText.split("\n");
    const headers = lines[0].split(",");
    const wlIdx = headers.indexOf("Website leads");
    const values = lines[1].split(",");
    expect(values[wlIdx]).toBe("3");
    vi.unstubAllGlobals();
  });

  it("matches manual CSV lead totals for Kaizen-style API rows (no stray leads on blank days)", async () => {
    const kaizenLeadDays: Array<{ date: string; leads: number; spend: string }> = [
      { date: "2026-09-15", leads: 2, spend: "11.51" },
      { date: "2026-09-14", leads: 1, spend: "10.11" },
      { date: "2026-09-13", leads: 1, spend: "11.30" },
      { date: "2026-09-07", leads: 2, spend: "11.87" },
      { date: "2026-09-06", leads: 3, spend: "15.05" },
      { date: "2026-09-04", leads: 1, spend: "7.55" },
    ];
    const blankDays = ["2026-09-12", "2026-09-11", "2026-09-10", "2026-09-09", "2026-09-08"];

    const data = [
      ...kaizenLeadDays.map(({ date, leads, spend }) => ({
        campaign_name: "New Leads campaign_Kaizen Homes_Website",
        adset_name: "New Leads campaign_Kaizen Homes_Website",
        date_start: date,
        spend,
        reach: "500",
        impressions: "600",
        optimization_goal: "OUTCOME_LEADS",
        actions: [{ action_type: "offsite_conversion.fb_pixel_lead", value: String(leads) }],
        cost_per_action_type: [{ action_type: "offsite_conversion.fb_pixel_lead", value: "5.00" }],
      })),
      ...blankDays.map((date) => ({
        campaign_name: "New Leads campaign_Kaizen Homes_Website",
        adset_name: "New Leads campaign_Kaizen Homes_Website",
        date_start: date,
        spend: "8.00",
        reach: "400",
        impressions: "500",
        optimization_goal: "OUTCOME_LEADS",
        actions: [
          { action_type: "link_click", value: "24" },
          { action_type: "landing_page_view", value: "11" },
          { action_type: "lead", value: "2" },
          { action_type: "onsite_conversion.lead_grouped", value: "1" },
        ],
      })),
    ];

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ data }),
      })),
    );

    const result = await fetchMetaReportCsv({
      accessToken: "token",
      adAccountId: "act_123",
      timezone: "UTC",
      sinceIso: "2026-09-01",
      untilIso: "2026-09-15",
    });

    const lines = result.csvText.split("\n");
    const headers = lines[0].split(",");
    const dataRows = lines.slice(1).map((line) => line.split(","));
    const { rows } = readRowsWithAutoMap(headers, dataRows);

    const report = buildReportData({
      accountName: "Kaizen",
      currencySymbol: "$",
      timezone: "UTC",
      monthlyBudget: null,
      mtdDailyRows: rows,
      now: new Date("2026-09-16T12:00:00Z"),
    });

    const wlCol = report.mtdRow.resultColumns.find((c) => c.label === "WEBSITE LEADS");
    expect(wlCol?.value).toBe("10");
    vi.unstubAllGlobals();
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
