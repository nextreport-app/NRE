import { describe, expect, it } from "vitest";
import { resolveObjectiveFromResultType } from "../result-type-map";
import {
  TIKTOK_API_REGRESSION_CASES,
  TIKTOK_CSV_REGRESSION_CASES,
} from "../tiktok-objective-regression";
import { normalizeTikTokResultTypeCell, resolveTikTokApiResultFields } from "../tiktok-objective-dictionary";

describe("TikTok objective regression manifest", () => {
  it.each(TIKTOK_API_REGRESSION_CASES.map((c) => [c.id, c] as const))(
    "%s — API metrics resolve to expected result type",
    (_id, testCase) => {
      const fields = resolveTikTokApiResultFields(testCase.metrics);
      expect(fields.resultType).toBe(testCase.expectedResultType);
      expect(resolveObjectiveFromResultType(fields.resultType)?.resultLabel).toBe(testCase.expectedResultLabel);
    },
  );

  it.each(TIKTOK_CSV_REGRESSION_CASES.map((c) => [c.id, c] as const))(
    "%s — CSV Result type cell normalizes and resolves",
    (_id, testCase) => {
      const normalized = normalizeTikTokResultTypeCell(testCase.resultTypeCell);
      expect(normalized).toBe(testCase.expectedResultType);
      expect(resolveObjectiveFromResultType(normalized)?.resultLabel).toBe(testCase.expectedResultLabel);
    },
  );
});
