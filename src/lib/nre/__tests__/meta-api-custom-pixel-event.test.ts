import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import JSZip from "jszip";
vi.mock("@/lib/meta-api", async original => ({ ...await original<typeof import("@/lib/meta-api")>(), fetchMetaAdAccountInsights: vi.fn(), fetchMetaAdSetReportingConfigs: vi.fn(), fetchMetaAdAccountCampaignPeriodInsights: vi.fn().mockResolvedValue([]) }));
import { fetchMetaAdAccountInsights, fetchMetaAdSetReportingConfigs, type MetaInsightRow } from "@/lib/meta-api";
import { configuredCustomEventName, configuredResultAction } from "../meta-api-sync/configured-result-event";
import { directlyEvidencedResult, configuredResultCountSource } from "../meta-api-sync/direct-result-evidence";
import { fetchMetaReportCsv } from "../meta-api-sync";
import { parseCsvText } from "../parse-csv";
import { resolveObjectiveFromResultType } from "../result-type-map";
import { buildReportData } from "../report-data";
import { renderPptx } from "../../pptx/render";

const event = "invitee_scheduling_page";
const specific = `offsite_conversion.fb_pixel_${event}`;
const config = { id: "1", optimization_goal: "OFFSITE_CONVERSIONS", promoted_object: { pixel_id: "9", custom_event_type: "OTHER", custom_event_str: event } };
const base: MetaInsightRow = { configured_result_action: specific, configured_result_type: event, configured_custom_event_name: event, spend: "30" };
beforeEach(() => vi.clearAllMocks());
describe("named custom pixel event configuration", () => {
 it("reads OTHER + custom_event_str without relabelling it as Schedule or Leads", () => {
  expect(configuredResultAction(config)).toBe(specific);
  expect(configuredCustomEventName(config)).toBe(event);
  expect(resolveObjectiveFromResultType(event)).toMatchObject({ key: event, resultLabel: "INVITEE SCHEDULING PAGE", costLabel: "COST PER INVITEE SCHEDULING PAGE" });
 });
 it("keeps custom-conversion IDs authoritative over custom names", () => {
  const withId = { ...config, promoted_object: { ...config.promoted_object, custom_conversion_id: "22" } };
  expect(configuredResultAction(withId)).toBe("offsite_conversion.custom.22");
  expect(configuredCustomEventName(withId)).toBeUndefined();
 });
 it.each([undefined, "", "custom", "schedule", "bad event/name"])("does not invent a custom event identity from %s", custom_event_str => {
  expect(() => configuredResultAction({ ...config, promoted_object: { ...config.promoted_object, custom_event_str } })).toThrow(/could not be mapped/);
 });
 it("does not override a traffic optimization goal", () => {
  expect(configuredResultAction({ ...config, optimization_goal: "LINK_CLICKS" })).toBeUndefined();
 });
});
describe("custom event count provenance", () => {
 it("keeps zero-event days at zero despite unrelated leads and clicks", () => {
  const row = { ...base, actions: [{ action_type: "lead", value: "19" }, { action_type: "link_click", value: "99" }] };
  expect(directlyEvidencedResult(row)).toMatchObject({ value: "0", cpr: "", csvResultType: event });
  expect(configuredResultCountSource(row)).toBe("custom_event_absent");
 });
 it.each([specific, event])("uses only the exact configured event action %s", action_type => {
  const row = { ...base, actions: [{ action_type, value: "3" }, { action_type: "offsite_conversion.fb_pixel_custom", value: "50" }, { action_type: "offsite_conversion.fb_pixel_schedule", value: "90" }] };
  expect(directlyEvidencedResult(row)).toMatchObject({ value: "3", cpr: "10", csvResultType: event });
  expect(configuredResultCountSource(row)).toBe(`actions.${action_type}.value`);
 });
 it("supports an exact named conversion field when it is supplied separately", () => {
  const row = { ...base, conversions: [{ action_type: event, value: "2" }] };
  expect(directlyEvidencedResult(row)).toMatchObject({ value: "2", cpr: "15" });
  expect(configuredResultCountSource(row)).toBe(`conversions.${event}.value`);
 });
 it.each(["actions", "conversions"] as const)("never substitutes positive combined custom-event counts from %s", channel => {
  expect(() => directlyEvidencedResult({ ...base, [channel]: [{ action_type: "offsite_conversion.fb_pixel_custom", value: "5" }] })).toThrow(/combined custom-event counts/);
 });
 it("does not sum two representations of the same event", () => {
  expect(directlyEvidencedResult({ ...base, actions: [{ action_type: specific, value: "3" }, { action_type: event, value: "3" }] })?.value).toBe("3");
  expect(() => directlyEvidencedResult({ ...base, actions: [{ action_type: specific, value: "3" }, { action_type: event, value: "4" }] })).toThrow(/conflicting counts/);
 });
 it("rejects contradictory duplicates within the named channel", () => {
  expect(() => directlyEvidencedResult({ ...base, actions: [{ action_type: specific, value: "3" }, { action_type: specific, value: "4" }] })).toThrow(/duplicate conflicting/);
 });
});
describe("mixed-account import and report output", () => {
 it.each([0, 3])("imports %s invitee events alongside form leads and preserves counts and labels in PPT", async count => {
  // Synthetic responses reproduce the uploaded export's zero-event case;
  // they are not captured responses from the user's live Meta account.
  vi.mocked(fetchMetaAdAccountInsights).mockResolvedValue([
   { campaign_id: "1", campaign_name: "Custom event campaign", adset_id: "1", adset_name: "Set A", date_start: "2026-11-15", date_stop: "2026-11-15", spend: "13.22", reach: "82", impressions: "101", actions: [{ action_type: "link_click", value: "3" }, ...(count ? [{ action_type: event, value: String(count) }] : [])] },
   { campaign_id: "2", campaign_name: "Form campaign", adset_id: "2", adset_name: "Set B", date_start: "2026-11-15", date_stop: "2026-11-15", spend: "20", reach: "50", impressions: "100", actions: [{ action_type: "onsite_conversion.lead_grouped", value: "4" }] },
  ]);
  vi.mocked(fetchMetaAdSetReportingConfigs).mockResolvedValue([config, { id: "2", optimization_goal: "LEAD_GENERATION", promoted_object: {} }]);
  const source = await fetchMetaReportCsv({ accessToken: "fixture", adAccountId: "123", currency: "USD", timezone: "UTC", sinceIso: "2026-11-09", untilIso: "2026-11-15", requireDirectResultEvidence: true });
  const parsed = parseCsvText(source.csvText);
  expect(parsed.rows.find(row => row.campaign_name === "Custom event campaign")).toMatchObject({ result_type: event, results: String(count) });
  const customRow = parsed.rows.find(row => row.campaign_name === "Custom event campaign")!;
  expect(customRow._raw["NRE API result source"]).toBe(count ? `actions.${event}.value` : "custom_event_absent");
  expect(customRow._raw["Result indicator"]).toBe(count ? `actions:${event}` : `configured:${event}`);
  expect(parsed.rows.find(row => row.campaign_name === "Form campaign")?.results).toBe("4");
  const data = buildReportData({ accountName: "Custom event fixture", currencySymbol: "$", timezone: "UTC", monthlyBudget: null, mtdDailyRows: parsed.rows, now: new Date("2026-11-16T12:00:00Z") });
  const slide = data.campaignSlides.find(slide => slide.campaignName === "Custom event campaign")!;
  expect(slide.resultLabel).toBe("INVITEE SCHEDULING PAGE");
  expect(slide.metrics.results).toBe(String(count));
  if (count) expect(slide.metrics.cpr).toBe("$4.41");
  expect(data.chart?.campaigns.find(campaign => campaign.name === "Custom event campaign")?.results).toBe(count);
  expect(data.mtdRow.resultColumns.find(column => column.label === "INVITEE SCHEDULING PAGE")?.value).toBe(String(count));
  const deck = await renderPptx({ templateBuffer: readFileSync("templates/dark.pptx"), data, currencySymbol: "$" });
  const zip = await JSZip.loadAsync(deck);
  const text = (await Promise.all(Object.keys(zip.files).filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name)).map(name => zip.file(name)!.async("string")))).join("\n");
  expect(text).toContain("INVITEE SCHEDULING PAGE");
 });
});
