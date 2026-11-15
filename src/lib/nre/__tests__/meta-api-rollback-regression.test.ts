import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/meta-api", async original => ({ ...await original<typeof import("@/lib/meta-api")>(), fetchMetaAdAccountInsights: vi.fn(), fetchMetaAdSetReportingConfigs: vi.fn().mockResolvedValue([{ id: "20", optimization_goal: "LEAD_GENERATION" }]), fetchMetaAdAccountCampaignPeriodInsights: vi.fn().mockResolvedValue([]) }));
import { fetchMetaAdAccountInsights, type MetaInsightRow } from "@/lib/meta-api";
import { fetchMetaReportCsv } from "../meta-api-sync/fetch-meta-report-csv";
import { parseCsvText } from "../parse-csv";
import { directlyEvidencedResult } from "../meta-api-sync/direct-result-evidence";
import { aggregateRows } from "../aggregate";
import { dedupeInsightsByAdSetDay } from "../meta-api-sync/insight-engine";
const action = "onsite_conversion.lead_grouped";
beforeEach(() => vi.clearAllMocks());
describe("restore pre-719 API lead-action behavior", () => {
  it.each([4, 6])("imports %i reported grouped leads with no Results or creative identity projections", async count => {
    const row: MetaInsightRow = { campaign_id: "10", campaign_name: "Example", adset_id: "20", adset_name: "Main", date_start: "2026-10-24", date_stop: "2026-10-24", spend: "44.50", reach: "1001", impressions: "1169", actions: [{ action_type: action, value: String(count) }] };
    // Reproduces the production absence of Results, Objective Results and CPR.
    vi.mocked(fetchMetaAdAccountInsights).mockResolvedValue([row]);
    const result = await fetchMetaReportCsv({ accessToken: "fixture-only", adAccountId: "123", timezone: "UTC", currency: "USD", sinceIso: "2026-10-01", untilIso: "2026-10-31", requireDirectResultEvidence: true });
    const parsed = parseCsvText(result.csvText);
    expect(parsed.rows[0].results).toBe(String(count));
    expect(Number(parsed.rows[0].spend)).toBe(44.5);
    expect(Number(parsed.rows[0].cpr)).toBeCloseTo(44.5 / count);
    expect(fetchMetaAdAccountInsights).toHaveBeenCalledTimes(1);
    expect(fetchMetaAdAccountInsights).toHaveBeenCalledWith(expect.objectContaining({ level: "adset", includeResultChannels: false }));
    // Restoring availability is NOT an assertion that six grouped leads
    // equal the Ads Manager primary-form quantity of five.
    if (count === 6) expect(Number(parsed.rows[0].results)).not.toBe(5);
  });
  it("keeps configured website event counts separate from broad leads", () => {
    expect(directlyEvidencedResult({ spend: "100", configured_result_action: "offsite_conversion.fb_pixel_lead", actions: [{ action_type: "lead", value: "23" }, { action_type: "offsite_conversion.fb_pixel_lead", value: "21" }] })).toMatchObject({ value: "21", cpr: String(100 / 21) });
  });
  it("retains explicit-zero arithmetic and conflicting-duplicate guards", () => {
    const rows = parseCsvText("Campaign name,Ad set name,Day,Result type,Results,Amount spent,Meta leads\nForms,Main,2026-10-24,Leads (form),0,44.5,6").rows;
    expect(aggregateRows(rows)[0]).toMatchObject({ spend: 44.5, results: 0 });
    const row: MetaInsightRow = { campaign_name: "Example", campaign_id: "10", adset_id: "20", date_start: "2026-10-24", spend: "44.5" };
    expect(() => dedupeInsightsByAdSetDay([row, { ...row, spend: "45" }])).toThrow(/conflicting duplicate/);
  });
});
