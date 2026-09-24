import { describe, expect, it } from "vitest";
import { normalizeSavedDateSelection } from "../normalize-date-selection";

const weeklyOptions = {
  last7: { startIso: "2026-09-17", endIso: "2026-09-23" },
  prev7: { startIso: "2026-09-10", endIso: "2026-09-16" },
  last14: { startIso: "2026-09-10", endIso: "2026-09-23" },
};

describe("normalizeSavedDateSelection", () => {
  it("keeps last7 and custom modes", () => {
    expect(normalizeSavedDateSelection({ mode: "last7" }, weeklyOptions)).toEqual({ mode: "last7" });
    expect(
      normalizeSavedDateSelection({ mode: "custom", customStart: "2026-09-01", customEnd: "2026-09-05" }, weeklyOptions),
    ).toEqual({ mode: "custom", customStart: "2026-09-01", customEnd: "2026-09-05" });
  });

  it("maps legacy prev7 and last14 quick picks to custom ranges", () => {
    expect(normalizeSavedDateSelection({ mode: "prev7" }, weeklyOptions)).toEqual({
      mode: "custom",
      customStart: "2026-09-10",
      customEnd: "2026-09-16",
    });
    expect(normalizeSavedDateSelection({ mode: "last14" }, weeklyOptions)).toEqual({
      mode: "custom",
      customStart: "2026-09-10",
      customEnd: "2026-09-23",
    });
  });
});
