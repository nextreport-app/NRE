/**
 * Colors for from-scratch OOXML slides (comparison, creative) that draw their
 * own cards/text rather than inheriting from a template shape. Mirrors the
 * dark/light split already used by chart-slide-ooxml.ts and table-slide.ts.
 */

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
  changeFlatText: "FFFFFF",
  changeDarkText: "0d1b2e",
};

export const SLIDE_SURFACE_LIGHT: SlideSurfacePalette = {
  text: "0d1b2e",
  label: "64748b",
  heading: "c17d0a",
  cardFill: "f0ede8",
  cardStroke: "cbd5e1",
  tableHeaderFill: "0d1b2e",
  tablePeriodAFill: "f0d9b5",
  tablePeriodBFill: "f0ede8",
  tableNameFill: "f0ede8",
  tableTotalFill: "e5e0d8",
  changeFlatText: "64748b",
  changeDarkText: "0d1b2e",
};

export function slideSurfacePalette(isLightTemplate: boolean): SlideSurfacePalette {
  return isLightTemplate ? SLIDE_SURFACE_LIGHT : SLIDE_SURFACE_DARK;
}
