import { describe, expect, it } from "vitest";
import metricsSheet from "../reference/meta-google-metrics-sheet.json";
import {
  allMetaCampaignObjectiveMatrixRows,
  objectiveKeyFromMatrixRow,
} from "../meta-campaign-objective-matrix";
import { META_OBJECTIVE_SPECS } from "../meta-objective-dictionary";
import { findMetaMetric } from "../meta-dictionary";
import { findGoogleMetric } from "../google-dictionary";
import { resolveObjectiveFromResultType } from "../result-type-map";

const SPEC_KEYS = new Set(META_OBJECTIVE_SPECS.map((s) => s.key));

describe("Owner reference sheets — Meta campaign objective matrix", () => {
  it("every performance goal and conversion event row resolves to a known objective key", () => {
    const unresolved: string[] = [];
    for (const row of allMetaCampaignObjectiveMatrixRows()) {
      const key = objectiveKeyFromMatrixRow(row);
      if (!key || !SPEC_KEYS.has(key)) {
        unresolved.push(
          `${row.campaignObjective} | ${row.conversionLocation ?? "-"} | ${row.performanceGoal} | ${row.conversionEvent ?? "-"}`,
        );
      }
    }
    expect(unresolved, unresolved.slice(0, 8).join("\n")).toEqual([]);
  });

  it("covers all seven campaign objective families from the sheet", () => {
    const objectives = new Set(allMetaCampaignObjectiveMatrixRows().map((r) => r.campaignObjective));
    expect(objectives).toEqual(
      new Set(["Awareness", "Traffic", "Engagement", "Leads", "App promotion", "Sales", "Catalogue sales"]),
    );
  });
});

describe("Owner reference sheets — conversion event labels", () => {
  it.each([
    ["Purchase", "purchases"],
    ["Add to cart", "add_to_cart"],
    ["Submit application", "applications"],
    ["Schedule", "appointment_leads"],
    ["Quote Request Submitted", "quote_requests"],
    ["Complete registration", "registrations"],
    ["Contact", "website_leads"],
  ] as const)("result_type %s → %s", (resultType, expectedKey) => {
    expect(resolveObjectiveFromResultType(resultType)?.key).toBe(expectedKey);
  });
});

describe("Owner reference sheets — popular metrics", () => {
  it("every popular Meta metric from the sheet is recognized by meta-dictionary", () => {
    const missing: string[] = [];
    for (const name of metricsSheet.popularMetaMetrics) {
      if (!findMetaMetric(name)) missing.push(name);
    }
    expect(missing).toEqual([]);
  });

  it("every popular Google metric from the sheet is recognized by google-dictionary", () => {
    const missing: string[] = [];
    for (const name of metricsSheet.popularGoogleMetrics) {
      if (!findGoogleMetric(name)) missing.push(name);
    }
    expect(missing).toEqual([]);
  });
});
