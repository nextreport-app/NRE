"use client";

import Link from "next/link";
import type { Platform } from "@/lib/nre/google-columns";
import { getPlatformLabel } from "@/lib/nre/platform-labels";
import { wizardExportGuidanceForReportType } from "@/lib/nre/wizard-report-export-guidance";
import { WizardMetaCsvImportTooltip } from "./wizard-meta-csv-export-help";
import { MetaAdsReportingLink } from "@/components/meta-ads-reporting-link";
import type { ReportTypeValue } from "../types";

/** Shown on Import just above CSV upload / API sync — right before the user adds data. */
export function WizardImportDownloadInstructions({
  reportType,
  platform,
  clientTimezone,
}: {
  reportType: ReportTypeValue;
  platform: Platform;
  clientTimezone: string;
}) {
  const guidance = wizardExportGuidanceForReportType({
    reportType,
    platform,
    clientTimezone,
  });
  const platformLabel = getPlatformLabel(platform);

  return (
    <section
      className="space-y-3 text-[13px] leading-relaxed text-dash-ink-secondary"
      aria-labelledby="wizard-download-instructions-heading"
    >
      <div
        className="rounded-lg border border-[#63b3ed]/30 nre-wizard-panel px-4 py-3"
        aria-labelledby="wizard-download-instructions-heading"
      >
      <h4 id="wizard-download-instructions-heading" className="flex flex-wrap items-center text-[14px] font-semibold text-dash-ink">
        Download instructions
        {platform === "META" ? <WizardMetaCsvImportTooltip /> : null}
      </h4>
      {platform === "META" ? (
        <p className="mt-2">
          <MetaAdsReportingLink variant="button">Meta Ads Reporting Section →</MetaAdsReportingLink>
        </p>
      ) : null}
      <ul className="mt-2 list-inside list-disc space-y-1">
        {guidance.lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="mt-3">
        <Link href="/help/download" target="_blank" rel="noopener noreferrer" className="text-dash-accent hover:underline">
          How to download your {platformLabel} CSV
        </Link>
      </p>
      </div>
    </section>
  );
}
