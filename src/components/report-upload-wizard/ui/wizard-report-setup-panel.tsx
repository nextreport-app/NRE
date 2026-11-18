"use client";

import { useId } from "react";
import type { Platform } from "@/lib/nre/google-columns";
import { useSiteTheme } from "@/components/site-theme-provider";
import { wizardReportTypeCopyForLocale } from "@/lib/wizard-i18n";
import { WIZARD_REPORT_TYPE_COPY } from "@/lib/nre/wizard-report-type-copy";
import type { ReportTypeValue } from "../types";
import { LAUNCH_PRIMARY_REPORT_TYPES, LAUNCH_SECONDARY_REPORT_TYPES } from "@/lib/meta-launch-scope";
import { wizardCsvRequirementForReportType } from "@/lib/nre/wizard-report-csv-requirement";

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
  return <section className="rounded-xl border border-dash-border bg-dash-bg/30 p-4 sm:p-5">
    <label htmlFor={choicesId} className="block text-sm font-semibold text-dash-ink">Report type</label>
    <select id={choicesId} value={selectedType} onChange={event => onReportTypeChange(event.target.value as ReportTypeValue)} className="mt-2 w-full rounded-lg border border-dash-border bg-dash-card px-3 py-2.5 text-sm text-dash-ink sm:max-w-sm">
      {choices.map(type => <option key={type} value={type}>{(wizardReportTypeCopyForLocale(locale, type) ?? WIZARD_REPORT_TYPE_COPY[type]).cardHeading}</option>)}
    </select>
    <dl className="mt-4 space-y-3 text-sm">
      <div><dt className="font-medium text-dash-ink">What you get</dt><dd className="mt-0.5 text-dash-ink-secondary">{reportType === "WEEKLY" && locale === "en" ? "Weekly performance, month-to-date totals and a 30-day chart." : selectedCopy.cardOneLiner}</dd></div>
      <div><dt className="font-medium text-dash-ink">{source === "api" ? "Data needed" : "CSV needed"}</dt><dd className="mt-0.5 text-dash-ink-secondary">{source === "api" ? "Fetched automatically for your selected report dates." : requirement.shortNote}</dd></div>
    </dl>
  </section>;
}
