/**
 * Shared palette + bar helpers for the MTD Visual Chart slide.
 */

import { MTD_VISUAL } from "./chart-slide-layout";

export interface CampaignBarColors {
  ink: string;
  inkMuted: string;
  accent: string;
  track: string;
  panelFill: string;
  separator: string;
  heading: string;
}

export const VISUAL_CHART_COLORS_DARK: CampaignBarColors = {
  ink: "ffffff",
  inkMuted: "94a3b8",
  accent: "f6ad55",
  track: "1e293b",
  panelFill: "111f35",
  separator: "1e3a5f",
  heading: "94a3b8",
};

export const VISUAL_CHART_COLORS_LIGHT: CampaignBarColors = {
  ink: "0d1b2e",
  inkMuted: "64748b",
  accent: "d97706",
  track: "e5e0d8",
  panelFill: "f0ede8",
  separator: "cbd5e1",
  heading: "64748b",
};

/** @deprecated Use VISUAL_CHART_COLORS_DARK */
export const CAMPAIGN_BAR_COLORS_DARK = {
  ink: VISUAL_CHART_COLORS_DARK.ink,
  inkMuted: VISUAL_CHART_COLORS_DARK.inkMuted,
  accent: VISUAL_CHART_COLORS_DARK.accent,
  track: VISUAL_CHART_COLORS_DARK.track,
};

/** @deprecated Use VISUAL_CHART_COLORS_LIGHT */
export const CAMPAIGN_BAR_COLORS_LIGHT = {
  ink: VISUAL_CHART_COLORS_LIGHT.ink,
  inkMuted: VISUAL_CHART_COLORS_LIGHT.inkMuted,
  accent: VISUAL_CHART_COLORS_LIGHT.accent,
  track: VISUAL_CHART_COLORS_LIGHT.track,
};

export function resultBarFillWidth(barPct: number, trackW: number): number {
  const pct = Math.max(0, Math.min(100, barPct));
  return Math.max(pct > 0 ? 6 : 0, Math.round((pct / 100) * trackW));
}

export function resultBarColumns() {
  const { rightX, labelColW, barTrackMaxW, rightW } = MTD_VISUAL;
  const labelX = rightX;
  const barX = rightX + labelColW + 8;
  const trackW = Math.min(barTrackMaxW, rightW - labelColW - 12);
  return { labelX, barX, labelColW, trackW };
}

export function truncateCampaignBarName(name: string, max = 22): string {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

export type ChartCampaignBarRowList = import("../nre/chart-visual-layout").ChartCampaignBarRow[];
