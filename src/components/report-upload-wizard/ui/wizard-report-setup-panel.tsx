"use client";

import { useId, useState } from "react";
import type { Platform } from "@/lib/nre/google-columns";
import { useSiteTheme } from "@/components/site-theme-provider";
import { wizardReportTypeCopyForLocale } from "@/lib/wizard-i18n";
import { WIZARD_REPORT_TYPE_COPY } from "@/lib/nre/wizard-report-type-copy";
import type { ReportTypeValue } from "../types";
import { ReportTypeCard } from "./report-type-card";
import { LAUNCH_ENABLED_REPORT_TYPES } from "@/lib/meta-launch-scope";
import { wizardCsvRequirementForReportType } from "@/lib/nre/wizard-report-csv-requirement";

export function WizardReportSetupPanel({
  reportType,
  reportTypeLabel,
  clientTimezone,
  onReportTypeChange,
  variant = "full",
  onEditSetup,
}: {
  reportType: ReportTypeValue;
  reportTypeLabel: string;
  platform: Platform;
  clientTimezone: string;
  onReportTypeChange: (next: ReportTypeValue) => void;
  variant?: "full" | "summary";
  onEditSetup?: () => void;
}) {
  const { locale } = useSiteTheme();
  const choicesId = useId();
  const [setupOpen, setSetupOpen] = useState(false);
  const selectedCopy = wizardReportTypeCopyForLocale(locale, reportType) ?? WIZARD_REPORT_TYPE_COPY[reportType];
  const requirement = wizardCsvRequirementForReportType({ reportType, clientTimezone });

  if (variant === "summary") {
    return <div className="rounded-lg border border-dash-border bg-dash-card px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-[13px] text-dash-ink-secondary">Report setup</p><p className="text-[15px] font-semibold text-dash-ink">{reportTypeLabel}</p></div>
        {onEditSetup && <button type="button" onClick={onEditSetup} className="text-[14px] font-medium text-dash-accent hover:underline">Change on Import →</button>}
      </div>
    </div>;
  }

  return <section className="space-y-3 rounded-lg border border-dash-border border-l-4 border-l-dash-accent bg-dash-card p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0"><p className="text-[11px] font-semibold uppercase tracking-wide text-dash-ink-secondary">Report type</p><h3 className="mt-1 text-[16px] font-semibold text-dash-ink">{reportTypeLabel}</h3></div>
      <button type="button" onClick={() => setSetupOpen(open => !open)} aria-expanded={setupOpen} aria-controls={choicesId} className="text-[13px] font-medium text-dash-accent hover:underline">{setupOpen ? "Close choices" : "Change report type"}</button>
    </div>
    <p className="max-w-2xl text-[13px] leading-relaxed text-dash-ink-secondary">{selectedCopy.cardYouGet}</p>
    <p className="text-[12px] text-dash-ink-secondary"><span className="font-medium text-dash-ink">CSV needed:</span> {requirement.shortNote}</p>
    {setupOpen && <div id={choicesId} role="group" aria-label="Choose report type" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {LAUNCH_ENABLED_REPORT_TYPES.map(type => {
        const copy = wizardReportTypeCopyForLocale(locale, type) ?? WIZARD_REPORT_TYPE_COPY[type];
        return <ReportTypeCard key={type} icon={type === "COMPARISON" ? "🔀" : "📊"} heading={copy.cardHeading} description={copy.cardOneLiner} selected={reportType === type} recommended={type === "WEEKLY"} layout="compact" onSelect={() => { onReportTypeChange(type); setSetupOpen(false); }} />;
      })}
    </div>}
  </section>;
}
