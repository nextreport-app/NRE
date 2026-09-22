import { describe, expect, it } from "vitest";
import {
  mergePreviousMonthSelection,
  mergePreviousMonthSelectionWithLowSpend,
  resolvePreviousMonthUiSelection,
} from "../merge-previous-month-selection";

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

describe("mergePreviousMonthSelectionWithLowSpend", () => {
  const spend = { "Big Co": 500, "Tiny Co": 2, "Medium Co": 45 };

  it("excludes sub-threshold campaigns on first upload", () => {
    const result = mergePreviousMonthSelectionWithLowSpend(["Big Co", "Tiny Co", "Medium Co"], spend, null, null);
    expect(result.selectedCampaigns).toEqual(["Big Co", "Medium Co"]);
    expect(result.lowSpendCampaigns).toEqual(["Tiny Co"]);
  });

  it("excludes low-spend campaigns when the saved selection lists every campaign (legacy all-checked upload)", () => {
    const result = mergePreviousMonthSelectionWithLowSpend(
      ["Big Co", "Tiny Co", "Medium Co"],
      spend,
      ["Big Co", "Tiny Co", "Medium Co"],
      ["Big Co", "Tiny Co", "Medium Co"],
    );
    expect(result.selectedCampaigns).toEqual(["Big Co", "Medium Co"]);
    expect(result.lowSpendCampaigns).toEqual(["Tiny Co"]);
  });

  it("keeps a low-spend campaign the user explicitly opted back in after excluding others", () => {
    const result = mergePreviousMonthSelectionWithLowSpend(
      ["Big Co", "Tiny Co", "Medium Co"],
      spend,
      ["Big Co", "Tiny Co"],
      ["Big Co", "Tiny Co", "Medium Co"],
    );
    expect(result.selectedCampaigns).toEqual(["Big Co", "Tiny Co"]);
  });

  it("resolvePreviousMonthUiSelection treats null saved selection as low-spend excluded", () => {
    const result = resolvePreviousMonthUiSelection(["Big Co", "Tiny Co"], spend, null);
    expect(result.selectedCampaigns).toEqual(["Big Co"]);
  });

  it("excludes newly appearing low-spend campaigns by default", () => {
    const result = mergePreviousMonthSelectionWithLowSpend(
      ["Big Co", "Tiny Co", "New Tiny"],
      { ...spend, "New Tiny": 1 },
      ["Big Co"],
      ["Big Co"],
    );
    expect(result.selectedCampaigns).toEqual(["Big Co"]);
  });
});
