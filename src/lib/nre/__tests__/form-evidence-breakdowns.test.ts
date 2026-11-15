import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/meta-api", async original => ({ ...await original<typeof import("@/lib/meta-api")>(), fetchMetaAdAccountInsights: vi.fn() }));
import { fetchMetaAdAccountInsights, MetaInsightsFetchError } from "@/lib/meta-api";
import { collectFormResultEvidence } from "../meta-api-sync/collect-form-result-evidence";
import { FormResultEvidenceError } from "../meta-api-sync/form-result-evidence-error";
const day = "2026-10-24";
const input = { accessToken: "fixture-secret", adAccountId: "123", sinceIso: "2026-10-01", untilIso: "2026-10-31" };
const failure = () => new FormResultEvidenceError({ date_start: day, date_stop: day, campaign_id: "10", adset_id: "20", actions: [{ action_type: "onsite_conversion.lead_grouped", value: "6" }, { action_type: "onsite_conversion.lead", value: "1" }] }, "missing_results");
beforeEach(() => vi.clearAllMocks());
describe("diagnostic-only form breakdown queries", () => {
  it("queries only the failed day/ad set, retains destination/windows, and never invents primary Results", async () => {
    // Synthetic breakdown responses test capture mechanics; they are not live provider evidence.
    vi.mocked(fetchMetaAdAccountInsights).mockImplementation(async request => [{ campaign_id: "10", adset_id: "20", date_start: day, actions: [{ action_type: "onsite_conversion.lead_grouped", value: "6", ...(request.formEvidence?.kind === "destination" ? { action_destination: "on_ad" } : { "7d_click_first_conversion": "5", "7d_click_all_conversions": "6" }) }] }, { campaign_id: "other", adset_id: "99", date_start: day, actions: [{ action_type: "lead", value: "999" }] }]);
    const error = failure(); await collectFormResultEvidence(error, input);
    expect(fetchMetaAdAccountInsights).toHaveBeenCalledTimes(3);
    for (const kind of ["destination", "conversion_destination", "attribution"]) expect(fetchMetaAdAccountInsights).toHaveBeenCalledWith(expect.objectContaining({ sinceIso: day, untilIso: day, formEvidence: { kind, adSetId: "20" } }));
    expect(error.diagnostic.probes[0]).toMatchObject({ kind: "destination", status: "returned", rows: [{ actions: [{ action_destination: "on_ad" }] }] });
    expect(error.diagnostic.probes[2]).toMatchObject({ kind: "attribution", rows: [{ actions: [{ "7d_click_first_conversion": "5", "7d_click_all_conversions": "6" }] }] });
    expect(error.diagnostic.results).toBeNull(); expect(error.status).toBe(422);
    expect(JSON.stringify(error.diagnostic)).not.toMatch(/fixture-secret|999/);
  });
  it("preserves the original stop when a provider does not support a breakdown; never exposes its error text", async () => {
    vi.mocked(fetchMetaAdAccountInsights).mockRejectedValueOnce(new MetaInsightsFetchError({ code: 100, message: "access_token=secret" })).mockRejectedValue(new Error("secret URL"));
    const error = failure(); await collectFormResultEvidence(error, input);
    expect(error.diagnostic.probes).toEqual([{ kind: "destination", status: "unavailable", metaCode: 100 }, { kind: "conversion_destination", status: "unavailable" }, { kind: "attribution", status: "unavailable" }]);
    expect(JSON.stringify(error.diagnostic)).not.toContain("secret"); expect(error.status).toBe(422);
  });
  it("does not query an invalid identity or date outside the selected reporting range", async () => {
    const error = failure(); await collectFormResultEvidence(error, { ...input, sinceIso: "2026-10-25" });
    expect(fetchMetaAdAccountInsights).not.toHaveBeenCalled();
  });
});
