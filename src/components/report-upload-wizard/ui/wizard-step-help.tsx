"use client";

import Link from "next/link";
import type { Platform } from "@/lib/nre/google-columns";
import { getPlatformLabel } from "@/lib/nre/platform-labels";
import { getMetaCsvDownloadTip } from "@/lib/nre/csv-date-guidance";

type WizardHelpStep = 1 | 2 | 3;

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
            <Link href="/help/download" target="_blank" rel="noopener noreferrer" className="text-dash-accent hover:underline">
              How to download your {platformLabel} CSV
            </Link>
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
        <p className="mt-1">Pick campaigns for the deck and confirm each one&apos;s main result (leads, quotes, etc.).</p>
        <p className="mt-2">
          <Link href="/help/objectives" target="_blank" rel="noopener noreferrer" className="text-dash-accent hover:underline">
            How we pick objectives from your CSV
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-dash-border bg-[#0d1b2e]/50 px-4 py-3 text-[13px] leading-relaxed text-dash-ink-secondary">
      <p className="font-medium text-dash-ink">Metric chips</p>
      <p className="mt-1">Pre-filled from your CSV. Remove chips or tap + to adjust.</p>
      <p className="mt-2">
        <Link href="/help/metrics" target="_blank" rel="noopener noreferrer" className="text-dash-accent hover:underline">
          Metrics guide
        </Link>
      </p>
    </div>
  );
}
