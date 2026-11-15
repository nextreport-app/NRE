import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/meta-api", async original => ({
  ...await original<typeof import("@/lib/meta-api")>(),
  fetchMetaAdAccountInsights: vi.fn(),
  fetchMetaAdSetReportingConfigs: vi.fn().mockResolvedValue([{ id: "set", optimization_goal: "LEAD_GENERATION" }]),
  fetchMetaAdAccountCampaignPeriodInsights: vi.fn().mockResolvedValue([]),
}));
import { fetchMetaAdAccountInsights, type MetaInsightRow } from "@/lib/meta-api";
import { directlyEvidencedResult, configuredResultCountSource } from "../meta-api-sync/direct-result-evidence";
import { fetchMetaReportCsv } from "../meta-api-sync/fetch-meta-report-csv";
import { parseCsvText } from "../parse-csv";
import { metaCsvExportResultValue } from "../meta-csv-export-counting";
import { dedupeInsightsByAdSetDay } from "../meta-api-sync/insight-engine";
import { aggregateRows } from "../aggregate";
const type = "onsite_conversion.lead_grouped";
const primary = (value: string) => [{ indicator: `actions:${type}`, values: [{ value }] }];
const row: MetaInsightRow = {
  campaign_id: "campaign", adset_id: "set", campaign_name: "Instant forms", adset_name: "Main",
  date_start: "2026-10-24", date_stop: "2026-10-24", optimization_goal: "LEAD_GENERATION",
  spend: "44.50", impressions: "1169", reach: "1001",
  actions: [{ action_type: type, value: "6" }], results: primary("5"),
};
beforeEach(() => vi.clearAllMocks());
describe("primary form Results stay separate from secondary Meta leads", () => {
  it("uses explicit primary 5 instead of grouped 6 and computes $8.90", () => {
    expect(directlyEvidencedResult(row)).toMatchObject({ value: "5", cpr: "8.9" });
    expect(configuredResultCountSource(row)).toBe("results.values.value");
    expect(directlyEvidencedResult({ ...row, results: primary("0") })).toMatchObject({ value: "0", cpr: "" });
  });
  it.each([undefined, [], primary(""), primary("-1"), primary("NaN"), [...primary("5"), ...primary("6")]])("rejects missing, invalid or conflicting primary evidence: %j", results => {
    expect(() => directlyEvidencedResult({ ...row, results })).toThrow(/primary Results/);
  });
  it("allows an empty primary projection only with no form actions", () => {
    expect(directlyEvidencedResult({ ...row, results: [], actions: [] })).toMatchObject({ value: "0" });
  });
  it("refreshes form counts and delivery together; manual/API aggregate to the same result and cost", async () => {
    vi.mocked(fetchMetaAdAccountInsights).mockImplementation(async request => [{ ...row, spend: request.includeResultChannels ? "44.50" : "40", results: request.includeResultChannels ? primary("5") : undefined }]);
    const result = await fetchMetaReportCsv({ accessToken: "fixture", adAccountId: "123", timezone: "UTC", currency: "USD", sinceIso: "2026-10-01", untilIso: "2026-10-31", requireDirectResultEvidence: true });
    const api = parseCsvText(result.csvText);
    const manual = parseCsvText("Campaign name,Ad set name,Day,Result type,Results,Amount spent (USD),Impressions,Reach,Meta leads\nInstant forms,Main,2026-10-24,Leads (form),5,44.50,1169,1001,6");
    for (const source of [api, manual]) {
      expect(aggregateRows(source.rows)[0]).toMatchObject({ spend: 44.5, results: 5, cpr: 8.9 });
    }
    expect(api.rows[0]._raw["Meta leads"]).toBe("6");
    expect(Number(api.rows[0]._raw["Cost per lead"])).toBeCloseTo(44.5 / 6);
    expect(api.rows[0]._raw["NRE API result source"]).toBe("results.values.value");
    expect(JSON.parse(api.rows[0]._raw["NRE API result evidence"]).actions[0].value).toBe("6");
    expect(fetchMetaAdAccountInsights).toHaveBeenCalledTimes(2);
  });
  it("collapses identical pagination duplicates but rejects conflicting counts or spend", () => {
    expect(dedupeInsightsByAdSetDay([row, { ...row }])).toHaveLength(1);
    expect(() => dedupeInsightsByAdSetDay([row, { ...row, spend: "45" }])).toThrow(/conflicting duplicate/);
    expect(() => dedupeInsightsByAdSetDay([row, { ...row, results: primary("6") }])).toThrow(/conflicting duplicate/);
  });
  it("rejects mismatched or duplicate daily coverage", async () => {
    vi.mocked(fetchMetaAdAccountInsights).mockResolvedValueOnce([row]).mockResolvedValueOnce([]);
    await expect(fetchMetaReportCsv({ accessToken: "fixture", adAccountId: "123", timezone: "UTC", currency: "USD", requireDirectResultEvidence: true })).rejects.toThrow(/inconsistent daily coverage/);
  });
  it.each(["Leads (form)", "Website leads"])("manual explicit zero Results cannot be backfilled from secondary leads: %s", result_type => {
    expect(metaCsvExportResultValue({ campaign_name: "Example", ad_set_name: "Main", spend: 44.5, impressions: 100, result_type, results: "0", meta_leads: "6", website_leads: "6" }, result_type === "Leads (form)" ? "META FORM LEADS" : "WEBSITE LEADS")).toBe(0);
  });
});
