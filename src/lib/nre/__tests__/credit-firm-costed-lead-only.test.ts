import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsvText } from "../parse-csv";
import { manualExportPrimaryResult } from "../meta-api-sync/manual-export-mapper";
import { manualRowToMetaInsight } from "./golden-parity-helpers";

const MANUAL = resolve(
  process.cwd(),
  "src/lib/nre/__tests__/fixtures/dc-credit-firm-weekly-sep29-2026-upload.csv",
);

const LEAD_ACTION_TYPES = [
  "offsite_conversion.fb_pixel_lead",
  "lead",
  "onsite_conversion.lead_grouped",
] as const;

/** Strip conversion signals — only delivery actions remain (matches all-blank API CSV). */
function deliveryActionsOnly(row: ReturnType<typeof parseCsvText>["rows"][number]) {
  const insight = manualRowToMetaInsight(row);
  insight.results = [];
  insight.cost_per_result = [];
  insight.objective_results = [];
  insight.cost_per_objective_result = [];
  insight.cost_per_action_type = [];
  insight.actions = (insight.actions ?? []).filter(
    (a) => !LEAD_ACTION_TYPES.includes(a.action_type as (typeof LEAD_ACTION_TYPES)[number]),
  );
  return insight;
}

/** Meta sends costed generic lead in results[] only — no pixel fields anywhere. */
function costedGenericLeadInResultsOnly(row: ReturnType<typeof parseCsvText>["rows"][number]) {
  const insight = deliveryActionsOnly(row);
  const manualResults = Number(row.results) || 0;
  const spend = Number(row.spend) || 0;
  if (manualResults > 0) {
    insight.results = [{ indicator: "actions:lead", values: [{ value: String(manualResults) }] }];
    insight.cost_per_result = [
      { indicator: "actions:lead", values: [{ value: String(spend / manualResults) }] },
    ];
  } else {
    insight.results = [{ indicator: "actions:lead", values: [{ value: "1" }] }];
  }
  return insight;
}

/** Costed lead on lead days; blank days have uncosted lead=1 only (no CPR). */
function costedLeadOnLeadDaysOnly(row: ReturnType<typeof parseCsvText>["rows"][number]) {
  const insight = deliveryActionsOnly(row);
  const manualResults = Number(row.results) || 0;
  const spend = Number(row.spend) || 0;
  if (manualResults > 0) {
    insight.results = [{ indicator: "actions:lead", values: [{ value: String(manualResults) }] }];
    insight.cost_per_result = [
      { indicator: "actions:lead", values: [{ value: String(spend / manualResults) }] },
    ];
  } else {
    insight.results = [{ indicator: "actions:lead", values: [{ value: "1" }] }];
    insight.cost_per_result = [];
  }
  return insight;
}

describe("hypothesized live payloads for all-blank API CSV", () => {
  it("delivery-only actions reproduces zero mapped Results", () => {
    const { rows } = parseCsvText(readFileSync(MANUAL, "utf8"));
    let sum = 0;
    for (const row of rows) {
      sum += manualExportPrimaryResult(deliveryActionsOnly(row)) ? 1 : 0;
    }
    expect(sum).toBe(0);
  });

  it("costed generic lead in results on lead days only matches manual 12", () => {
    const { rows } = parseCsvText(readFileSync(MANUAL, "utf8"));
    let manualSum = 0;
    let apiSum = 0;
    for (const row of rows) {
      manualSum += Number(row.results) || 0;
      const primary = manualExportPrimaryResult(costedGenericLeadInResultsOnly(row));
      apiSum += primary ? parseFloat(primary.value) : 0;
    }
    expect(manualSum).toBe(12);
    expect(apiSum).toBe(12);
  });

  it("costed lead on lead days only shape", () => {
    const { rows } = parseCsvText(readFileSync(MANUAL, "utf8"));
    let manualSum = 0;
    let apiSum = 0;
    for (const row of rows) {
      const expected = Number(row.results) || 0;
      manualSum += expected;
      const primary = manualExportPrimaryResult(costedLeadOnLeadDaysOnly(row));
      apiSum += primary ? parseFloat(primary.value) : 0;
      expect(primary ? parseFloat(primary.value) : 0, String(row._raw?.Day)).toBe(expected);
    }
    expect(manualSum).toBe(12);
    expect(apiSum).toBe(12);
  });
});
