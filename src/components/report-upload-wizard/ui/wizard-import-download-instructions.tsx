"use client";

import Link from "next/link";
import type { Platform } from "@/lib/nre/google-columns";
import { getPlatformLabel } from "@/lib/nre/platform-labels";
import { wizardExportGuidanceForReportType } from "@/lib/nre/wizard-report-export-guidance";
import { wizardCsvRequirementForReportType } from "@/lib/nre/wizard-report-csv-requirement";
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
  const csvReq =
    platform === "META" ? wizardCsvRequirementForReportType({ reportType, clientTimezone }) : null;
  const platformLabel = getPlatformLabel(platform);

  return (
    <section
      className="space-y-3 text-[13px] leading-relaxed text-dash-ink-secondary"
      aria-labelledby="wizard-download-instructions-heading"
    >
      <div
        className="rounded-lg border border-[#63b3ed]/30 bg-[#0d1b2e]/50 px-4 py-3"
        aria-labelledby="wizard-download-instructions-heading"
      >
      <h4 id="wizard-download-instructions-heading" className="flex flex-wrap items-center text-[14px] font-semibold text-white">
        Download instructions
        {platform === "META" ? <WizardMetaCsvImportTooltip /> : null}
      </h4>
      {csvReq ? (
        <p className="mt-2 rounded-md border border-amber-800/40 bg-amber-950/25 px-3 py-2 text-[12px] leading-relaxed text-amber-100/95">
          <span className="font-semibold text-amber-200">Required for this report:</span> {csvReq.shortNote}.{" "}
          {csvReq.detail}
        </p>
      ) : null}
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
