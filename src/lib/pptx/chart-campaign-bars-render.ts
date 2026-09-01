/**
 * Shared campaign spend-bar rendering for MTD overview SVG + OOXML.
 */

import type { ChartCampaignBarRow } from "../nre/chart-visual-layout";
import { MTD_CAMPAIGN_BARS } from "./chart-slide-layout";

export interface CampaignBarColors {
  ink: string;
  inkMuted: string;
  accent: string;
  track: string;
}

export const CAMPAIGN_BAR_COLORS_DARK: CampaignBarColors = {
  ink: "ffffff",
  inkMuted: "94a3b8",
  accent: "f6ad55",
  track: "1e293b",
};

export const CAMPAIGN_BAR_COLORS_LIGHT: CampaignBarColors = {
  ink: "0d1b2e",
  inkMuted: "64748b",
  accent: "d97706",
  track: "cbd5e1",
};

export function campaignBarFillWidth(percentage: number, trackW: number): number {
  const pct = Math.max(0, Math.min(100, percentage));
  return Math.max(pct > 0 ? 8 : 0, Math.round((pct / 100) * trackW));
}

export function campaignBarColumns() {
  const { x, labelColW, barColW, valueColW, gap } = MTD_CAMPAIGN_BARS;
  const labelX = x;
  const barX = x + labelColW + gap;
  const valueX = barX + barColW + gap;
  return { labelX, barX, valueX, labelColW, barColW, valueColW, trackW: barColW };
}

export function truncateCampaignBarName(name: string, max = 28): string {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

export type ChartCampaignBarRowList = ChartCampaignBarRow[];
