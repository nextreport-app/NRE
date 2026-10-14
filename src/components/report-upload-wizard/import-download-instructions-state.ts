import {
  readClientWizardPreferences,
  saveClientWizardPreferences,
} from "./client-wizard-preferences";

/** True when local prefs alone mean this client has already passed Import before. */
export function importDownloadInstructionsCollapsedLocally(clientId: string): boolean {
  const prefs = readClientWizardPreferences(clientId);
  if (prefs?.importDownloadInstructionsCollapsed) return true;
  if (prefs?.generateBaseline) return true;
  return false;
}

export type ImportWizardClientHints = {
  baseline: unknown | null;
  completedReportCount: number;
};

export function isReturningImportClient(hints: ImportWizardClientHints): boolean {
  if (hints.completedReportCount > 0) return true;
  return hints.baseline != null && typeof hints.baseline === "object";
}

export function rememberImportDownloadInstructionsCollapsed(clientId: string): void {
  saveClientWizardPreferences(clientId, { importDownloadInstructionsCollapsed: true });
}
