/**
 * Colors for from-scratch OOXML slides (comparison, creative) that draw their
 * own cards/text rather than inheriting from a template shape. Mirrors the
 * dark/light split already used by chart-slide-ooxml.ts and table-slide.ts.
 */

import type { ReportTemplate } from "@/generated/prisma/enums";
import {
  SLIDE_SURFACE_LIGHT_CREAM,
  SLIDE_SURFACE_LIGHT_PEARL,
  SLIDE_SURFACE_LIGHT_SAND,
  slideSurfacePaletteForTemplate,
} from "./light-theme-variants";

export interface SlideSurfacePalette {
  text: string;
  label: string;
  heading: string;
  cardFill: string;
  cardStroke: string;
  tableHeaderFill: string;
  tablePeriodAFill: string;
  tablePeriodBFill: string;
  tableNameFill: string;
  tableTotalFill: string;
  /** Header row label color — light templates keep a dark navy header bar with white text. */
  tableHeaderLabel: string;
  changeFlatText: string;
  changeDarkText: string;
}

export const SLIDE_SURFACE_DARK: SlideSurfacePalette = {
  text: "FFFFFF",
  label: "94a3b8",
  heading: "f6ad55",
  cardFill: "111f35",
  cardStroke: "1e3a5f",
  tableHeaderFill: "0d1b2e",
  tablePeriodAFill: "16233d",
  tablePeriodBFill: "111f35",
  tableNameFill: "111f35",
  tableTotalFill: "1e3a5f",
  tableHeaderLabel: "94a3b8",
  changeFlatText: "FFFFFF",
  changeDarkText: "0d1b2e",
};

/** @deprecated Use SLIDE_SURFACE_LIGHT_CREAM — kept for tests. */
export const SLIDE_SURFACE_LIGHT = SLIDE_SURFACE_LIGHT_CREAM;

export { SLIDE_SURFACE_LIGHT_CREAM, SLIDE_SURFACE_LIGHT_PEARL, SLIDE_SURFACE_LIGHT_SAND };

export function slideSurfacePalette(templateOrIsLight: ReportTemplate | boolean): SlideSurfacePalette {
  if (typeof templateOrIsLight === "boolean") {
    return templateOrIsLight ? SLIDE_SURFACE_LIGHT_CREAM : SLIDE_SURFACE_DARK;
  }
  return slideSurfacePaletteForTemplate(templateOrIsLight);
}
