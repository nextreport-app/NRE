"use client";

import { useId } from "react";
import type { Platform } from "@/lib/nre/google-columns";
import { useSiteTheme } from "@/components/site-theme-provider";
import { wizardReportTypeCopyForLocale } from "@/lib/wizard-i18n";
import { WIZARD_REPORT_TYPE_COPY } from "@/lib/nre/wizard-report-type-copy";
import type { ReportTypeValue } from "../types";
import { LAUNCH_PRIMARY_REPORT_TYPES, LAUNCH_SECONDARY_REPORT_TYPES } from "@/lib/meta-launch-scope";
import { wizardCsvRequirementForReportType } from "@/lib/nre/wizard-report-csv-requirement";

/** Small, decorative previews distinguish report types without adding more copy. */
function ReportTypeIcon({ type }: { type: ReportTypeValue }) {
  const paths = type === "COMPARISON"
    ? <><path d="M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4" /></>
    : type === "DAY_BREAKDOWN"
      ? <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h4" /></>
      : type === "MONTHLY"
        ? <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 11h18M7 15h2m3 0h2m3 0h1M7 18h2m3 0h2" /></>
        : <><path d="M4 20h16M7 16v-5m5 5V5m5 11V8" /><path d="m5 7 5-4 5 2 4-3" /></>;
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">{paths}</svg>;
}

export function WizardReportSetupPanel({
  reportType,
  reportTypeLabel,
  clientTimezone,
  onReportTypeChange,
  source = "csv",
  variant = "full",
  onEditSetup,
}: {
  firstVisit?: boolean;
  source?: "csv" | "api";
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

  const selectedType = reportType === "HISTORICAL" ? "MONTHLY" : reportType === "DAILY" ? "DAY_BREAKDOWN" : reportType;
  const choices = [...LAUNCH_PRIMARY_REPORT_TYPES, ...LAUNCH_SECONDARY_REPORT_TYPES];
  const accent = selectedType === "MONTHLY" ? "text-violet-400 bg-violet-400/10 border-violet-400/25"
    : selectedType === "COMPARISON" ? "text-teal-400 bg-teal-400/10 border-teal-400/25"
    : selectedType === "DAY_BREAKDOWN" ? "text-rose-400 bg-rose-400/10 border-rose-400/25"
    : "text-sky-400 bg-sky-400/10 border-sky-400/25";
  return <section className="rounded-xl border border-dash-border bg-dash-bg/30 p-4 sm:p-5">
    <div className="flex items-center gap-3">
    <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${accent}`}><ReportTypeIcon type={selectedType} /></span>
    <div className="min-w-0 flex-1">
    <label htmlFor={choicesId} className="block text-sm font-semibold text-dash-ink">Report type</label>
    <select id={choicesId} value={selectedType} onChange={event => onReportTypeChange(event.target.value as ReportTypeValue)} className="mt-1.5 w-full rounded-lg border border-dash-border bg-dash-card px-3 py-2.5 text-sm text-dash-ink sm:max-w-sm">
      {choices.map(type => <option key={type} value={type}>{(wizardReportTypeCopyForLocale(locale, type) ?? WIZARD_REPORT_TYPE_COPY[type]).cardHeading}</option>)}
    </select>
    </div>
    </div>
    <dl className="mt-4 space-y-3 text-sm">
      <div><dt className="font-medium text-dash-ink">What you get</dt><dd className="mt-0.5 text-dash-ink-secondary">{reportType === "WEEKLY" && locale === "en" ? "Last 7 days’ performance, month-to-date totals and a 30-day chart." : selectedCopy.cardOneLiner}</dd></div>
      <div><dt className="font-medium text-dash-ink">{source === "api" ? "Data needed" : "CSV needed"}</dt><dd className="mt-0.5 text-dash-ink-secondary">{source === "api" ? "Fetched automatically for your selected report dates." : requirement.shortNote}</dd></div>
    </dl>
  </section>;
}
