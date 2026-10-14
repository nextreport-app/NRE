import type { SelectedMetric } from "@/lib/nre/available-metrics";
import { normalizeCampaignName } from "@/lib/nre/objective";
import { z } from "zod";

export const WIZARD_HAPPY_PATH_BASELINE_VERSION = 1 as const;

export type WizardReportTypeForBaseline = "WEEKLY" | "MONTHLY" | "DAILY";
export type WizardBaselineDateMode = "last7" | "prev7" | "last14" | "custom";

/** Report types that may skip campaigns/metrics after a prior successful generate. */
export const HAPPY_PATH_ELIGIBLE_REPORT_TYPES: ReadonlySet<WizardReportTypeForBaseline> = new Set([
  "WEEKLY",
  "MONTHLY",
  "DAILY",
]);

const selectedMetricSchema = z.object({
  key: z.string(),
  label: z.string(),
  format: z.string(),
  csvName: z.string(),
  perUnitOf: z.string().optional(),
  perUnitScale: z.number().optional(),
});

export const wizardGenerateBaselineSchema = z.object({
  version: z.literal(WIZARD_HAPPY_PATH_BASELINE_VERSION),
  savedAt: z.string(),
  platform: z.enum(["META", "GOOGLE", "TIKTOK"]),
  reportType: z.enum(["WEEKLY", "MONTHLY", "DAILY"]),
  dateMode: z.enum(["last7", "prev7", "last14", "custom"]),
  customStart: z.string().optional(),
  customEnd: z.string().optional(),
  includePreviousMonthComparison: z.boolean(),
  showBudgetOnCover: z.boolean(),
  dataSourceMode: z.literal("csv"),
  csvHeaderFingerprint: z.string(),
  metricsFingerprint: z.string().optional(),
  campaignNames: z.array(z.string()),
  selectedCampaigns: z.array(z.string()),
  selectedAdSets: z.array(z.string()),
  perCampaignMetrics: z.array(
    z.object({
      normalized: z.string(),
      metrics: z.array(selectedMetricSchema),
    }),
  ),
  campaignObjectives: z.array(
    z.tuple([
      z.string(),
      z.object({
        key: z.string(),
        resultLabel: z.string(),
        costLabel: z.string(),
      }),
    ]),
  ),
  touchedObjectiveCampaigns: z.array(z.string()),
});

export type WizardGenerateBaseline = z.infer<typeof wizardGenerateBaselineSchema>;

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
  | "ad_set_selection_mismatch"
  | "metrics_mismatch";

export type HappyPathEligibility =
  | { ok: true }
  | { ok: false; reason: HappyPathEligibilityReason };

