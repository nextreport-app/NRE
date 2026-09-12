import { describe, expect, it } from "vitest";
import { mergePreviousMonthSelection } from "../merge-previous-month-selection";

describe("mergePreviousMonthSelection", () => {
  it("selects all campaigns when there is no prior selection", () => {
    expect(mergePreviousMonthSelection(["A", "B"], null, null)).toEqual(["A", "B"]);
    expect(mergePreviousMonthSelection(["A", "B"], [], null)).toEqual(["A", "B"]);
  });

  it("preserves exclusions from the prior file", () => {
    expect(
      mergePreviousMonthSelection(
        ["A", "B", "C"],
        ["A", "C"],
        ["A", "B", "C"],
      ),
    ).toEqual(["A", "C"]);
  });

  it("includes newly appearing campaigns by default", () => {
    expect(
      mergePreviousMonthSelection(
        ["A", "B", "D"],
        ["A"],
        ["A", "B"],
      ),
    ).toEqual(["A", "D"]);
  });

  it("returns empty when the new file has no campaigns", () => {
    expect(mergePreviousMonthSelection([], ["A"], ["A", "B"])).toEqual([]);
  });
});
