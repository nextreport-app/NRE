"use client";

import { useState } from "react";
import type { Platform } from "@/lib/nre/google-columns";
import { useSiteTheme } from "@/components/site-theme-provider";
import { useWizardCopy } from "@/hooks/use-wizard-copy";
import { wizardReportTypeCopyForLocale } from "@/lib/wizard-i18n";
import { WIZARD_REPORT_TYPE_COPY } from "@/lib/nre/wizard-report-type-copy";
import type { ReportTypeValue } from "../types";
import { ReportTypeCard } from "./report-type-card";
import { LAUNCH_SECONDARY_REPORT_TYPES } from "@/lib/meta-launch-scope";
import { wizardCsvRequirementForReportType } from "@/lib/nre/wizard-report-csv-requirement";

function csvNote(reportType: ReportTypeValue, clientTimezone: string): string {
  return wizardCsvRequirementForReportType({ reportType, clientTimezone }).shortNote;
}

function WizardReportTypePickerGrid({
  reportType,
  clientTimezone,
  onReportTypeChange,
  moreOpen,
  setMoreOpen,
  onAfterSelect,
}: {
  reportType: ReportTypeValue;
  clientTimezone: string;
  onReportTypeChange: (next: ReportTypeValue) => void;
  moreOpen: boolean;
  setMoreOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  onAfterSelect?: () => void;
}) {
  const { locale } = useSiteTheme();
  const weekly = wizardReportTypeCopyForLocale(locale, "WEEKLY") ?? WIZARD_REPORT_TYPE_COPY.WEEKLY;
  const monthly = wizardReportTypeCopyForLocale(locale, "MONTHLY") ?? WIZARD_REPORT_TYPE_COPY.MONTHLY;
  const daily = wizardReportTypeCopyForLocale(locale, "DAILY") ?? WIZARD_REPORT_TYPE_COPY.DAILY;
  const comparison = wizardReportTypeCopyForLocale(locale, "COMPARISON") ?? WIZARD_REPORT_TYPE_COPY.COMPARISON;
  const historical = wizardReportTypeCopyForLocale(locale, "HISTORICAL") ?? WIZARD_REPORT_TYPE_COPY.HISTORICAL;
  const dayTable = wizardReportTypeCopyForLocale(locale, "DAY_BREAKDOWN") ?? WIZARD_REPORT_TYPE_COPY.DAY_BREAKDOWN;

  function select(next: ReportTypeValue) {
    onReportTypeChange(next);
    onAfterSelect?.();
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <ReportTypeCard
          icon="📊"
          heading={weekly.cardHeading}
          description={weekly.cardOneLiner}
          detailTooltip={weekly.cardYouGet}
          csvRequiredNote={csvNote("WEEKLY", clientTimezone)}
          selected={reportType === "WEEKLY"}
          onSelect={() => select("WEEKLY")}
          layout="compact"
          recommended
        />
        <ReportTypeCard
          icon="📅"
          heading={monthly.cardHeading}
          description={monthly.cardOneLiner}
          detailTooltip={monthly.cardYouGet}
          csvRequiredNote={csvNote("MONTHLY", clientTimezone)}
          selected={reportType === "MONTHLY"}
          onSelect={() => select("MONTHLY")}
          layout="compact"
        />
        <ReportTypeCard
          icon="☀️"
          heading={daily.cardHeading}
          description={daily.cardOneLiner}
          detailTooltip={daily.cardYouGet}
          csvRequiredNote={csvNote("DAILY", clientTimezone)}
          selected={reportType === "DAILY"}
          onSelect={() => select("DAILY")}
          layout="compact"
        />
      </div>

      <div>
        <button
          type="button"
          onClick={() => setMoreOpen((open) => !open)}
          className="flex w-full items-center justify-between rounded-md border border-dash-border nre-wizard-panel px-3 py-2.5 text-left text-[14px] font-medium text-dash-ink hover:bg-dash-border/40"
          aria-expanded={moreOpen}
        >
          <span>More report types</span>
          <span className="text-dash-ink-secondary">{moreOpen ? "▲" : "▼"}</span>
        </button>
        {moreOpen ? (
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <ReportTypeCard
              icon="🔀"
              heading={comparison.cardHeading}
              description={comparison.cardOneLiner}
              detailTooltip={comparison.cardYouGet}
              csvRequiredNote={csvNote("COMPARISON", clientTimezone)}
              selected={reportType === "COMPARISON"}
              onSelect={() => select("COMPARISON")}
              layout="compact"
            />
            <ReportTypeCard
              icon="📆"
              heading={historical.cardHeading}
              description={historical.cardOneLiner}
              detailTooltip={historical.cardYouGet}
              csvRequiredNote={csvNote("HISTORICAL", clientTimezone)}
              selected={reportType === "HISTORICAL"}
              onSelect={() => select("HISTORICAL")}
              layout="compact"
            />
            <ReportTypeCard
              icon="📋"
              heading={dayTable.cardHeading}
              description={dayTable.cardOneLiner}
              detailTooltip={dayTable.cardYouGet}
              csvRequiredNote={csvNote("DAY_BREAKDOWN", clientTimezone)}
              selected={reportType === "DAY_BREAKDOWN"}
              onSelect={() => select("DAY_BREAKDOWN")}
              layout="compact"
            />
          </div>
        ) : null}
      </div>
    </>
  );
}

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
  /** Generate step: jump back to Import to change report type (no duplicate picker). */
  onEditSetup?: () => void;
}) {
  const [moreOpen, setMoreOpen] = useState(() =>
    LAUNCH_SECONDARY_REPORT_TYPES.includes(reportType as (typeof LAUNCH_SECONDARY_REPORT_TYPES)[number]),
  );
  const copy = useWizardCopy();

  if (variant === "summary") {
    return (
      <div className="rounded-lg border border-dash-border bg-dash-card px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[13px] text-dash-ink-secondary">Report setup</p>
            <p className="text-[15px] font-semibold text-dash-ink">{reportTypeLabel}</p>
          </div>
          {onEditSetup ? (
            <button
              type="button"
              onClick={onEditSetup}
              className="text-[14px] font-medium text-dash-accent hover:underline"
            >
              Change on Import →
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-4 rounded-lg border border-dash-border border-l-4 border-l-dash-accent bg-dash-card p-5">
      <div>
        <h3 className="text-[16px] font-semibold text-dash-ink">{copy.whatReportBuilding}</h3>
        <p className="mt-1 text-[13px] text-dash-ink-secondary">{copy.reportTypeHint}</p>
      </div>

      <WizardReportTypePickerGrid
        reportType={reportType}
        clientTimezone={clientTimezone}
        onReportTypeChange={onReportTypeChange}
        moreOpen={moreOpen}
        setMoreOpen={setMoreOpen}
      />
    </section>
  );
}
