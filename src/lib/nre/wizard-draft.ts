import type { SelectedMetric } from "@/lib/nre/available-metrics";
import type { ObjectiveInfo } from "@/lib/nre/result-type-map";
import type { ReportData, ComparisonReportData } from "@/lib/nre/report-data";
import type { HistoricalReportData } from "@/lib/nre/historical-report-data";
import type { DayBreakdownReportData } from "@/lib/nre/day-breakdown-report-data";
import type { WizardReportType } from "@/lib/validators/report-wizard";

import type {
  DateMode,
  DateRangeIso,
  PreviewKind,
  PreviewStatus,
  Step,
  WizardPlatformChoice,
} from "@/components/report-upload-wizard/types";

const DRAFT_VERSION = 1 as const;

export const WIZARD_SERVER_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type WizardDraftSnapshot = {
  version: typeof DRAFT_VERSION;
  savedAt: string;
  step: Step;
  visitedSteps: Step[];
  uploadSessionId: string;
  platform: WizardPlatformChoice;
  reportType: WizardReportType;
  dateMode: DateMode;
  customStart: string;
  customEnd: string;
  selectedCampaigns: string[];
  selectedAdSets: string[];
  campaigns: string[];
  perCampaignMetrics: Array<{ normalized: string; metrics: SelectedMetric[] }>;
  campaignObjectives: Array<[string, ObjectiveInfo]>;
  previewKind: PreviewKind;
  previewStatus: PreviewStatus;
  data: ReportData | null;
  comparisonData: ComparisonReportData | null;
  historicalData: HistoricalReportData | null;
  dayBreakdownData: DayBreakdownReportData | null;
  mtdRange: DateRangeIso | null;
};

function storageKey(clientId: string): string {
  return `nre.wizardDraft.${clientId}`;
}

export function parseWizardDraftSnapshot(raw: string): WizardDraftSnapshot | null {
  try {
    const parsed = JSON.parse(raw) as WizardDraftSnapshot;
    if (parsed?.version !== DRAFT_VERSION || typeof parsed.uploadSessionId !== "string") return null;
    if (typeof parsed.step !== "number" || parsed.step < 1 || parsed.step > 4) return null;
    if (typeof parsed.savedAt !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function isWizardServerDraftExpired(draft: WizardDraftSnapshot, now = Date.now()): boolean {
  const saved = Date.parse(draft.savedAt);
  if (!Number.isFinite(saved)) return true;
  return now - saved > WIZARD_SERVER_DRAFT_TTL_MS;
}

function parseDraft(raw: string): WizardDraftSnapshot | null {
  return parseWizardDraftSnapshot(raw);
}

export function saveWizardDraft(clientId: string, snapshot: WizardDraftSnapshot): void {
  try {
    sessionStorage.setItem(storageKey(clientId), JSON.stringify(snapshot));
  } catch {
    /* quota / private mode */
  }
}

export function loadWizardDraft(clientId: string): WizardDraftSnapshot | null {
  try {
    const raw = sessionStorage.getItem(storageKey(clientId));
    if (!raw) return null;
    return parseDraft(raw);
  } catch {
    return null;
  }
}

export function clearWizardDraft(clientId: string): void {
  try {
    sessionStorage.removeItem(storageKey(clientId));
  } catch {
    /* private mode */
  }
}
