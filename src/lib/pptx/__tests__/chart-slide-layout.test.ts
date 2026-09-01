import { describe, expect, it } from "vitest";
import { MTD_VISUAL, MTD_SLIDE_H } from "../chart-slide-layout";

describe("MTD visual chart slide layout", () => {
  it("keeps summary strip inside the slide canvas", () => {
    expect(MTD_VISUAL.summaryY + MTD_VISUAL.summaryH).toBeLessThanOrEqual(MTD_SLIDE_H);
  });
});
