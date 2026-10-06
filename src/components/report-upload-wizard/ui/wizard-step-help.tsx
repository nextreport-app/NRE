"use client";

import type { Platform } from "@/lib/nre/google-columns";
import { getPlatformLabel } from "@/lib/nre/platform-labels";
import { getMetaCsvDownloadTip } from "@/lib/nre/csv-date-guidance";

type WizardHelpStep = 1 | 2 | 3;

const HELP_BASE = "https://nextreport.in/help";

export function WizardStepHelp({
  step,
  platform,
  clientTimezone,
}: {
  step: WizardHelpStep;
  platform: Platform;
  clientTimezone: string;
}) {
  const platformLabel = getPlatformLabel(platform);

  if (step === 1) {
    return (
      <div className="rounded-lg border border-dash-border bg-[#0d1b2e]/50 px-4 py-3 text-[13px] leading-relaxed text-dash-ink-secondary">
        <p className="font-medium text-dash-ink">Need help with this step?</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>
            <a
              href={`${HELP_BASE}/download`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-dash-accent hover:underline"
            >
              How to download your {platformLabel} CSV
            </a>
          </li>
          {platform === "META" ? (
            <li className="text-dash-ink-muted">{getMetaCsvDownloadTip(new Date(), clientTimezone)}</li>
          ) : null}
          <li>
            <a href={`${HELP_BASE}/api-sync`} target="_blank" rel="noopener noreferrer" className="text-dash-accent hover:underline">
              API sync vs manual CSV
            </a>
          </li>
        </ul>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="rounded-lg border border-dash-border bg-[#0d1b2e]/50 px-4 py-3 text-[13px] leading-relaxed text-dash-ink-secondary">
        <p className="font-medium text-dash-ink">Campaigns & objectives</p>
        <p className="mt-1">
          Pick the campaigns that belong in this deck. Confirm each campaign&apos;s primary result (quotes, leads, purchases,
          etc.) — the report and CSV verification use these labels.
        </p>
        <p className="mt-2">
          <a href={`${HELP_BASE}/objectives`} target="_blank" rel="noopener noreferrer" className="text-dash-accent hover:underline">
            How we detect objectives
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-dash-border bg-[#0d1b2e]/50 px-4 py-3 text-[13px] leading-relaxed text-dash-ink-secondary">
      <p className="font-medium text-dash-ink">Metric cards</p>
      <p className="mt-1">
        Chips are pre-filled from your export. Remove extras you don&apos;t want on slides, or add columns from the CSV. You
        need at least four metrics per campaign when possible.
      </p>
      <p className="mt-2">
        <a href={`${HELP_BASE}/metrics`} target="_blank" rel="noopener noreferrer" className="text-dash-accent hover:underline">
          Which metrics appear on slides
        </a>
      </p>
    </div>
  );
}
