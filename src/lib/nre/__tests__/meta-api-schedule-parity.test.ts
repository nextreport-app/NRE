import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import JSZip from "jszip";
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: vi.fn().mockResolvedValue(null) } } }));
vi.mock("@/lib/meta-api", async original => ({ ...await original<typeof import("@/lib/meta-api")>(), fetchMetaAdAccountInsights: vi.fn(), fetchMetaAdSetReportingConfigs: vi.fn(), fetchMetaCustomConversions: vi.fn(), fetchMetaAdAccountCampaignPeriodInsights: vi.fn().mockResolvedValue([]) }));
import { fetchMetaAdAccountInsights, fetchMetaAdSetReportingConfigs, fetchMetaCustomConversions, type MetaInsightRow } from "@/lib/meta-api";
import { fetchMetaReportCsv } from "../meta-api-sync";
import { parseCsvText } from "../parse-csv";
import { buildCampaignObjectiveMapWithConfidence, normalizeCampaignName } from "../objective";
import { extractCampaignNames, extractCampaignSpend } from "../campaigns";
import { resolveObjectiveFromResultType } from "../result-type-map";
import { metaApiActionToCsvResultType } from "../meta-objective-dictionary";
import { buildCampaignMetricBundle } from "../wizard-campaign-metrics";
import { listSelectableMetrics } from "../available-metrics";
import { cachedObjectiveAgreesWithDetection } from "../objective-cache";
import { buildStandardReportForWizard } from "../report-engine/build-standard-from-wizard";
import { renderPptx } from "../../pptx/render";
import type { Client } from "@/generated/prisma/client";

// Default: repository regression fixture. An optional local user CSV can be
// checked without copying private account data into the repository.
const manual = parseCsvText(readFileSync(process.env.SCHEDULE_PARITY_CSV ?? "src/lib/nre/__tests__/fixtures/dc-unstoppable-website-schedule-weekly.csv", "utf8"));
const name = "Unstoppable365_Website_Leads";
const key = normalizeCampaignName(name);
const dates = manual.rows.map(row => row._raw.Day).sort();
const sinceIso = dates[0], untilIso = dates.at(-1)!;
const now = new Date(untilIso + "T12:00:00Z"); now.setUTCDate(now.getUTCDate() + 1);
const campaignIds = new Map(extractCampaignNames(manual.rows).map((name, i) => [name, String(i + 1)]));
const adsets = [...new Map(manual.rows.map(row => [`${row.campaign_name}\0${row.ad_set_name}`, row])).entries()];
const adsetIds = new Map(adsets.map(([name], i) => [name, String(100 + i)]));
const templateBuffer = readFileSync("templates/dark.pptx");

