"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import type { Platform } from "@/lib/nre/google-columns";
import { getPlatformLabel } from "@/lib/nre/platform-labels";
import { wizardExportGuidanceForReportType } from "@/lib/nre/wizard-report-export-guidance";
import {
  hasSeenImportDownloadInstructions,
  markImportDownloadInstructionsSeen,
} from "../wizard-download-instructions-storage";
import { WizardMetaCsvImportTooltip } from "./wizard-meta-csv-export-help";
import { MetaAdsReportingLink } from "@/components/meta-ads-reporting-link";
import type { ReportTypeValue } from "../types";

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
        clipRule="evenodd"
      />
    </svg>
  );
}

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
  const panelId = useId();
  const guidance = wizardExportGuidanceForReportType({
    reportType,
    platform,
    clientTimezone,
  });
  const platformLabel = getPlatformLabel(platform);

  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (hasSeenImportDownloadInstructions()) {
      setExpanded(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      markImportDownloadInstructionsSeen();
    };
  }, []);

  return (
    <section className="text-[13px] leading-relaxed text-dash-ink-secondary" aria-labelledby="wizard-download-instructions-heading">
      <div className="rounded-lg border border-[#63b3ed]/30 nre-wizard-panel px-4 py-3">
        <button
          type="button"
          id="wizard-download-instructions-heading"
          className="flex w-full items-center justify-between gap-2 text-left"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={() => setExpanded((open) => !open)}
        >
          <span className="flex min-w-0 flex-wrap items-center text-[14px] font-semibold text-dash-ink">
            Download instructions
            {platform === "META" ? <WizardMetaCsvImportTooltip /> : null}
          </span>
          <ChevronDownIcon
            className={`h-4 w-4 shrink-0 text-dash-ink-secondary transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </button>

        {expanded ? (
          <div id={panelId} className="mt-2 space-y-2">
            {platform === "META" ? (
              <p>
                <MetaAdsReportingLink variant="button">Meta Ads Reporting Section →</MetaAdsReportingLink>
              </p>
            ) : null}
            <ul className="list-inside list-disc space-y-1">
              {guidance.lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p className="pt-1">
              <Link href="/help/download" target="_blank" rel="noopener noreferrer" className="text-dash-accent hover:underline">
                How to download your {platformLabel} CSV
              </Link>
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
