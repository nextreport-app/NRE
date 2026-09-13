import { describe, expect, it } from "vitest";
import { SLIDE_SURFACE_DARK, SLIDE_SURFACE_LIGHT, slideSurfacePalette } from "../slide-surface-palette";

describe("slideSurfacePalette", () => {
  it("returns dark palette by default", () => {
    expect(slideSurfacePalette(false)).toEqual(SLIDE_SURFACE_DARK);
  });

  it("returns light palette for light template", () => {
    expect(slideSurfacePalette(true)).toEqual(SLIDE_SURFACE_LIGHT);
    expect(slideSurfacePalette(true).text).toBe("0d1b2e");
    expect(slideSurfacePalette(true).cardFill).toBe("f0ede8");
  });
});
