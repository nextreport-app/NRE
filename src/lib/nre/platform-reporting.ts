/**
 * Central platform dispatch for the unified ad reporting pipeline (Meta, Google
 * Ads, TikTok). One place for dictionary/slot/label decisions so routes,
 * buildReportData, metrics, share, and validate stay consistent.
 */

import type { Platform } from "./google-columns";
import type { MetricPlatform } from "./available-metrics";
import { detectGoogleObjectiveKey, type GoogleObjectiveKey } from "./detect-objective";
import {
  defaultGoogleSelection,
  defaultMetaSelection,
  type SelectedMetric,
} from "./available-metrics";

export type SlotAssignmentPlatform = "meta" | "google";

/** Which metric dictionary listAvailableMetrics / byKey should use. TikTok uses Meta-shaped CSV columns. */
export function metricsDictionaryPlatform(platform: Platform): MetricPlatform {
  return platform === "GOOGLE" ? "GOOGLE" : "META";
}

/** Which slot-assignment engine buildSlotsFromSelection / auto-slots should use. */
export function slotAssignmentPlatform(platform: Platform): SlotAssignmentPlatform {
  return platform === "GOOGLE" ? "google" : "meta";
}

/** Google uses account-wide campaign-type slots; Meta/TikTok use per-campaign objectives. */
export function usesGoogleSlotEngine(platform: Platform): boolean {
  return platform === "GOOGLE";
}

/** Meta/TikTok objective confirmation + fuzzy detection; Google uses fixed CONVERSIONS labels. */
export function usesMetaObjectiveEngine(platform: Platform): boolean {
  return platform !== "GOOGLE";
}

export function googleObjectiveKeyFromHeaders(headers: string[]): GoogleObjectiveKey {
  return detectGoogleObjectiveKey(headers);
}

export function defaultMetricSelectionForCampaign(
  platform: Platform,
  input: { resultLabel: string; costLabel: string; headers: string[]; googleObjectiveKey?: GoogleObjectiveKey },
): SelectedMetric[] {
  if (platform === "GOOGLE") {
    const key = input.googleObjectiveKey ?? detectGoogleObjectiveKey(input.headers);
    return defaultGoogleSelection(key);
  }
  return defaultMetaSelection(input.resultLabel, input.costLabel, input.headers);
}

export function googleCampaignObjectiveLabels(): { resultLabel: string; costLabel: string } {
  return { resultLabel: "CONVERSIONS", costLabel: "COST PER CONVERSION" };
}

export function sharePlatformBadge(platform: Platform): { label: string; color: string } {
  switch (platform) {
    case "GOOGLE":
      return { label: "GOOGLE ADS", color: "#4285F4" };
    case "TIKTOK":
      return { label: "TIKTOK ADS", color: "#FE2C55" };
    default:
      return { label: "META ADS", color: "#1877F2" };
  }
}

/** Human name for validation error copy. */
export function adsManagerName(platform: Platform): string {
  switch (platform) {
    case "GOOGLE":
      return "Google Ads";
    case "TIKTOK":
      return "TikTok Ads Manager";
    default:
      return "Meta Ads Manager";
  }
}
