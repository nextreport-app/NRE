import { describe, expect, it } from "vitest";
import {
  SLIDE_SURFACE_DARK,
  SLIDE_SURFACE_LIGHT_CREAM,
  SLIDE_SURFACE_LIGHT_PEARL,
  SLIDE_SURFACE_LIGHT_SAND,
  slideSurfacePalette,
} from "../slide-surface-palette";

describe("slideSurfacePalette", () => {
  it("returns dark palette for DARK", () => {
    expect(slideSurfacePalette("DARK")).toEqual(SLIDE_SURFACE_DARK);
    expect(slideSurfacePalette(false)).toEqual(SLIDE_SURFACE_DARK);
  });

  it("returns variant palettes for each light template", () => {
    expect(slideSurfacePalette("LIGHT_CREAM")).toEqual(SLIDE_SURFACE_LIGHT_CREAM);
    expect(slideSurfacePalette("LIGHT_PEARL")).toEqual(SLIDE_SURFACE_LIGHT_PEARL);
    expect(slideSurfacePalette("LIGHT_SAND")).toEqual(SLIDE_SURFACE_LIGHT_SAND);
    expect(slideSurfacePalette(true)).toEqual(SLIDE_SURFACE_LIGHT_CREAM);
  });

  it("uses distinct card fills per light variant", () => {
    expect(slideSurfacePalette("LIGHT_CREAM").cardFill).toBe("f0ede8");
    expect(slideSurfacePalette("LIGHT_PEARL").cardFill).toBe("f1f5f9");
    expect(slideSurfacePalette("LIGHT_SAND").cardFill).toBe("ebe6de");
  });
});
