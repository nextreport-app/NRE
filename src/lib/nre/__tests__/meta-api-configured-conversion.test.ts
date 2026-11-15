import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import JSZip from "jszip";
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: vi.fn().mockResolvedValue(null) } } }));
vi.mock("@/lib/meta-api", async original => ({ ...await original<typeof import("@/lib/meta-api")>(), fetchMetaAdAccountInsights: vi.fn(), fetchMetaAdSetReportingConfigs: vi.fn(), fetchMetaAdAccountCampaignPeriodInsights: vi.fn().mockResolvedValue([]) }));
import { fetchMetaAdAccountInsights, fetchMetaAdSetReportingConfigs } from "@/lib/meta-api";
import { validateMetaClickRates } from "../meta-api-sync/validate-click-rates";
import { configuredResultAction } from "../meta-api-sync/configured-result-event";
import { directlyEvidencedResult } from "../meta-api-sync/direct-result-evidence";
import { fetchMetaReportCsv } from "../meta-api-sync";
import { parseCsvText } from "../parse-csv";
import { META_METRIC_DICTIONARY } from "../meta-dictionary";
import { aggregateDynamicMetrics } from "../dynamic-metrics";
import { combinedCtrCpcFromRows } from "../ctr-cpc";
import { buildStandardReportForWizard } from "../report-engine/build-standard-from-wizard";
import { buildVisualChartSlideModel } from "../visual-chart-slide";
import { renderPptx } from "../../pptx/render";
import type { Client } from "@/generated/prisma/client";

