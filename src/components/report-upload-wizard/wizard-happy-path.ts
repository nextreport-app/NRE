import type { SelectedMetric } from "@/lib/nre/available-metrics";
import { normalizeCampaignName } from "@/lib/nre/objective";
import type { DateMode, ReportTypeValue } from "./types";

export const WIZARD_HAPPY_PATH_BASELINE_VERSION = 1 as const;

/** Report types that may skip campaigns/metrics after a prior successful generate. */
export const HAPPY_PATH_ELIGIBLE_REPORT_TYPES: ReadonlySet<ReportTypeValue> = new Set([
  "WEEKLY",
  "MONTHLY",
  "DAILY",
]);

export type WizardGenerateBaseline = {
  version: typeof WIZARD_HAPPY_PATH_BASELINE_VERSION;
  savedAt: string;
  platform: "META" | "GOOGLE" | "TIKTOK";
  reportType: ReportTypeValue;
  dateMode: DateMode;
  customStart?: string;
  customEnd?: string;
  includePreviousMonthComparison: boolean;
  showBudgetOnCover: boolean;
  dataSourceMode: "csv";
  csvHeaderFingerprint: string;
  /** Full campaign list from the upload when this baseline was saved (sorted). */
  campaignNames: string[];
  selectedCampaigns: string[];
  selectedAdSets: string[];
  perCampaignMetrics: Array<{ normalized: string; metrics: SelectedMetric[] }>;
  campaignObjectives: Array<[string, { key: string; resultLabel: string; costLabel: string }]>;
  touchedObjectiveCampaigns: string[];
};

export type HappyPathEligibilityReason =
  | "no_baseline"
  | "report_type_not_eligible"
  | "platform_mismatch"
  | "report_type_mismatch"
  | "date_settings_mismatch"
  | "comparison_toggle_mismatch"
  | "budget_toggle_mismatch"
  | "not_manual_csv"
  | "csv_headers_changed"
  | "campaign_roster_changed"
  | "selection_mismatch"
  | "ad_set_selection_mismatch";

export type HappyPathEligibility =
  | { ok: true }
  | { ok: false; reason: HappyPathEligibilityReason };

export function fingerprintCsvHeaders(headers: string[]): string {
  return [...headers].map((h) => h.trim()).sort().join("\u001f");
}

function sortedNames(names: string[]): string[] {
  return [...names].sort((a, b) => a.localeCompare(b));
}

function namesEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = sortedNames(a);
  const sb = sortedNames(b);
  return sa.every((v, i) => v === sb[i]);
}

function metricKeysForCampaign(
  perCampaignMetrics: Array<{ normalized: string; metrics: SelectedMetric[] }>,
  normalized: string,
): string[] {
  const entry = perCampaignMetrics.find((e) => e.normalized === normalized);
  if (!entry) return [];
  return entry.metrics.map((m) => m.key).sort();
}

export function evaluateHappyPathEligibility(input: {
  baseline: WizardGenerateBaseline | null | undefined;
  platform: "META" | "GOOGLE" | "TIKTOK";
  reportType: ReportTypeValue;
  dateMode: DateMode;
  customStart: string;
  customEnd: string;
  includePreviousMonthComparison: boolean;
  showBudgetOnCover: boolean;
  dataSourceMode: "csv" | "api";
  isApiSyncArtifact: boolean;
  apiSyncHybridImport: boolean;
  csvHeaders: string[];
  campaignNames: string[];
  validCampaigns: Set<string>;
  validAdSetKeys: Set<string>;
}): HappyPathEligibility {
  const baseline = input.baseline;
  if (!baseline || baseline.version !== WIZARD_HAPPY_PATH_BASELINE_VERSION) {
    return { ok: false, reason: "no_baseline" };
  }
  if (!HAPPY_PATH_ELIGIBLE_REPORT_TYPES.has(input.reportType)) {
    return { ok: false, reason: "report_type_not_eligible" };
  }
  if (baseline.reportType !== input.reportType) {
    return { ok: false, reason: "report_type_mismatch" };
  }
  if (baseline.platform !== input.platform) {
    return { ok: false, reason: "platform_mismatch" };
  }
  if (baseline.dateMode !== input.dateMode) {
    return { ok: false, reason: "date_settings_mismatch" };
  }
  if (input.dateMode === "custom") {
    if ((baseline.customStart || "") !== input.customStart || (baseline.customEnd || "") !== input.customEnd) {
      return { ok: false, reason: "date_settings_mismatch" };
    }
  }
  if (baseline.includePreviousMonthComparison !== input.includePreviousMonthComparison) {
    return { ok: false, reason: "comparison_toggle_mismatch" };
  }
  if (baseline.showBudgetOnCover !== input.showBudgetOnCover) {
    return { ok: false, reason: "budget_toggle_mismatch" };
  }
  if (
    input.dataSourceMode !== "csv" ||
    input.isApiSyncArtifact ||
    input.apiSyncHybridImport ||
    baseline.dataSourceMode !== "csv"
  ) {
    return { ok: false, reason: "not_manual_csv" };
  }
  if (fingerprintCsvHeaders(input.csvHeaders) !== baseline.csvHeaderFingerprint) {
    return { ok: false, reason: "csv_headers_changed" };
  }
  if (!namesEqual(input.campaignNames, baseline.campaignNames)) {
    return { ok: false, reason: "campaign_roster_changed" };
  }
  const applicableSelected = baseline.selectedCampaigns.filter((c) => input.validCampaigns.has(c));
  if (applicableSelected.length !== baseline.selectedCampaigns.length) {
    return { ok: false, reason: "selection_mismatch" };
  }
  const applicableAdSets = baseline.selectedAdSets.filter((k) => input.validAdSetKeys.has(k));
  if (applicableAdSets.length !== baseline.selectedAdSets.length) {
    return { ok: false, reason: "ad_set_selection_mismatch" };
  }
  return { ok: true };
}

