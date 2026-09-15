import { describe, expect, it } from "vitest";
import { detectGoogleObjectiveFromHeaders } from "../google-objective-dictionary";
import { GOOGLE_OBJECTIVE_REGRESSION_CASES } from "../google-objective-regression";

describe("Google objective regression manifest", () => {
  it.each(GOOGLE_OBJECTIVE_REGRESSION_CASES.map((c) => [c.id, c] as const))(
    "%s — headers classify to expected campaign type",
    (_id, testCase) => {
      const spec = detectGoogleObjectiveFromHeaders([...testCase.headers]);
      expect(spec.key).toBe(testCase.expectedKey);
      expect(spec.resultLabel).toBe(testCase.expectedResultLabel);
    },
  );
});