export function parseWizardGenerateBaseline(raw: string | null | undefined): WizardGenerateBaseline | null {
  if (!raw) return null;
  try {
    const parsed = wizardGenerateBaselineSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function serializeWizardGenerateBaseline(baseline: WizardGenerateBaseline): string {
  return JSON.stringify(baseline);
}

/** Prefer the baseline with the latest savedAt (cross-device sync). */
export function mergeWizardGenerateBaselines(
  a: WizardGenerateBaseline | null | undefined,
  b: WizardGenerateBaseline | null | undefined,
): WizardGenerateBaseline | null {
  if (!a) return b ?? null;
  if (!b) return a;
  const aTs = Date.parse(a.savedAt);
  const bTs = Date.parse(b.savedAt);
  if (Number.isFinite(aTs) && Number.isFinite(bTs)) {
    return bTs >= aTs ? b : a;
  }
  return bTs >= aTs ? b : a;
}

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

export function computeMetricsFingerprint(
  selectedCampaigns: string[],
  perCampaignMetrics: Map<string, SelectedMetric[]> | Record<string, SelectedMetric[]>,
): string {
  const lookup = (normalized: string): SelectedMetric[] => {
    if (perCampaignMetrics instanceof Map) {
      return perCampaignMetrics.get(normalized) ?? [];
    }
    return perCampaignMetrics[normalized] ?? [];
  };
  const parts = sortedNames(selectedCampaigns).map((name) => {
    const normalized = normalizeCampaignName(name);
    const keys = lookup(normalized)
      .map((m) => m.key)
      .sort()
      .join(",");
    return `${normalized}:${keys}`;
  });
  return parts.join("|");
}

export function evaluateHappyPathEligibility(input: {
  baseline: WizardGenerateBaseline | null | undefined;
  platform: "META" | "GOOGLE" | "TIKTOK";
  reportType: string;
  dateMode: WizardBaselineDateMode;
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
  if (!HAPPY_PATH_ELIGIBLE_REPORT_TYPES.has(input.reportType as WizardReportTypeForBaseline)) {
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

export function metricsMatchBaseline(
  baseline: WizardGenerateBaseline,
  selectedCampaigns: string[],
  perCampaignMetrics: Map<string, SelectedMetric[]> | Record<string, SelectedMetric[]>,
): boolean {
  const fetchedFp = computeMetricsFingerprint(selectedCampaigns, perCampaignMetrics);
  if (baseline.metricsFingerprint) {
    return fetchedFp === baseline.metricsFingerprint;
  }
  const map =
    perCampaignMetrics instanceof Map
      ? perCampaignMetrics
      : new Map(Object.entries(perCampaignMetrics));
  for (const name of selectedCampaigns) {
    const normalized = normalizeCampaignName(name);
    const fromState = [...(map.get(normalized) ?? [])].map((m) => m.key).sort();
    const fromBaseline = metricKeysForCampaign(
      baseline.perCampaignMetrics as Array<{ normalized: string; metrics: SelectedMetric[] }>,
      normalized,
    );
    if (fromState.length !== fromBaseline.length || fromState.some((k, i) => k !== fromBaseline[i])) {
      return false;
    }
  }
  return true;
}

/** Apply stored selection onto post-analyze state (campaigns must already match baseline roster). */
export function selectionFromBaseline(
  baseline: WizardGenerateBaseline,
  validCampaigns: Set<string>,
  validAdSetKeys: Set<string>,
): {
  selectedCampaigns: string[];
  selectedAdSets: string[];
  perCampaignMetrics: Map<string, SelectedMetric[]>;
  campaignObjectives: Map<string, { key: string; resultLabel: string; costLabel: string }>;
  touchedObjectiveCampaigns: Set<string>;
} {
  const selectedCampaigns = baseline.selectedCampaigns.filter((c) => validCampaigns.has(c));
  const selectedAdSets = baseline.selectedAdSets.filter((k) => validAdSetKeys.has(k));
  const perCampaignMetrics = new Map<string, SelectedMetric[]>(
    baseline.perCampaignMetrics.map((e) => [
      e.normalized,
      e.metrics.map((m) => ({ ...m })) as SelectedMetric[],
    ]),
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
  reportType: string;
  dateMode: WizardBaselineDateMode;
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
  if (!HAPPY_PATH_ELIGIBLE_REPORT_TYPES.has(input.reportType as WizardReportTypeForBaseline)) return null;
  const perCampaignMetricsArr = [...input.perCampaignMetrics.entries()].map(([normalized, metrics]) => ({
    normalized,
    metrics: metrics.map((m) => ({ ...m })),
  }));
  return {
    version: WIZARD_HAPPY_PATH_BASELINE_VERSION,
    savedAt: new Date().toISOString(),
    platform: input.platform,
    reportType: input.reportType as WizardReportTypeForBaseline,
    dateMode: input.dateMode,
    customStart: input.dateMode === "custom" ? input.customStart : undefined,
    customEnd: input.dateMode === "custom" ? input.customEnd : undefined,
    includePreviousMonthComparison: input.includePreviousMonthComparison,
    showBudgetOnCover: input.showBudgetOnCover,
    dataSourceMode: "csv",
    csvHeaderFingerprint: fingerprintCsvHeaders(input.csvHeaders),
    metricsFingerprint: computeMetricsFingerprint(input.selectedCampaigns, input.perCampaignMetrics),
    campaignNames: sortedNames(input.campaignNames),
    selectedCampaigns: sortedNames(input.selectedCampaigns),
    selectedAdSets: sortedNames(input.selectedAdSets),
    perCampaignMetrics: perCampaignMetricsArr,
    campaignObjectives: [...input.campaignObjectives.entries()],
    touchedObjectiveCampaigns: [...input.touchedObjectiveCampaigns],
  };
}
