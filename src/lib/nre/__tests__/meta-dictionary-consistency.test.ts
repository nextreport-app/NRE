import { describe, expect, it } from "vitest";
import {
  DEFINITIVE_PROOF_PRIORITY,
  META_API_ACTION_TO_CSV,
  META_FUZZY_CATALOG,
  META_FUZZY_ONLY_LABELS,
  META_OBJECTIVE_SPECS,
  buildResultTypeMap,
  getMetaCanonicalResultTypeText,
  getMetaResultLabels,
  metaApiActionToCsvResultType,
} from "../meta-objective-dictionary";
import { resolveObjectiveFromResultType } from "../result-type-map";

describe("meta-objective-dictionary — internal consistency (CI guard)", () => {
  const exactMap = buildResultTypeMap();

  it("every fuzzy catalog canonicalText round-trips its pattern", () => {
    for (const entry of META_FUZZY_CATALOG) {
      expect(entry.pattern.test(entry.canonicalText.toLowerCase()), entry.resultLabel).toBe(true);
      expect(getMetaCanonicalResultTypeText(entry.resultLabel)).toBe(entry.canonicalText);
    }
  });

  it("every spec alias is lowercase-trimmed and maps to its own key", () => {
    for (const spec of META_OBJECTIVE_SPECS) {
      for (const alias of spec.aliases) {
        expect(alias).toBe(alias.toLowerCase().trim());
        expect(exactMap[alias]?.key, alias).toBe(spec.key);
      }
    }
  });

  it("every definitive-proof alias resolves via RESULT_TYPE_MAP", () => {
    for (const spec of META_OBJECTIVE_SPECS) {
      if (!spec.definitiveProof) continue;
      for (const alias of spec.aliases) {
        expect(resolveObjectiveFromResultType(alias)?.key, alias).toBe(spec.key);
      }
    }
  });

  it("API CSV labels resolve through exact map or fuzzy catalog", () => {
    for (const [actionType, csvLabel] of Object.entries(META_API_ACTION_TO_CSV)) {
      expect(metaApiActionToCsvResultType(actionType)).toBe(csvLabel);
      const fromExact = resolveObjectiveFromResultType(csvLabel);
      const fromFuzzy = getMetaResultLabels(csvLabel);
      expect(fromExact ?? fromFuzzy).toBeTruthy();
      expect(fromExact?.resultLabel ?? fromFuzzy.resultLabel).not.toBe("RESULTS");
    }
  });

  it("DEFINITIVE_PROOF_PRIORITY keys exist in META_OBJECTIVE_SPECS", () => {
    const specKeys = new Set(META_OBJECTIVE_SPECS.map((s) => s.key));
    for (const key of DEFINITIVE_PROOF_PRIORITY) {
      expect(specKeys.has(key), key).toBe(true);
    }
  });

  it("machine-only aliases fuzzy-match or exact-match to the same objective family", () => {
    const samples = [
      "onsite_conversion.lead_grouped",
      "website submission",
      "omni_purchase",
      "offsite_conversion.fb_pixel_complete_registration",
    ];
    for (const sample of samples) {
      const exact = resolveObjectiveFromResultType(sample);
      expect(exact, sample).not.toBeNull();
      const fuzzy = getMetaResultLabels(sample);
      if (!META_FUZZY_ONLY_LABELS.has(fuzzy.resultLabel)) {
        expect(fuzzy.resultLabel).toBe(exact!.resultLabel);
      }
    }
  });

  it("documents fuzzy-only labels that intentionally differ from exact spec labels", () => {
    expect(META_FUZZY_ONLY_LABELS.has("CONVERSIONS")).toBe(true);
    expect(resolveObjectiveFromResultType("phone call")?.resultLabel).toBe("PHONE CALLS");
    expect(getMetaResultLabels("Phone call").resultLabel).toBe("PHONE CALLS");
  });
});
