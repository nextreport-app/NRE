import type { ComparisonReportData, ReportData } from "@/lib/nre/report-data";

const SNAPSHOT_VERSION = 1 as const;

export interface WizardGenerateSnapshot {
  version: typeof SNAPSHOT_VERSION;
  reportId: string;
  downloadUrl: string;
  shareToken: string | null;
  platform: "META" | "GOOGLE";
  reportType: "WEEKLY" | "MONTHLY" | "COMPARISON";
  dateMode: "last7" | "prev7" | "custom";
  customStart: string;
  customEnd: string;
  dateBounds: { minIso: string; maxIso: string } | null;
  weeklyOptions: { last7: { startIso: string; endIso: string }; prev7: { startIso: string; endIso: string } } | null;
  mtdRange: { startIso: string; endIso: string } | null;
  monthComparisonOptions: { periodA: { startIso: string; endIso: string }; periodB: { startIso: string; endIso: string } } | null;
  comparisonPreset: "thisWeek" | "thisMonth" | "custom";
  comparisonPeriodA: { startIso: string; endIso: string } | null;
  comparisonPeriodB: { startIso: string; endIso: string } | null;
  previewKind: "normal" | "comparison";
  previewStatus: "idle" | "loading" | "invalid" | "error";
  data: ReportData | null;
  comparisonData: ComparisonReportData | null;
  reportTitle: string;
  reportTitleTouched: boolean;
  customTitleExpanded: boolean;
  selectedCampaigns: string[];
  driveView: "collapsed" | "editing" | "success";
  driveSaveUrl: string | null;
  rememberedFolder: { id: string; name: string } | null;
}

function storageKey(clientId: string): string {
  return `nre.wizardGenerate.${clientId}`;
}

function parseSnapshot(raw: string): WizardGenerateSnapshot | null {
  try {
    const parsed = JSON.parse(raw) as WizardGenerateSnapshot;
    if (parsed?.version !== SNAPSHOT_VERSION || typeof parsed.reportId !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveWizardGenerateSnapshot(clientId: string, snapshot: WizardGenerateSnapshot): void {
  try {
    sessionStorage.setItem(storageKey(clientId), JSON.stringify(snapshot));
  } catch {
    /* private mode / quota */
  }
}

export function loadWizardGenerateSnapshot(clientId: string, reportId: string): WizardGenerateSnapshot | null {
  try {
    const raw = sessionStorage.getItem(storageKey(clientId));
    if (!raw) return null;
    const snapshot = parseSnapshot(raw);
    if (!snapshot || snapshot.reportId !== reportId) return null;
    return snapshot;
  } catch {
    return null;
  }
}

export function clearWizardGenerateSnapshot(clientId: string): void {
  try {
    sessionStorage.removeItem(storageKey(clientId));
  } catch {
    /* private mode */
  }
}

/** After publish regenerates the PPTX, allow saving the updated deck to Drive again. */
export function invalidateGenerateSnapshotDrive(clientId: string, reportId: string): void {
  const snapshot = loadWizardGenerateSnapshot(clientId, reportId);
  if (!snapshot) return;
  saveWizardGenerateSnapshot(clientId, {
    ...snapshot,
    driveView: "collapsed",
    driveSaveUrl: null,
  });
}
