"use client";

import { useId } from "react";
import {
  metaReportRequirement,
  type MetaReportSelection,
} from "@/lib/nre/meta-report-content/selection";
import type { Platform } from "@/lib/nre/google-columns";
import { useSiteTheme } from "@/components/site-theme-provider";
import { wizardReportTypeCopyForLocale } from "@/lib/wizard-i18n";
import { WIZARD_REPORT_TYPE_COPY } from "@/lib/nre/wizard-report-type-copy";
import type { ReportTypeValue } from "../types";
import {
  LAUNCH_PRIMARY_REPORT_TYPES,
  LAUNCH_SECONDARY_REPORT_TYPES,
} from "@/lib/meta-launch-scope";
import { wizardCsvRequirementForReportType } from "@/lib/nre/wizard-report-csv-requirement";

/** Small, decorative previews distinguish report types without adding more copy. */
function ReportTypeIcon({ type }: { type: ReportTypeValue | "BREAKDOWN" }) {
  const paths =
    type === "BREAKDOWN" ? (
      <>
        <circle cx="8" cy="7" r="3" />
        <circle cx="17" cy="9" r="2" />
        <path d="M2 21v-3a6 6 0 0 1 12 0v3m2-7a5 5 0 0 1 6 5v2" />
      </>
    ) : type === "CREATIVE" ? (
      <>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8" cy="8" r="2" />
        <path d="m3 18 6-6 4 4 3-3 5 5" />
      </>
    ) : type === "COMPARISON" ? (
      <>
        <path d="M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4" />
      </>
    ) : type === "DAY_BREAKDOWN" ? (
      <>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 8h8M8 12h8M8 16h4" />
      </>
    ) : type === "MONTHLY" ? (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M7 3v4m10-4v4M3 11h18M7 15h2m3 0h2m3 0h1M7 18h2m3 0h2" />
      </>
    ) : (
      <>
        <path d="M4 20h16M7 16v-5m5 5V5m5 11V8" />
        <path d="m5 7 5-4 5 2 4-3" />
      </>
    );
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
      aria-hidden="true"
    >
      {paths}
    </svg>
  );
}

