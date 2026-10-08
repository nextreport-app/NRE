"use client";

import { useState } from "react";
import Link from "next/link";
import type { Platform } from "@/lib/nre/google-columns";
import { getPlatformLabel } from "@/lib/nre/platform-labels";
import { wizardExportGuidanceForReportType } from "@/lib/nre/wizard-report-export-guidance";
import type { ReportTypeValue } from "../types";
import { ReportTypeCard } from "./report-type-card";
import {
  LAUNCH_PRIMARY_REPORT_TYPES,
  LAUNCH_SECONDARY_REPORT_TYPES,
} from "@/lib/meta-launch-scope";

export function WizardReportSetupPanel({
  reportType,
  reportTypeLabel,
  platform,
  clientTimezone,
  onReportTypeChange,
  variant = "full",
}: {
  reportType: ReportTypeValue;
  reportTypeLabel: string;
  platform: Platform;
  clientTimezone: string;
  onReportTypeChange: (next: ReportTypeValue) => void;
  /** full = step 1 with export callout; summary = step 4 one-liner */
  variant?: "full" | "summary";
}) {
  const [moreOpen, setMoreOpen] = useState(() =>
    LAUNCH_SECONDARY_REPORT_TYPES.includes(reportType as (typeof LAUNCH_SECONDARY_REPORT_TYPES)[number]),
  );

  const guidance = wizardExportGuidanceForReportType({
    reportType,
    platform,
    clientTimezone,
  });
  const platformLabel = getPlatformLabel(platform);

  if (variant === "summary") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dash-border bg-dash-card px-4 py-3">
        <div>
          <p className="text-[13px] text-dash-ink-secondary">Report setup</p>
          <p className="text-[15px] font-semibold text-white">{reportTypeLabel}</p>
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-4 rounded-lg border border-dash-border border-l-4 border-l-dash-accent bg-dash-card p-5">
      <div>
        <h3 className="text-[16px] font-semibold text-white">What report are you building?</h3>
        <p className="mt-1 text-[13px] text-dash-ink-secondary">
          Choose the deck type first — export instructions below match your choice.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <ReportTypeCard
          icon="📊"
          heading="Weekly Performance Report"
          description="Weekly with MTD chart."
          selected={reportType === "WEEKLY"}
          onSelect={() => onReportTypeChange("WEEKLY")}
          layout="compact"
          recommended
        />
        <ReportTypeCard
          icon="📅"
          heading="Monthly Performance Report"
          description="Full month with MTD chart."
          selected={reportType === "MONTHLY"}
          onSelect={() => onReportTypeChange("MONTHLY")}
          layout="compact"
        />
        <ReportTypeCard
          icon="☀️"
          heading="Yesterday Performance Report"
          description="Latest complete day"
          selected={reportType === "DAILY"}
          onSelect={() => onReportTypeChange("DAILY")}
          layout="compact"
        />
      </div>

      <div>
        <button
          type="button"
          onClick={() => setMoreOpen((open) => !open)}
          className="flex w-full items-center justify-between rounded-md border border-dash-border bg-[#0d1b2e]/60 px-3 py-2.5 text-left text-[14px] font-medium text-dash-ink hover:bg-dash-border/40"
          aria-expanded={moreOpen}
        >
          <span>
            More report types
            {LAUNCH_SECONDARY_REPORT_TYPES.includes(
              reportType as (typeof LAUNCH_SECONDARY_REPORT_TYPES)[number],
            ) ? (
              <span className="ml-2 font-normal text-dash-accent">· {reportTypeLabel}</span>
            ) : null}
          </span>
          <span className="text-dash-ink-secondary">{moreOpen ? "▲" : "▼"}</span>
        </button>
        {moreOpen ? (
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <ReportTypeCard
              icon="🔀"
              heading="Comparison Report"
              description="Two periods side by side."
              selected={reportType === "COMPARISON"}
              onSelect={() => onReportTypeChange("COMPARISON")}
              layout="compact"
            />
            <ReportTypeCard
              icon="📆"
              heading="Multi-Month Historical Report"
              description="Several past months in one deck."
              selected={reportType === "HISTORICAL"}
              onSelect={() => onReportTypeChange("HISTORICAL")}
              layout="compact"
            />
            <ReportTypeCard
              icon="📋"
              heading="Daily Performance Report"
              description="Multiple days, one row per day"
              selected={reportType === "DAY_BREAKDOWN"}
              onSelect={() => onReportTypeChange("DAY_BREAKDOWN")}
              layout="compact"
            />
          </div>
        ) : null}
      </div>

      <div className="rounded-lg border border-[#63b3ed]/35 bg-[#0d1b2e]/80 px-4 py-3">
        <p className="text-[14px] font-semibold text-white">{guidance.headline}</p>
        <ul className="mt-2 list-inside list-disc space-y-1.5 text-[13px] leading-relaxed text-dash-ink-secondary">
          {guidance.bullets.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        {guidance.footnote ? (
          <p className="mt-2 text-[13px] font-medium text-[#f6ad55]">{guidance.footnote}</p>
        ) : null}
        <p className="mt-3 text-[13px]">
          <Link href="/help/download" target="_blank" rel="noopener noreferrer" className="text-dash-accent hover:underline">
            Full {platformLabel} CSV export guide →
          </Link>
        </p>
      </div>
    </section>
  );
}
