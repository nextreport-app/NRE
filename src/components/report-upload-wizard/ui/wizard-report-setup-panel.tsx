"use client";

import { useId, useState } from "react";
import type { Platform } from "@/lib/nre/google-columns";
import { useSiteTheme } from "@/components/site-theme-provider";
import { wizardReportTypeCopyForLocale } from "@/lib/wizard-i18n";
import { WIZARD_REPORT_TYPE_COPY } from "@/lib/nre/wizard-report-type-copy";
import type { ReportTypeValue } from "../types";
import { ReportTypeCard } from "./report-type-card";
import { LAUNCH_PRIMARY_REPORT_TYPES, LAUNCH_SECONDARY_REPORT_TYPES } from "@/lib/meta-launch-scope";
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

  function renderChoice(type: (typeof LAUNCH_PRIMARY_REPORT_TYPES)[number]) {
    const copy = wizardReportTypeCopyForLocale(locale, type) ?? WIZARD_REPORT_TYPE_COPY[type];
    const icons: Record<string, string> = { WEEKLY: "📊", MONTHLY: "🗓️", DAILY: "☀️", HISTORICAL: "📈", COMPARISON: "🔀", DAY_BREAKDOWN: "📋" };
    return <ReportTypeCard key={type} icon={icons[type]} heading={copy.cardHeading} description={copy.cardOneLiner} csvRequiredNote={wizardCsvRequirementForReportType({ reportType: type, clientTimezone }).shortNote} selected={reportType === type || (type === "MONTHLY" && reportType === "HISTORICAL") || (type === "DAY_BREAKDOWN" && reportType === "DAILY")} recommended={type === "WEEKLY"} layout="compact" onSelect={() => { onReportTypeChange(type); setSetupOpen(false); }} />;
  }

  if (variant === "summary") {
    return <div className="rounded-lg border border-dash-border bg-dash-card px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-[13px] text-dash-ink-secondary">Report setup</p><p className="text-[15px] font-semibold text-dash-ink">{reportTypeLabel}</p></div>
        {onEditSetup && <button type="button" onClick={onEditSetup} className="text-[14px] font-medium text-dash-accent hover:underline">Change on Import →</button>}
      </div>
    </div>;
  }

  return <section className="overflow-hidden rounded-lg border border-dash-border bg-dash-bg/30">
    <div className="space-y-2 px-4 py-3.5 sm:px-5">
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div className="min-w-0"><p className="text-[11px] font-semibold uppercase tracking-wide text-dash-ink-secondary">Report type</p><h3 className="mt-0.5 text-[16px] font-semibold text-dash-ink">{reportTypeLabel}</h3></div>
      <button type="button" onClick={() => setSetupOpen(open => !open)} aria-expanded={setupOpen} aria-controls={choicesId} className="text-[13px] font-medium text-dash-accent hover:underline">{setupOpen ? "Close choices" : "Change report type"}</button>
    </div>
    <p className="text-[13px] leading-relaxed text-dash-ink-secondary" title={selectedCopy.cardYouGet}>{reportType === "WEEKLY" && locale === "en" ? "Weekly performance, month-to-date totals and a 30-day chart." : selectedCopy.cardOneLiner}</p>
    </div>
    {!["MONTHLY", "HISTORICAL"].includes(reportType) && <p className="border-t border-dash-border px-4 py-2.5 text-[12px] text-dash-ink-secondary sm:px-5"><span className="font-medium">CSV needed:</span> {requirement.shortNote}</p>}
    {setupOpen && <div id={choicesId} className="space-y-3 border-t border-dash-border p-4 sm:px-5">
      <p className="text-[14px] font-medium text-dash-ink">What would you like to report?</p>
      <p className="text-[12px] text-dash-ink-secondary">Choose the output you need. CSV requirements depend on the report type.</p>
      <div role="group" aria-label="Choose report type" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {LAUNCH_PRIMARY_REPORT_TYPES.map(renderChoice)}
      </div>
      {LAUNCH_SECONDARY_REPORT_TYPES.length > 0 && <details className="rounded-lg border border-dash-border p-3" open={LAUNCH_SECONDARY_REPORT_TYPES.some(type => type === reportType) || undefined}>
        <summary className="cursor-pointer text-[13px] font-medium text-dash-ink">Compare or view detailed data</summary>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">{LAUNCH_SECONDARY_REPORT_TYPES.map(renderChoice)}</div>
      </details>}
    </div>}
  </section>;
}