export function WizardReportSetupPanel({
  reportType,
  platform,
  reportTypeLabel,
  clientTimezone,
  onReportTypeChange,
  source = "csv",
  variant = "full",
  onEditSetup,
  reportSelection,
  onReportSelectionChange,
}: {
  reportSelection?: MetaReportSelection | null;
  onReportSelectionChange?: (next: MetaReportSelection) => void;
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
  const selectedCopy =
    wizardReportTypeCopyForLocale(locale, reportType) ??
    WIZARD_REPORT_TYPE_COPY[reportType];
  const requirement = wizardCsvRequirementForReportType({
    reportType,
    clientTimezone,
  });

  if (variant === "summary") {
    return (
      <div className="rounded-lg border border-dash-border bg-dash-card px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[13px] text-dash-ink-secondary">Report setup</p>
            <p className="text-[15px] font-semibold text-dash-ink">
              {reportTypeLabel}
            </p>
          </div>
          {onEditSetup && (
            <button
              type="button"
              onClick={onEditSetup}
              className="text-[14px] font-medium text-dash-accent hover:underline"
            >
              Change on Import →
            </button>
          )}
        </div>
      </div>
    );
  }

  const selectedType =
    reportType === "HISTORICAL"
      ? "MONTHLY"
      : reportType === "DAILY"
        ? "DAY_BREAKDOWN"
        : reportType;
  const choices = [
    ...LAUNCH_PRIMARY_REPORT_TYPES,
    ...LAUNCH_SECONDARY_REPORT_TYPES,
    ...(platform === "META" && onReportSelectionChange
      ? (["BREAKDOWN", "CREATIVE"] as const)
      : []),
  ];
  const labels: Partial<Record<ReportTypeValue | "BREAKDOWN", string>> = {
    WEEKLY: "Weekly",
    MONTHLY: "Monthly",
    COMPARISON: "Compare",
    DAY_BREAKDOWN: "Daily",
    BREAKDOWN: "Breakdown",
    CREATIVE: "Creative",
  };
  const iconColors: Partial<Record<ReportTypeValue | "BREAKDOWN", string>> = {
    WEEKLY: "text-sky-400",
    MONTHLY: "text-violet-400",
    COMPARISON: "text-teal-400",
    DAY_BREAKDOWN: "text-rose-400",
    BREAKDOWN: "text-emerald-400",
    CREATIVE: "text-amber-400",
  };
  return (
    <section className="rounded-xl border border-dash-border bg-dash-bg/30 p-4 sm:p-5">
      <fieldset>
        <legend className="text-sm font-semibold text-dash-ink">
          Report type
        </legend>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {choices.map((type) => {
            const special = type === "BREAKDOWN" || type === "CREATIVE";
            const copy = special
              ? null
              : (wizardReportTypeCopyForLocale(locale, type) ??
                WIZARD_REPORT_TYPE_COPY[type]);
            return (
              <label key={type} className="min-w-0 cursor-pointer">
                <input
                  type="radio"
                  name={choicesId}
                  value={type}
                  checked={
                    reportSelection
                      ? reportSelection.kind === type
                      : selectedType === type
                  }
                  onChange={() => {
                    if (type === "BREAKDOWN")
                      onReportSelectionChange?.({
                        kind: "BREAKDOWN",
                        dimension: "age",
                      });
                    else if (type === "CREATIVE")
                      onReportSelectionChange?.({ kind: "CREATIVE" });
                    else onReportTypeChange(type);
                  }}
                  className="peer sr-only"
                />
                <span className="flex min-h-14 items-center justify-center gap-2 rounded-lg border border-dash-border bg-dash-card px-2 py-3 text-sm font-medium text-dash-ink-secondary transition-colors hover:border-dash-accent/50 peer-checked:border-dash-accent peer-checked:bg-dash-accent/10 peer-checked:text-dash-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-dash-accent">
                  <span
                    className={`shrink-0 ${iconColors[type] ?? "text-sky-400"}`}
                  >
                    <ReportTypeIcon type={type} />
                  </span>
                  <span className="flex flex-wrap items-center justify-center gap-1.5">
                    {special
                      ? labels[type]
                      : locale === "en"
                        ? (labels[type] ?? copy!.cardHeading)
                        : copy!.cardHeading}
                    {type === "CREATIVE" && (
                      <span className="rounded-full border border-dash-accent/40 bg-dash-accent/10 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-dash-accent">
                        Beta
                      </span>
                    )}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
      {reportSelection?.kind === "BREAKDOWN" && (
        <fieldset className="mt-4">
          <legend className="text-sm font-medium text-dash-ink">
            Breakdown by
          </legend>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(
              [
                ["age", "Age"],
                ["placement", "Placement"],
                ["location", "Location"],
                ["platform", "Platform"],
              ] as const
            ).map(([dimension, label]) => (
              <label
                key={dimension}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${reportSelection.dimension === dimension ? "border-dash-accent bg-dash-accent/10 text-dash-ink" : "border-dash-border text-dash-ink-secondary"}`}
              >
                <input
                  type="radio"
                  name={`${choicesId}-dimension`}
                  checked={reportSelection.dimension === dimension}
                  onChange={() =>
                    onReportSelectionChange?.({ kind: "BREAKDOWN", dimension })
                  }
                  className="accent-accent"
                />
                {label}
              </label>
            ))}
          </div>
          {reportSelection.dimension === "location" && (
            <label className="mt-3 block text-xs text-dash-ink-secondary">
              Location detail
              <select
                value={reportSelection.locationLevel ?? "region"}
                onChange={(event) =>
                  onReportSelectionChange?.({
                    ...reportSelection,
                    locationLevel: event.target.value as "region" | "country",
                  })
                }
                className="ml-2 rounded border border-dash-border bg-dash-card px-2 py-1 text-dash-ink"
              >
                <option value="region">Region / state</option>
                <option value="country">Country</option>
              </select>
            </label>
          )}
        </fieldset>
      )}
      <dl className="mt-4 space-y-3 text-sm">
        <div>
          <dt className="font-medium text-dash-ink">What you get</dt>
          <dd className="mt-0.5 text-dash-ink-secondary">
            {reportSelection
              ? reportSelection.kind === "CREATIVE"
                ? "Ad performance, objective-based rankings and available creative previews."
                : `Campaign performance by ${reportSelection.dimension}.`
              : reportType === "WEEKLY" && locale === "en"
                ? "Last 7 days’ performance, month-to-date totals and a 30-day chart."
                : selectedCopy.cardOneLiner}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-dash-ink">
            {source === "api" ? "Data needed" : "CSV needed"}
          </dt>
          <dd className="mt-0.5 text-dash-ink-secondary">
            {source === "api"
              ? "Fetched automatically for your selected report dates."
              : reportSelection
                ? metaReportRequirement(reportSelection)
                : requirement.shortNote}
          </dd>
        </div>
      </dl>
      {reportSelection?.kind === "CREATIVE" && (
        <p className="mt-2 text-xs text-dash-ink-secondary">
          {source === "api"
            ? "Images are fetched where available; videos use poster images."
            : "CSV reports work without images. Add images by Ad ID before generating, if needed."}
        </p>
      )}
    </section>
  );
}
