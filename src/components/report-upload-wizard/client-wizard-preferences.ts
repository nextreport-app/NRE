import type { DateMode, ReportTypeValue } from "./types";

export type ClientWizardPreferences = {
  reportType?: ReportTypeValue;
  dateMode?: DateMode;
  customStart?: string;
  customEnd?: string;
  includePreviousMonthComparison?: boolean;
  showBudgetOnCover?: boolean;
  dataSourceMode?: "csv" | "api";
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
