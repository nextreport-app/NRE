import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/meta-api", () => ({
  fetchMetaAdAccountInsights: vi.fn(),
  fetchMetaAdSetReportingConfigs: vi.fn(),
  fetchMetaCustomConversions: vi.fn(),
  fetchMetaAdAccountCampaignPeriodInsights: vi.fn().mockResolvedValue([]),
}));
import {
  fetchMetaAdAccountInsights,
  fetchMetaAdSetReportingConfigs,
  type MetaInsightRow,
} from "@/lib/meta-api";
import { fetchMetaReportCsv } from "../meta-api-sync/fetch-meta-report-csv";
import { appendMetaFunnelColumns } from "../meta-api-sync/funnel-metrics";
import { parseCsvText } from "../parse-csv";
import { buildCsvMetricHeaderProfile } from "../csv-metric-evidence";
import { buildCampaignObjectiveMapWithConfidence } from "../objective";
import { buildCampaignMetricBundle } from "../wizard-campaign-metrics";
import { buildComparisonExtraMetrics } from "../comparison-extra-metrics";
const row: MetaInsightRow = {
  campaign_id: "campaign",
  campaign_name: "Purchase campaign",
  adset_id: "adset",
  adset_name: "Broad",
  date_start: "2026-11-20",
  spend: "30",
  impressions: "200",
  reach: "100",
  inline_link_clicks: "10",
  inline_link_click_ctr: "5",
  clicks: "20",
  ctr: "10",
  actions: [
    { action_type: "offsite_conversion.fb_pixel_purchase", value: "3" },
    { action_type: "offsite_conversion.fb_pixel_add_to_cart", value: "14" },
    { action_type: "add_to_cart", value: "14" },
    { action_type: "omni_add_to_cart", value: "14" },
    {
      action_type: "offsite_conversion.fb_pixel_initiate_checkout",
      value: "5",
    },
    { action_type: "omni_initiated_checkout", value: "5" },
  ],
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchMetaAdAccountInsights).mockResolvedValue([row]);
  vi.mocked(fetchMetaAdSetReportingConfigs).mockResolvedValue([
    {
      id: "adset",
      optimization_goal: "OFFSITE_CONVERSIONS",
      promoted_object: { custom_event_type: "PURCHASE", pixel_id: "pixel" },
    },
  ]);
});
describe("API purchase funnel preservation", () => {
  it("carries returned funnel counts through strict API CSV, campaign selection and rendered metric values without changing purchases", async () => {
    const result = await fetchMetaReportCsv({
      accessToken: "test",
      adAccountId: "123",
      timezone: "UTC",
      currency: "USD",
      sinceIso: "2026-11-20",
      untilIso: "2026-11-20",
      requireDirectResultEvidence: true,
    });
    const parsed = parseCsvText(result.csvText),
      profile = buildCsvMetricHeaderProfile(parsed.headers, parsed.rows);
    expect(parsed.rows[0].results).toBe("3");
    expect(parsed.rows[0]._raw["Adds to cart"]).toBe("14");
    expect(parsed.rows[0]._raw["Initiate checkout"]).toBe("5");
    expect(
      buildCampaignObjectiveMapWithConfidence(parsed.rows).get(
        "purchase campaign",
      )?.resultLabel,
    ).toBe("PURCHASES");
    const metrics = buildCampaignMetricBundle(
      "META",
      parsed.headers,
      "PURCHASES",
      "COST PER PURCHASE",
      undefined,
      profile.campaigns["purchase campaign"],
    );
    expect(metrics.selection.map((m) => m.key)).toEqual(
      expect.arrayContaining([
        "results",
        "cost_per_result",
        "add_to_cart",
        "initiate_checkout",
      ]),
    );
    const extras = buildComparisonExtraMetrics({
      rowsA: parsed.rows,
      rowsB: [],
      keys: ["add_to_cart", "initiate_checkout"],
      headers: parsed.headers,
      platform: "META",
      currencySymbol: "$",
      objective: "PURCHASES",
      costLabel: "COST PER PURCHASE",
    });
    expect(extras.map((m) => m.valueA)).toEqual([14, 5]);
  });
  it("keeps explicit zeroes, missing events and each campaign's evidence distinct", () => {
    const headers = [
      "Campaign name",
      "Results",
      "Cost per result",
      "Amount spent (USD)",
      "Reach",
      "Impressions",
      "CTR (all)",
      "Link clicks",
      "Landing page views",
    ];
    const rows = [
      ["Purchase A", "3", "10", "30", "100", "200", "10", "10", "8"],
      ["Purchase B", "1", "30", "30", "100", "200", "10", "10", "8"],
    ];
    appendMetaFunnelColumns(headers, rows, [
      {
        actions: [
          { action_type: "add_to_cart", value: "0" },
          { action_type: "initiate_checkout", value: "2" },
        ],
      },
      {},
    ]);
    expect(rows[0].slice(-2)).toEqual(["0", "2"]);
    expect(rows[1].slice(-2)).toEqual(["", ""]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n"),
      parsed = parseCsvText(csv),
      profile = buildCsvMetricHeaderProfile(parsed.headers, parsed.rows);
    const first = buildCampaignMetricBundle(
      "META",
      headers,
      "PURCHASES",
      "COST PER PURCHASE",
      undefined,
      profile.campaigns["purchase a"],
    );
    const second = buildCampaignMetricBundle(
      "META",
      headers,
      "PURCHASES",
      "COST PER PURCHASE",
      undefined,
      profile.campaigns["purchase b"],
    );
    expect(first.selection.map((m) => m.key)).toContain("add_to_cart");
    expect(
      [...second.selection, ...second.available].map((m) => m.key),
    ).not.toContain("add_to_cart");
    expect(
      [...second.selection, ...second.available].map((m) => m.key),
    ).not.toContain("initiate_checkout");
  });
  it.each(["actions", "conversions"] as const)(
    "supports %s evidence without summing aliases or channels",
    (channel) => {
      const headers: string[] = [],
        rows = [[] as string[]];
      appendMetaFunnelColumns(headers, rows, [
        {
          [channel]: [
            {
              action_type: "offsite_conversion.fb_pixel_add_to_cart",
              value: "4",
            },
            { action_type: "omni_add_to_cart", value: "99" },
            { action_type: "initiate_checkout", value: "2" },
          ],
        },
      ]);
      expect(rows[0]).toEqual(["4", "2"]);
    },
  );
  it("preserves a website zero instead of substituting a broader nonzero alias", () => {
    const headers: string[] = [],
      rows = [[] as string[]];
    appendMetaFunnelColumns(headers, rows, [
      {
        actions: [
          {
            action_type: "offsite_conversion.fb_pixel_add_to_cart",
            value: "0",
          },
          { action_type: "omni_add_to_cart", value: "12" },
        ],
      },
    ]);
    expect(rows[0]).toEqual(["0"]);
  });
  it("does not infer events from purchase totals, costs or similar custom event names", () => {
    const headers: string[] = [],
      rows = [[] as string[]];
    appendMetaFunnelColumns(headers, rows, [
      {
        actions: [
          { action_type: "offsite_conversion.fb_pixel_purchase", value: "3" },
          { action_type: "custom_add_to_cart_interest", value: "20" },
        ],
        cost_per_action_type: [{ action_type: "add_to_cart", value: "2" }],
      },
    ]);
    expect(headers).toEqual([]);
    expect(rows).toEqual([[]]);
  });
  it.each(["-1", "NaN", ""])("rejects invalid returned counts (%s)", (value) =>
    expect(() =>
      appendMetaFunnelColumns(
        [],
        [[]],
        [{ actions: [{ action_type: "add_to_cart", value }] }],
      ),
    ).toThrow("invalid or conflicting"),
  );
  it("rejects conflicting duplicates of the same action instead of counting both", () =>
    expect(() =>
      appendMetaFunnelColumns(
        [],
        [[]],
        [
          {
            actions: [
              { action_type: "add_to_cart", value: "3" },
              { action_type: "add_to_cart", value: "4" },
            ],
          },
        ],
      ),
    ).toThrow("invalid or conflicting"));
});
