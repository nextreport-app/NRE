import type { AbstractGlyphId } from "@/components/brand/nextreport-abstract-glyphs";
import type { HexGlyphId } from "@/components/brand/nextreport-logo-mark";

export function isAbstractGlyph(id: HexGlyphId): id is AbstractGlyphId {
  return id !== "n" && id !== "spark";
}

export function resolveHexMark(glyph: HexGlyphId): {
  variant: "filled-n" | "filled-spark" | "filled-abstract";
  abstractGlyph?: AbstractGlyphId;
} {
  if (glyph === "n") return { variant: "filled-n" };
  if (glyph === "spark") return { variant: "filled-spark" };
  return { variant: "filled-abstract", abstractGlyph: glyph };
}
