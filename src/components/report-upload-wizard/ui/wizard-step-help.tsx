"use client";

import type { Platform } from "@/lib/nre/google-columns";
import { getPlatformLabel } from "@/lib/nre/platform-labels";
import { getMetaCsvDownloadTip } from "@/lib/nre/csv-date-guidance";

type WizardHelpStep = 1 | 2 | 3;

/** Only `/help/download` is published today — other help paths redirect here. */
const HELP_DOWNLOAD = "https://nextreport.in/help/download";

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
              href={HELP_DOWNLOAD}
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
        </ul>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="rounded-lg border border-dash-border bg-[#0d1b2e]/50 px-4 py-3 text-[13px] leading-relaxed text-dash-ink-secondary">
        <p className="font-medium text-dash-ink">Campaigns & objectives</p>
        <p className="mt-1">
          Choose which campaigns go in the deck, then confirm what each one counts as a result (quotes, leads, purchases,
          and so on).
        </p>
        <p className="mt-2">
          <a href={HELP_DOWNLOAD} target="_blank" rel="noopener noreferrer" className="text-dash-accent hover:underline">
            How we pick objectives from your CSV
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-dash-border bg-[#0d1b2e]/50 px-4 py-3 text-[13px] leading-relaxed text-dash-ink-secondary">
      <p className="font-medium text-dash-ink">About the metric chips</p>
      <p className="mt-1">
        We pre-fill the numbers that show on each campaign slide from your export. Remove anything you don&apos;t want
        clients to see, or tap <span className="text-dash-ink">+</span> to add extra columns from the file. Aim for at
        least four metrics per campaign when your CSV has them.
      </p>
      <p className="mt-2">
        <a href={HELP_DOWNLOAD} target="_blank" rel="noopener noreferrer" className="text-dash-accent hover:underline">
          CSV columns & metrics guide
        </a>
      </p>
    </div>
  );
}
