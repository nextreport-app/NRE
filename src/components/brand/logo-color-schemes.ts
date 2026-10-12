import { CURSOR_CREAM, NEXTREPORT_NAVY } from "@/components/brand/cursor-brand-colors";

/** Final N-in-hex mark palettes for light vs dark surfaces. */

export type NextReportLogoColorScheme =
  /** Shipped final: navy hex, Cursor cream N (light canvas / header). */
  | "final-light"
  /** Shipped final: cream hex, navy N (dark canvas / header). */
  | "final-dark"
  | "on-light"
  | "on-light-soft"
  | "on-light-amber-ring"
  | "on-dark-outline"
  | "on-dark-elevated"
  | "on-dark-panel"
  | "on-dark-amber-ring"
  | "on-dark-amber-n";

export type LogoPalette = {
  hexFill: string;
  hexStroke: string;
  hexStrokeWidth: number;
  glyphFill: string;
  accent?: string;
};

const NAVY = NEXTREPORT_NAVY;
const CREAM = CURSOR_CREAM;
const PANEL = "#111f35";
const ELEVATED = "#1e3a5f";
const BORDER = "#3d5a80";
const AMBER = "#f5b45a";

export const LOGO_PALETTES: Record<NextReportLogoColorScheme, LogoPalette> = {
  "final-light": {
    hexFill: NAVY,
    hexStroke: "none",
    hexStrokeWidth: 0,
    glyphFill: CREAM,
  },
  "final-dark": {
    hexFill: CREAM,
    hexStroke: "none",
    hexStrokeWidth: 0,
    glyphFill: NAVY,
  },
  "on-light": {
    hexFill: NAVY,
    hexStroke: "none",
    hexStrokeWidth: 0,
    glyphFill: CREAM,
  },
  "on-light-soft": {
    hexFill: "#152a45",
    hexStroke: "none",
    hexStrokeWidth: 0,
    glyphFill: "#ffffff",
  },
  "on-light-amber-ring": {
    hexFill: NAVY,
    hexStroke: AMBER,
    hexStrokeWidth: 2,
    glyphFill: CREAM,
    accent: AMBER,
  },
  "on-dark-outline": {
    hexFill: "transparent",
    hexStroke: CREAM,
    hexStrokeWidth: 2.5,
    glyphFill: CREAM,
  },
  "on-dark-elevated": {
    hexFill: ELEVATED,
    hexStroke: BORDER,
    hexStrokeWidth: 1.75,
    glyphFill: CREAM,
  },
  "on-dark-panel": {
    hexFill: PANEL,
    hexStroke: CREAM,
    hexStrokeWidth: 2,
    glyphFill: CREAM,
  },
  "on-dark-amber-ring": {
    hexFill: PANEL,
    hexStroke: AMBER,
    hexStrokeWidth: 2.25,
    glyphFill: CREAM,
    accent: AMBER,
  },
  "on-dark-amber-n": {
    hexFill: ELEVATED,
    hexStroke: BORDER,
    hexStrokeWidth: 1.5,
    glyphFill: AMBER,
    accent: AMBER,
  },
};

export function colorSchemeForSurface(surface: "light" | "dark"): NextReportLogoColorScheme {
  return surface === "light" ? "final-light" : "final-dark";
}
