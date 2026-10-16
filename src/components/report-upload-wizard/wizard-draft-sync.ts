import type { SelectedMetric } from "@/lib/nre/available-metrics";
import type { ObjectiveInfo } from "@/lib/nre/result-type-map";
import type { WizardDraftSnapshot } from "@/lib/nre/wizard-draft";
import type {
  DateMode,
  PreviewKind,
  PreviewStatus,
  Step,
  WizardPlatformChoice,
} from "./types";
import type { WizardReportType } from "@/lib/validators/report-wizard";

export type WizardDraftPersistInput = {
  step: Step;
  visitedSteps: Set<Step>;
  uploadSessionId: string;
  platform: WizardPlatformChoice;
  reportType: WizardReportType;
  dateMode: DateMode;
  customStart: string;
  customEnd: string;
  selectedCampaigns: Set<string>;
  selectedAdSets: Set<string>;
  campaigns: string[];
  perCampaignMetrics: Map<string, SelectedMetric[]>;
  campaignObjectives: Map<string, ObjectiveInfo>;
  previewKind: PreviewKind;
  previewStatus: PreviewStatus;
  data: WizardDraftSnapshot["data"];
  comparisonData: WizardDraftSnapshot["comparisonData"];
  historicalData: WizardDraftSnapshot["historicalData"];
  dayBreakdownData: WizardDraftSnapshot["dayBreakdownData"];
  mtdRange: WizardDraftSnapshot["mtdRange"];
  weeklyOptions: WizardDraftSnapshot["weeklyOptions"];
  dateBounds: WizardDraftSnapshot["dateBounds"];
  dailyRange: WizardDraftSnapshot["dailyRange"];
};

export function buildWizardDraftSnapshot(input: WizardDraftPersistInput): WizardDraftSnapshot {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    step: input.step,
    visitedSteps: Array.from(input.visitedSteps).sort((a, b) => a - b) as Step[],
    uploadSessionId: input.uploadSessionId,
    platform: input.platform,
    reportType: input.reportType,
    dateMode: input.dateMode,
    customStart: input.customStart,
    customEnd: input.customEnd,
    selectedCampaigns: Array.from(input.selectedCampaigns),
    selectedAdSets: Array.from(input.selectedAdSets),
    campaigns: input.campaigns,
    perCampaignMetrics: Array.from(input.perCampaignMetrics.entries()).map(([normalized, metrics]) => ({
      normalized,
      metrics,
    })),
    campaignObjectives: Array.from(input.campaignObjectives.entries()),
    previewKind: input.previewKind,
    previewStatus: input.previewStatus,
    data: input.data,
    comparisonData: input.comparisonData,
    historicalData: input.historicalData,
    dayBreakdownData: input.dayBreakdownData,
    mtdRange: input.mtdRange,
    weeklyOptions: input.weeklyOptions ?? null,
    dateBounds: input.dateBounds ?? null,
    dailyRange: input.dailyRange ?? null,
  };
}

export function perCampaignMetricsFromDraft(
  entries: WizardDraftSnapshot["perCampaignMetrics"],
): Map<string, SelectedMetric[]> {
  return new Map(entries.map(({ normalized, metrics }) => [normalized, metrics]));
}

export function campaignObjectivesFromDraft(
  entries: WizardDraftSnapshot["campaignObjectives"],
): Map<string, ObjectiveInfo> {
  return new Map(entries);
}
