/**
 * Central platform dispatch for the unified ad reporting pipeline (Meta, Google
 * Ads, TikTok). One place for dictionary/slot/label decisions so routes,
 * buildReportData, metrics, share, and validate stay consistent.
 */

import type { Platform } from "./google-columns";
import type { MetricPlatform } from "./available-metrics";
import { detectGoogleObjectiveKey, googleObjectiveSpecForKey, type GoogleObjectiveKey } from "./detect-objective";
import {
  defaultGoogleSelection,
  defaultMetaSelection,
  type SelectedMetric,
} from "./available-metrics";
import { aggregateDynamicMetrics, lookupMetricValue, type MetricRef, type RawMetricRow } from "./dynamic-metrics";
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

/** Google uses per-campaign campaign-type slots; Meta/TikTok use per-campaign objectives. */
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
  const spec = googleObjectiveSpecForKey(objectiveKey);
  return { resultLabel: spec.resultLabel, costLabel: spec.costLabel };
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
  const spec = googleObjectiveSpecForKey(objectiveKey);
  const labels = { resultLabel: spec.resultLabel, costLabel: spec.costLabel };
  const primaryKey = spec.primaryMetricKey;
  if (!primaryKey) {
    return {
      ...labels,
      resultValue: fmtNumber(totals.conversions),
      cprValue: totals.conversions > 0 ? fmtCurrency2dp(totals.spend / totals.conversions, currencySymbol) : "—",
    };
  }
  const secondaryKey = spec.secondaryMetricKey ?? "cost_per_conv";
  return {
    ...labels,
    resultValue: googleMetricLookup(rawRows, primaryKey, currencySymbol),
    cprValue: googleMetricLookup(rawRows, secondaryKey, currencySymbol),
  };
}

function googleMetricRef(key: string): MetricRef | null {
  const def = findGoogleMetricByKey(key);
  if (!def?.format) return null;
  return {
    key: def.key,
    format: def.format,
    csvName: def.csvName,
    perUnitOf: def.perUnitOf,
    perUnitScale: def.perUnitScale,
  };
}

/** Comparison-report result/cost totals for Google — uses slot-engine metrics, not Meta objective.ts. */
export function googleComparisonObjectiveTotals(
  rawRows: RawMetricRow[],
  objectiveKey: GoogleObjectiveKey,
  spend: number,
): { count: number; cpr: number } {
  const spec = googleObjectiveSpecForKey(objectiveKey);
  const primaryKey = spec.primaryMetricKey;
  if (!primaryKey) {
    const convRef = googleMetricRef("conversions");
    const count = convRef ? (aggregateDynamicMetrics(rawRows, [convRef], "google").conversions ?? 0) : 0;
    return { count, cpr: count > 0 ? spend / count : 0 };
  }
  const primaryRef = googleMetricRef(primaryKey);
  const count = primaryRef ? (aggregateDynamicMetrics(rawRows, [primaryRef], "google")[primaryKey] ?? 0) : 0;
  const secondaryKey = spec.secondaryMetricKey;
  if (secondaryKey) {
    const secRef = googleMetricRef(secondaryKey);
    const cpr = secRef ? (aggregateDynamicMetrics(rawRows, [secRef], "google")[secondaryKey] ?? 0) : 0;
    return { count, cpr };
  }
  return { count, cpr: count > 0 ? spend / count : 0 };
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
