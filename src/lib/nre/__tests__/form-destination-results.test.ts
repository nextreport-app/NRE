import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/meta-api", async original => ({ ...await original<typeof import("@/lib/meta-api")>(), fetchMetaAdAccountInsights: vi.fn(), fetchMetaAdSetInstantFormDestinations: vi.fn() }));
import { fetchMetaAdAccountInsights, fetchMetaAdSetInstantFormDestinations, type MetaInsightRow } from "@/lib/meta-api";
import { directlyEvidencedResult, configuredResultCountSource } from "../meta-api-sync/direct-result-evidence";
import { resolveFormDestinations } from "../meta-api-sync/resolve-form-destinations";
const type = "onsite_conversion.lead_grouped";
// Reproduces the observed count/destination split using generic identities.
const row: MetaInsightRow = { campaign_id: "10", adset_id: "20", campaign_name: "Forms", date_start: "2026-10-24", date_stop: "2026-10-24", spend: "44.5", optimization_goal: "LEAD_GENERATION", actions: [{ action_type: type, value: "6" }, { action_type: "onsite_conversion.lead", value: "1" }] };
const breakdown: MetaInsightRow = { ...row, actions: [{ action_type: type, value: "5", action_destination: "200" }, { action_type: type, value: "1", action_destination: "Example Page" }] };
const input = { accessToken: "fixture", adAccountId: "123", sinceIso: "2026-10-01", untilIso: "2026-10-31" };
beforeEach(() => { vi.clearAllMocks(); vi.mocked(fetchMetaAdSetInstantFormDestinations).mockResolvedValue({ formIds: ["200"], pageIds: [] }); vi.mocked(fetchMetaAdAccountInsights).mockResolvedValue([breakdown]); });
describe("configured instant-form destination Results", () => {
  it("uses the directly reported five for the verified form, retaining six grouped leads and $44.50 spend", async () => {
    const [resolved] = await resolveFormDestinations([row], input);
    expect(directlyEvidencedResult(resolved)).toMatchObject({ value: "5", cpr: "8.9" });
    expect(resolved.spend).toBe("44.5"); expect(resolved.actions).toEqual(row.actions);
    expect(configuredResultCountSource(resolved)).toBe("actions.value:configured_form_destination");
    expect(fetchMetaAdSetInstantFormDestinations).toHaveBeenCalledWith("fixture", "20", { adAccountId: "123", sinceIso: "2026-10-01", untilIso: "2026-10-31" });
  });
  it("counts a verified owning Page ID that differs from the form ID (the production mismatch)", async () => {
    vi.mocked(fetchMetaAdSetInstantFormDestinations).mockResolvedValue({ formIds: ["200"], pageIds: ["300"] });
    vi.mocked(fetchMetaAdAccountInsights).mockResolvedValue([{ ...breakdown, actions: [{ action_type: type, value: "5", action_destination: "300" }, { action_type: type, value: "1", action_destination: "Example Profile" }] }]);
    const [resolved] = await resolveFormDestinations([row], input);
    expect(resolved.configured_form_ids).toEqual(["200"]); expect(resolved.configured_form_page_ids).toEqual(["300"]);
    expect(directlyEvidencedResult(resolved)).toMatchObject({ value: "5", cpr: "8.9" });
  });
  it("counts an explicitly published form-bearing story whose ID differs from both form and Page", async () => {
    vi.mocked(fetchMetaAdSetInstantFormDestinations).mockResolvedValue({ formIds: ["200"], pageIds: ["300"], storyIds: ["300_500", "500"], adIds: ["700"] });
    vi.mocked(fetchMetaAdAccountInsights).mockResolvedValue([{ ...breakdown, actions: [{ action_type: type, value: "5", action_destination: "500" }, { action_type: type, value: "1", action_destination: "Example Profile" }] }]);
    const [resolved] = await resolveFormDestinations([row], input);
    expect(resolved.configured_delivery_ad_ids).toEqual(["700"]);
    expect(directlyEvidencedResult(resolved)).toMatchObject({ value: "5", cpr: "8.9" });
  });
  it("uses all verified form IDs, including a secondary form in the same ad set", async () => {
    vi.mocked(fetchMetaAdSetInstantFormDestinations).mockResolvedValue({ formIds: ["200", "201"], pageIds: [] });
    vi.mocked(fetchMetaAdAccountInsights).mockResolvedValue([{ ...breakdown, actions: [{ action_type: type, value: "3", action_destination: "200" }, { action_type: type, value: "2", action_destination: "201" }, { action_type: type, value: "1", action_destination: "Example Page" }] }]);
    expect(directlyEvidencedResult((await resolveFormDestinations([row], input))[0])?.value).toBe("5");
  });
  it.each([
    [{ action_type: type, value: "5", action_destination: "999" }, { action_type: type, value: "1", action_destination: "Example Page" }],
    [{ action_type: type, value: "6" }],
    [{ action_type: type, value: "5", action_destination: "200" }],
    [{ action_type: type, value: "3", action_destination: "200" }, { action_type: type, value: "3", action_destination: "200" }],
  ])("rejects unknown forms, absent destinations, mismatching totals or duplicate destinations", async (...actions) => {
    vi.mocked(fetchMetaAdAccountInsights).mockResolvedValue([{ ...breakdown, actions }]);
    expect(() => directlyEvidencedResult({ ...row, form_destination_status: "verified", configured_form_ids: ["200"], form_destination_actions: actions })).toThrow(/could not be verified/);
  });
  it("never classifies a numeric destination as a form without configured creative evidence", async () => {
    vi.mocked(fetchMetaAdSetInstantFormDestinations).mockResolvedValue({ formIds: [], pageIds: [] });
    const [resolved] = await resolveFormDestinations([row], input);
    expect(resolved.form_destination_status).toBe("configuration_unavailable");
    expect(fetchMetaAdAccountInsights).not.toHaveBeenCalled();
    expect(() => directlyEvidencedResult(resolved)).toThrow(/could not be verified/);
  });
  it("preserves verified IDs when a destination request is unavailable and still stops", async () => {
    vi.mocked(fetchMetaAdAccountInsights).mockRejectedValue(new Error("provider unavailable"));
    const [resolved] = await resolveFormDestinations([row], input);
    expect(resolved).toMatchObject({ configured_form_ids: ["200"], form_destination_status: "destination_unavailable" });
    expect(() => directlyEvidencedResult(resolved)).toThrow(/could not be verified/);
  });
  it.each([{ ...breakdown, spend: "45" }, { ...breakdown, adset_id: "99" }])("rejects different snapshots and identities", async response => {
    vi.mocked(fetchMetaAdAccountInsights).mockResolvedValue([response]);
    const [resolved] = await resolveFormDestinations([row], input);
    expect(resolved.form_destination_status).toBe("coverage_mismatch");
    expect(() => directlyEvidencedResult(resolved)).toThrow(/could not be verified/);
  });
  it("does not manufacture zero form Results from unmatched positive destinations", async () => {
    const nonFormOnly = { ...row, actions: [{ action_type: type, value: "1" }] };
    vi.mocked(fetchMetaAdAccountInsights).mockResolvedValue([{ ...breakdown, actions: [{ action_type: type, value: "1", action_destination: "Example Page" }] }]);
    const [resolved] = await resolveFormDestinations([nonFormOnly], input);
    expect(() => directlyEvidencedResult(resolved)).toThrow(/could not be verified/);
  });
  it("retains a directly reported zero for a verified destination", async () => {
    const zero = { ...row, actions: [{ action_type: type, value: "1" }] };
    vi.mocked(fetchMetaAdAccountInsights).mockResolvedValue([{ ...breakdown, actions: [{ action_type: type, value: "0", action_destination: "200" }, { action_type: type, value: "1", action_destination: "Example Profile" }] }]);
    expect(directlyEvidencedResult((await resolveFormDestinations([zero], input))[0])).toMatchObject({ value: "0", cpr: "" });
  });
  it("keeps explicit primary Results, including zero, without requesting a breakdown", async () => {
    const explicit = { ...row, results: [{ indicator: `actions:${type}`, values: [{ value: "0" }] }] };
    expect(await resolveFormDestinations([explicit], input)).toEqual([explicit]);
    expect(fetchMetaAdSetInstantFormDestinations).not.toHaveBeenCalled();
    expect(directlyEvidencedResult(explicit)?.value).toBe("0");
  });
});