export function perCampaignMetricsMatchBaseline(
  baseline: WizardGenerateBaseline,
  selectedCampaigns: string[],
  perCampaignMetrics: Map<string, SelectedMetric[]>,
): boolean {
  for (const name of selectedCampaigns) {
    const normalized = normalizeCampaignName(name);
    const fromState = [...(perCampaignMetrics.get(normalized) ?? [])].map((m) => m.key).sort();
    const fromBaseline = metricKeysForCampaign(baseline.perCampaignMetrics, normalized);
    if (fromState.length !== fromBaseline.length || fromState.some((k, i) => k !== fromBaseline[i])) {
      return false;
    }
  }
  return true;
}

/** Apply stored selection onto post-analyze state (campaigns must already match baseline roster). */
export function selectionFromBaseline(baseline: WizardGenerateBaseline, validCampaigns: Set<string>, validAdSetKeys: Set<string>): {
  selectedCampaigns: string[];
  selectedAdSets: string[];
  perCampaignMetrics: Map<string, SelectedMetric[]>;
  campaignObjectives: Map<string, { key: string; resultLabel: string; costLabel: string }>;
  touchedObjectiveCampaigns: Set<string>;
} {
  const selectedCampaigns = baseline.selectedCampaigns.filter((c) => validCampaigns.has(c));
  const selectedAdSets = baseline.selectedAdSets.filter((k) => validAdSetKeys.has(k));
  const perCampaignMetrics = new Map<string, SelectedMetric[]>(
    baseline.perCampaignMetrics.map((e) => [e.normalized, e.metrics.map((m) => ({ ...m }))]),
  );
  const campaignObjectives = new Map(baseline.campaignObjectives);
  const touchedObjectiveCampaigns = new Set(baseline.touchedObjectiveCampaigns);
  return {
    selectedCampaigns,
    selectedAdSets,
    perCampaignMetrics,
    campaignObjectives,
    touchedObjectiveCampaigns,
  };
}

export function buildWizardGenerateBaseline(input: {
  platform: "META" | "GOOGLE" | "TIKTOK";
  reportType: ReportTypeValue;
  dateMode: DateMode;
  customStart: string;
  customEnd: string;
  includePreviousMonthComparison: boolean;
  showBudgetOnCover: boolean;
  csvHeaders: string[];
  campaignNames: string[];
  selectedCampaigns: string[];
  selectedAdSets: string[];
  perCampaignMetrics: Map<string, SelectedMetric[]>;
  campaignObjectives: Map<string, { key: string; resultLabel: string; costLabel: string }>;
  touchedObjectiveCampaigns: Set<string>;
}): WizardGenerateBaseline | null {
  if (!HAPPY_PATH_ELIGIBLE_REPORT_TYPES.has(input.reportType)) return null;
  return {
    version: WIZARD_HAPPY_PATH_BASELINE_VERSION,
    savedAt: new Date().toISOString(),
    platform: input.platform,
    reportType: input.reportType,
    dateMode: input.dateMode,
    customStart: input.dateMode === "custom" ? input.customStart : undefined,
    customEnd: input.dateMode === "custom" ? input.customEnd : undefined,
    includePreviousMonthComparison: input.includePreviousMonthComparison,
    showBudgetOnCover: input.showBudgetOnCover,
    dataSourceMode: "csv",
    csvHeaderFingerprint: fingerprintCsvHeaders(input.csvHeaders),
    campaignNames: sortedNames(input.campaignNames),
    selectedCampaigns: sortedNames(input.selectedCampaigns),
    selectedAdSets: sortedNames(input.selectedAdSets),
    perCampaignMetrics: [...input.perCampaignMetrics.entries()].map(([normalized, metrics]) => ({
      normalized,
      metrics: metrics.map((m) => ({ ...m })),
    })),
    campaignObjectives: [...input.campaignObjectives.entries()],
    touchedObjectiveCampaigns: [...input.touchedObjectiveCampaigns],
  };
}
