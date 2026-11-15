import { describe, expect, it } from "vitest";
import { FormResultEvidenceError } from "../meta-api-sync/form-result-evidence-error";
import { directlyEvidencedResult } from "../meta-api-sync/direct-result-evidence";
import type { MetaInsightRow } from "@/lib/meta-api";
const row: MetaInsightRow = { date_start: "2026-10-24", optimization_goal: "LEAD_GENERATION", actions: [{ action_type: "onsite_conversion.lead_grouped", value: "6" }] };
describe("failed form sync evidence", () => {
  it.each([
    [undefined, "missing_results"],
    [[], "empty_results_with_form_actions"],
    [[{ indicator: "actions:unrecognized_metric", values: [{ value: "5" }] }], "unexpected_indicator"],
    [[{ indicator: "actions:onsite_conversion.lead_grouped", values: [] }], "invalid_value_shape"],
    [[{ indicator: "actions:onsite_conversion.lead_grouped", values: [{ value: "invalid" }] }], "invalid_count"],
  ] as const)("retains evidence and a specific reason without accepting a count: %j", (results, reason) => {
    try {
      directlyEvidencedResult({ ...row, results: results as MetaInsightRow["results"] });
      expect.fail("Import must stop");
    } catch (error) {
      expect(error).toBeInstanceOf(FormResultEvidenceError);
      expect((error as FormResultEvidenceError).diagnostic).toMatchObject({ reason, dateStart: "2026-10-24", leadActions: [{ value: "6" }] });
    }
  });
  it("whitelists fields, limits response size and omits arbitrary token properties", () => {
    const unsafe = { ...row, access_token: "secret", request: { token: "secret" }, results: Array.from({ length: 1000 }, () => ({ indicator: "x".repeat(1000), access_token: "secret", values: [{ value: "5", access_token: "secret" }] })) };
    const error = new FormResultEvidenceError(unsafe, "unexpected_indicator");
    const json = JSON.stringify(error.diagnostic);
    expect(error.diagnostic.results).toHaveLength(30);
    expect(error.diagnostic.results![0].indicator).toHaveLength(200);
    expect(json).not.toContain("secret"); expect(json).not.toContain("access_token");
  });
});
