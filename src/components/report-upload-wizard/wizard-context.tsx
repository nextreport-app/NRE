"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useReportUploadWizard } from "./use-report-upload-wizard";
import type { ReportUploadWizardProps } from "./types";

export type WizardContextValue = ReturnType<typeof useReportUploadWizard>;

const WizardContext = createContext<WizardContextValue | null>(null);

export function WizardProvider({ children, ...props }: ReportUploadWizardProps & { children: ReactNode }) {
  const value = useReportUploadWizard(props);
  return <WizardContext.Provider value={value}>{children}</WizardContext.Provider>;
}

export function useWizardContext(): WizardContextValue {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error("useWizardContext must be used within WizardProvider");
  return ctx;
}
