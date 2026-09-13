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
import { lookupMetricValue, type RawMetricRow } from "./dynamic-metrics";
import { findGoogleMetricByKey } from "./google-dictionary";
import { fmtCurrency2dp, fmtNumber } from "./format";

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

/** Meta/TikTok objective confirmation + fuzzy detection; Google uses campaign-type slot labels. */
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

/** Slide {{RESULT_LABEL}}/{{COST_LABEL}} tags — mirrors buildGoogleSlots slot 4/5 per campaign type. */
export function googleSlideObjectiveLabels(objectiveKey: GoogleObjectiveKey): { resultLabel: string; costLabel: string } {
  switch (objectiveKey) {
    case "shopping":
    case "performance_max":
      return { resultLabel: "CONV. VALUE", costLabel: "ROAS" };
    case "display":
      return { resultLabel: "VIEWABLE IMPR.", costLabel: "VIEWABLE RATE" };
    case "video":
    case "youtube":
      return { resultLabel: "VIDEO VIEWS", costLabel: "AVG. CPV" };
    default:
      return { resultLabel: "CONVERSIONS", costLabel: "COST PER CONVERSION" };
  }
}

/** @deprecated Use googleSlideObjectiveLabels(detectGoogleObjectiveKey(headers)) */
export function googleCampaignObjectiveLabels(): { resultLabel: string; costLabel: string } {
  return googleSlideObjectiveLabels("search");
}

export interface GoogleResultDisplay {
  resultLabel: string;
  costLabel: string;
  resultValue: string;
  cprValue: string;
}

const GOOGLE_PRIMARY_METRIC_KEY: Partial<Record<GoogleObjectiveKey, string>> = {
  shopping: "conv_value",
  performance_max: "conv_value",
  display: "viewable_impr",
  video: "video_views",
  youtube: "video_views",
};

const GOOGLE_SECONDARY_METRIC_KEY: Partial<Record<GoogleObjectiveKey, string>> = {
  shopping: "roas",
  performance_max: "roas",
  display: "viewable_rate",
  video: "avg_cpv",
  youtube: "avg_cpv",
};

function googleMetricLookup(rawRows: RawMetricRow[], key: string, currencySymbol: string): string {
  const def = findGoogleMetricByKey(key);
  if (!def?.format) return "—";
  return lookupMetricValue(
    rawRows,
    { key: def.key, format: def.format, csvName: def.csvName, perUnitOf: def.perUnitOf, perUnitScale: def.perUnitScale },
    "google",
    currencySymbol,
  );
}

/** Campaign/ad-set result column for Google — uses slot-engine vocabulary, not Meta objective.ts. */
export function googleCampaignResultDisplay(
  rawRows: RawMetricRow[],
  objectiveKey: GoogleObjectiveKey,
  currencySymbol: string,
  totals: { spend: number; conversions: number },
): GoogleResultDisplay {
  const labels = googleSlideObjectiveLabels(objectiveKey);
  const primaryKey = GOOGLE_PRIMARY_METRIC_KEY[objectiveKey];
  if (!primaryKey) {
    return {
      ...labels,
      resultValue: fmtNumber(totals.conversions),
      cprValue: totals.conversions > 0 ? fmtCurrency2dp(totals.spend / totals.conversions, currencySymbol) : "—",
    };
  }
  const secondaryKey = GOOGLE_SECONDARY_METRIC_KEY[objectiveKey] ?? "cost_per_conv";
  return {
    ...labels,
    resultValue: googleMetricLookup(rawRows, primaryKey, currencySymbol),
    cprValue: googleMetricLookup(rawRows, secondaryKey, currencySymbol),
  };
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
