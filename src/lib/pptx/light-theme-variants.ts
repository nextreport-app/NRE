/**
 * Light report-template background variants — three options for client comparison.
 * Text/ink colors are shared; card/table surface tints follow each background.
 */

import type { ReportTemplate } from "@/generated/prisma/enums";
import type { SlideSurfacePalette } from "./slide-surface-palette";
import { SLIDE_SURFACE_DARK } from "./slide-surface-palette";

const LIGHT_INK = "0d1b2e";
const LIGHT_LABEL = "475569";

function lightPalette(cardFill: string, periodA: string, totalFill: string): SlideSurfacePalette {
  return {
    text: LIGHT_INK,
    label: LIGHT_LABEL,
    heading: LIGHT_INK,
    cardFill,
    cardStroke: "cbd5e1",
    tableHeaderFill: LIGHT_INK,
    tablePeriodAFill: periodA,
    tablePeriodBFill: cardFill,
    tableNameFill: cardFill,
    tableTotalFill: totalFill,
    tableHeaderLabel: "FFFFFF",
    changeFlatText: "64748b",
    changeDarkText: LIGHT_INK,
  };
}

/** Warm cream — original light look (#FDF6EC). */
export const SLIDE_SURFACE_LIGHT_CREAM = lightPalette("f0ede8", "f0d9b5", "e5e0d8");

/** Cool pearl — neutral slate-white (#F8FAFC). */
export const SLIDE_SURFACE_LIGHT_PEARL = lightPalette("f1f5f9", "e2e8f0", "e2e8f0");

/** Soft sand — muted warm stone (#F5F0E8). */
export const SLIDE_SURFACE_LIGHT_SAND = lightPalette("ebe6de", "e8dfd0", "e0d9cf");

const LIGHT_PALETTES: Partial<Record<ReportTemplate, SlideSurfacePalette>> = {
  LIGHT_CREAM: SLIDE_SURFACE_LIGHT_CREAM,
  LIGHT_PEARL: SLIDE_SURFACE_LIGHT_PEARL,
  LIGHT_SAND: SLIDE_SURFACE_LIGHT_SAND,
};

export function slideSurfacePaletteForTemplate(template: ReportTemplate): SlideSurfacePalette {
  if (template === "DARK") return SLIDE_SURFACE_DARK;
  return LIGHT_PALETTES[template] ?? SLIDE_SURFACE_LIGHT_CREAM;
}

/** Period-row highlight on Combined Total table slides. */
export function periodRowFillHex(template: ReportTemplate): string {
  if (template === "LIGHT_PEARL") return "E2E8F0";
  if (template === "LIGHT_SAND") return "E8DFD0";
  if (template === "LIGHT_CREAM") return "F0D9B5";
  return "111F35";
}