const pixel = "offsite_conversion.fb_pixel_lead";
describe("configured website event, independent of generic lead totals", () => {
 it("uses the ad set's real conversion event, not its campaign name", () => {
  expect(configuredResultAction({ id: "1", promoted_object: { pixel_id: "9", custom_event_type: "LEAD" } })).toBe(pixel);
  expect(configuredResultAction({ id: "1", promoted_object: { custom_conversion_id: "22" } })).toBe("offsite_conversion.custom.22");
  expect(configuredResultAction({ id: "1", optimization_goal: "REACH", promoted_object: { pixel_id: "9" } })).toBeUndefined();
 });
 it("rejects mismatched CTR components instead of publishing a contradictory rate", () => {
  expect(() => validateMetaClickRates({ impressions: "10000", clicks: "731", ctr: "5.08" })).toThrow(/click counts and CTR/);
  expect(() => validateMetaClickRates({ impressions: "10000", clicks: "731", ctr: "7.31", inline_link_clicks: "508", inline_link_click_ctr: "5.08" })).not.toThrow();
 });
 it("does not change a zero-event day into generic leads", () => {
  expect(directlyEvidencedResult({ configured_result_action: pixel, spend: "10", results: [{ indicator: "actions:lead", values: [{ value: "2" }] }], actions: [{ action_type: "lead", value: "2" }] })).toMatchObject({ value: "0", cpr: "", action_type: pixel });
 });
 it.each([["21", "23"], ["23", "21"]])("uses canonical actions=%s regardless of a different result-channel count=%s", (canonical, other) => {
  expect(directlyEvidencedResult({ configured_result_action: pixel, spend: "444.63", actions: [{ action_type: pixel, value: canonical }], results: [{ indicator: `actions:${pixel}`, values: [{ value: other }] }], objective_results: [{ indicator: `actions:${pixel}`, values: [{ value: "99" }] }] })?.value).toBe(canonical);
 });
 it("still rejects conflicting duplicate counts within the canonical channel", () => {
  expect(() => directlyEvidencedResult({ configured_result_action: pixel, actions: [{ action_type: pixel, value: "21" }, { action_type: pixel, value: "23" }] })).toThrow(/duplicate conflicting/);
 });
 it("does not backfill a missing configured action from other result channels", () => {
  expect(directlyEvidencedResult({ configured_result_action: pixel, results: [{ indicator: `actions:${pixel}`, values: [{ value: "23" }] }] })?.value).toBe("0");
 });
 it("keeps traffic and form goals tied to their own counts when result channels are not requested", () => {
  const actions = [{ action_type: "link_click", value: "100" }, { action_type: pixel, value: "1" }, { action_type: "onsite_conversion.lead_grouped", value: "5" }, { action_type: "lead", value: "99" }];
  expect(directlyEvidencedResult({ campaign_name: "Old Leads Name", optimization_goal: "LINK_CLICKS", spend: "100", inline_link_clicks: "100", actions })).toMatchObject({ action_type: "link_click", value: "100", cpr: "1" });
  expect(directlyEvidencedResult({ campaign_name: "Old Traffic Name", optimization_goal: "LEAD_GENERATION", spend: "100", actions })).toMatchObject({ action_type: "onsite_conversion.lead_grouped", value: "5", cpr: "20" });
  expect(directlyEvidencedResult({ optimization_goal: "REACH", reach: "1000", actions })).toMatchObject({ action_type: "reach", value: "1000" });
 });
 it("maps 21 website events, not 23 combined leads; preserves cents and distinct CTR definitions in PPT", async () => {
  // Synthetic reproduction of the reported totals; not a downloaded account response.
  vi.mocked(fetchMetaAdAccountInsights).mockResolvedValue([10, 11].map((leads, index) => ({
   campaign_id: "1", campaign_name: "Website campaign", adset_id: String(index + 1), adset_name: `Set ${index + 1}`,
   date_start: "2026-11-04", date_stop: "2026-11-04", spend: index ? "244.63" : "200", impressions: "5000", reach: "2000",
   clicks: index ? "431" : "300", ctr: index ? "8.62" : "6", inline_link_clicks: index ? "308" : "200", inline_link_click_ctr: index ? "6.16" : "4",
   results: [{ indicator: `actions:${pixel}`, values: [{ value: String(leads + 1) }] }],
   objective_results: [{ indicator: `actions:${pixel}`, values: [{ value: String(leads + 2) }] }],
   actions: [{ action_type: "lead", value: String(leads + 1) }, { action_type: pixel, value: String(leads) }],
  })));
  vi.mocked(fetchMetaAdSetReportingConfigs).mockResolvedValue(["1", "2"].map(id => ({ id, optimization_goal: "OFFSITE_CONVERSIONS", promoted_object: { pixel_id: "9", custom_event_type: "LEAD" } })));
  const source = await fetchMetaReportCsv({ accessToken: "fixture-only", adAccountId: "123", currency: "USD", timezone: "America/Los_Angeles", sinceIso: "2026-10-06", untilIso: "2026-11-04", requireDirectResultEvidence: true });
  expect(fetchMetaAdAccountInsights).toHaveBeenCalledWith(expect.objectContaining({ includeResultChannels: false, level: "adset" }));
  const parsed = parseCsvText(source.csvText);
  expect(parsed.rows[0]._raw["NRE API result source"]).toBe("actions.value");
  expect(parsed.rows[0]._raw["NRE API attribution mode"]).toBe("adset_unified");
  expect(parsed.rows[0]._raw["NRE API action report time"]).toBe("impression");
  expect(parsed.rows.reduce((sum, row) => sum + Number(row.results), 0)).toBe(21);
  expect(parsed.rows.reduce((sum, row) => sum + Number(row._raw["Website leads"]), 0)).toBe(21);
  expect(combinedCtrCpcFromRows(parsed.rows).ctr).toBeCloseTo(7.31);
  const rates = aggregateDynamicMetrics(parsed.rows, [{ key: "ctr", format: "percentage", csvName: "ctr (all)" }, { key: "ctr_link", format: "percentage", csvName: "ctr (link click-through rate)" }], "meta");
  expect(rates.ctr).toBeCloseTo(7.31); expect(rates.ctr_link).toBeCloseTo(5.08);
  const client = { id: "fixture", userId: "fixture", accountName: "Website fixture", currency: "USD", timezone: "America/Los_Angeles", monthlyBudget: null, campaignObjectiveCache: null, showBudgetPacingOnCover: false } as Client;
  const form = new FormData(); form.set("reportType", JSON.stringify("WEEKLY")); form.set("dateSelection", JSON.stringify({ mode: "last7" }));
  const keys = ["spend", "reach", "impressions", "website_leads", "cost_per_lead", "ctr", "ctr_link", "cpc_all"];
  form.set("selectedMetrics", JSON.stringify(keys.map(key => META_METRIC_DICTIONARY.find(metric => metric.key === key))));
  form.set("campaignMetricOverrides", JSON.stringify({ "Website campaign": keys }));
  const output = await buildStandardReportForWizard({ client, platform: "META", mtdParsed: parsed, formData: form, now: new Date("2026-11-05T12:00:00Z") });
  if (!("data" in output)) throw new Error(output.error);
  expect(output.data.campaignSlides[0].metrics.results).toBe("21");
  expect(output.data.campaignSlides[0].metrics.cpr).toBe("$21.17");
  expect(output.data.campaignSlides[0].dynamicMetrics.find(metric => metric?.key === "ctr_link")?.value).toBe("5.08%");
  const chart = output.data.chart!;
  const model = buildVisualChartSlideModel(chart, "$");
  expect(model.groupedDonutCenterLabel).toBe("$444.63"); expect(model.summaryLine).toContain("$444.63");
  const ppt = await renderPptx({ templateBuffer: readFileSync("templates/dark.pptx"), data: output.data, currencySymbol: "$" });
  const zip = await JSZip.loadAsync(ppt);
  const text = (await Promise.all(Object.keys(zip.files).filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name)).map(name => zip.file(name)!.async("string")))).join("\n");
  expect(text).toContain("5.08%"); expect(text).toContain("LINK CTR");
  expect(text).toContain("$444.63"); expect(text).toContain("$21.17"); expect(text).not.toContain("$19.33");
 }, 30000);
});
