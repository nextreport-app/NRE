import { isLaunchReportTypeEnabled } from "@/lib/meta-launch-scope";
import { isWizardApiSyncVisible } from "@/lib/ad-platform-api-sync";
import type { DateMode, ReportTypeValue } from "./types";
import type { WizardGenerateBaseline } from "@/lib/nre/wizard-generate-baseline";

export type ClientWizardPreferences = {
  reportType?: ReportTypeValue;
  dateMode?: DateMode;
  customStart?: string;
  customEnd?: string;
  includePreviousMonthComparison?: boolean;
  showBudgetOnCover?: boolean;
  dataSourceMode?: "csv" | "api";
  /** User completed Metrics at least once for this client — metrics step may start collapsed. */
  metricsStepConfirmed?: boolean;
  /** Import download instructions start collapsed after first dismiss or successful CSV analyze. */
  importDownloadInstructionsCollapsed?: boolean;
  /** Snapshot from the last successful standard report — powers repeat-client skip to Generate. */
  generateBaseline?: WizardGenerateBaseline;
  updatedAt?: string;
};

function storageKey(clientId: string): string {
  return `nre.wizardPrefs.${clientId}`;
}

export function readClientWizardPreferences(clientId: string): ClientWizardPreferences | null {
  try {
    const raw = localStorage.getItem(storageKey(clientId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ClientWizardPreferences;
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.reportType && !isLaunchReportTypeEnabled(parsed.reportType)) {
      return { ...parsed, reportType: "WEEKLY", dateMode: "last7", customStart: undefined, customEnd: undefined, generateBaseline: undefined, dataSourceMode: "csv" };
    }
    // A saved API choice must not reopen controls hidden during CSV testing.
    if (parsed.dataSourceMode === "api" && !isWizardApiSyncVisible()) return { ...parsed, dataSourceMode: "csv" };
    return parsed;
  } catch {
    return null;
  }
}

export function saveClientWizardPreferences(clientId: string, patch: ClientWizardPreferences): void {
  try {
    const prev = readClientWizardPreferences(clientId) ?? {};
    const next: ClientWizardPreferences = {
      ...prev,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(storageKey(clientId), JSON.stringify(next));
  } catch {
    /* private mode */
  }
}