function providerFixture(custom: boolean) {
  const schedule = custom ? "offsite_conversion.custom.9001" : "offsite_conversion.fb_pixel_schedule";
  vi.mocked(fetchMetaAdAccountInsights).mockResolvedValue(manual.rows.map(row => {
    const count = Number(row.results) || 0;
    const actionType = row.campaign_name === name ? schedule : "onsite_conversion.messaging_conversation_started_7d";
    return {
      campaign_id: campaignIds.get(row.campaign_name!), campaign_name: row.campaign_name,
      adset_id: adsetIds.get(`${row.campaign_name}\0${row.ad_set_name}`), adset_name: row.ad_set_name,
      date_start: row._raw.Day, date_stop: row._raw.Day, spend: row.spend,
      reach: row.reach, impressions: row.impressions, ctr: row.ctr, cpc: row.cpc,
      inline_link_clicks: row.link_clicks, frequency: row.frequency,
      actions: [...(count ? [{ action_type: actionType, value: String(count) }] : []), { action_type: "link_click", value: row.link_clicks || "0" }, { action_type: "landing_page_view", value: row.landing_page_views || "0" }],
      cost_per_action_type: count ? [{ action_type: actionType, value: String(Number(row.spend) / count) }] : [],
    } satisfies MetaInsightRow;
  }));
  vi.mocked(fetchMetaAdSetReportingConfigs).mockResolvedValue(adsets.map(([set, row]) => ({ id: adsetIds.get(set)!, optimization_goal: row.campaign_name === name ? "OFFSITE_CONVERSIONS" : "CONVERSATIONS", promoted_object: row.campaign_name === name ? custom ? { custom_conversion_id: "9001" } : { pixel_id: "8001", custom_event_type: "SCHEDULE" } : {} })));
  vi.mocked(fetchMetaCustomConversions).mockResolvedValue([{ id: "9001", name: "CONVERSIONS:SCHEDULE_WEBSITE" }]);
}
beforeEach(() => vi.clearAllMocks());
describe("website schedule detection is shared by CSV and API", () => {
  it("keeps generic appointments distinct from a website pixel schedule event", () => {
    expect(resolveObjectiveFromResultType("Website appointments scheduled")?.key).toBe("website_schedule");
    expect(resolveObjectiveFromResultType("offsite_conversion.fb_pixel_schedule")?.key).toBe("website_schedule");
    expect(metaApiActionToCsvResultType("offsite_conversion.fb_pixel_schedule")).toBe("Website appointments scheduled");
    expect(resolveObjectiveFromResultType("Schedule")?.key).toBe("appointment_leads");
  });
  it.each([false, true])("matches campaigns, objective, metric labels and PPT results for custom=%s", async custom => {
    // These API responses are synthetic counterparts of the CSV facts, not captured provider responses.
    providerFixture(custom);
    const source = await fetchMetaReportCsv({ accessToken: "fixture", adAccountId: "123", currency: "USD", timezone: "UTC", sinceIso, untilIso, requireDirectResultEvidence: true });
    const api = parseCsvText(source.csvText);
    expect(extractCampaignNames(api.rows)).toEqual(extractCampaignNames(manual.rows));
    expect(extractCampaignSpend(api.rows)).toEqual(extractCampaignSpend(manual.rows));
    const expected = buildCampaignObjectiveMapWithConfidence(manual.rows);
    const detected = buildCampaignObjectiveMapWithConfidence(api.rows);
    expect(Object.fromEntries(detected)).toEqual(Object.fromEntries(expected));
    expect(detected.get(key)?.resultLabel).toBe("WEBSITE SCHEDULE");
    expect(cachedObjectiveAgreesWithDetection({ key: "appointment_leads", resultLabel: "APPOINTMENT LEADS", costLabel: "COST PER BOOKING" }, detected.get(key)!)).toBe(false);
    if (!custom) expect(listSelectableMetrics(api.headers, "META").some(metric => metric.key === "website_appointments")).toBe(true);
    const outputs = [];
    for (const parsed of [manual, api]) {
      const bundle = buildCampaignMetricBundle("META", parsed.headers, "WEBSITE SCHEDULE", "COST PER BOOKING");
      expect(bundle.selection.map(metric => metric.label)).toContain("WEBSITE SCHEDULE");
      expect(bundle.selection.map(metric => metric.label)).toContain("COST PER BOOKING");
      const form = new FormData(); form.set("reportType", JSON.stringify("WEEKLY")); form.set("dateSelection", JSON.stringify({ mode: "last7" })); form.set("selectedCampaigns", JSON.stringify([name]));
      const client = { id: "fixture", userId: "fixture", accountName: "Scheduling fixture", currency: "USD", timezone: "UTC", monthlyBudget: null, showBudgetPacingOnCover: false, campaignObjectiveCache: JSON.stringify({ [key]: { key: "appointment_leads", resultLabel: "APPOINTMENT LEADS", costLabel: "COST PER BOOKING" } }) } as Client;
      const output = await buildStandardReportForWizard({ client, platform: "META", mtdParsed: parsed, formData: form, now });
      if (!("data" in output)) throw new Error(output.error);
      const slide = output.data.campaignSlides[0];
      expect(slide.ai.resultLabel).toBe("WEBSITE SCHEDULE");
      const ppt = await renderPptx({ templateBuffer, data: output.data, currencySymbol: "$" });
      const zip = await JSZip.loadAsync(ppt);
      const text = (await Promise.all(Object.keys(zip.files).filter(path => /^ppt\/slides\/slide\d+\.xml$/.test(path)).map(path => zip.file(path)!.async("string")))).join("\n");
      expect(text).toContain("WEBSITE SCHEDULE"); expect(text).not.toContain("APPOINTMENT LEADS");
      outputs.push({ results: slide.metrics.results, cpr: slide.metrics.cpr, chart: output.data.chart?.campaigns.map(c => ({ results: c.results, label: c.resLabel })) });
    }
    expect(outputs[0]).toEqual(outputs[1]);
  }, 30000);
  it("retains custom event identity so the shared detector can apply a refreshed catalog", async () => {
    providerFixture(true); vi.mocked(fetchMetaCustomConversions).mockRejectedValue(new Error("temporary provider issue"));
    const source = await fetchMetaReportCsv({ accessToken: "fixture", adAccountId: "123", currency: "USD", timezone: "UTC", sinceIso, untilIso, requireDirectResultEvidence: true });
    const rows = parseCsvText(source.csvText).rows;
    expect(rows.find(row => row.campaign_name === name)?._raw["Result indicator"]).toBe("actions:offsite_conversion.custom.9001");
    expect(buildCampaignObjectiveMapWithConfidence(rows, { "9001": "CONVERSIONS:SCHEDULE_WEBSITE" }).get(key)?.resultLabel).toBe("WEBSITE SCHEDULE");
  });
});
