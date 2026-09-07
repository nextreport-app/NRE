import type { Platform } from "@/lib/nre/google-columns";
import { getPlatformLabel, usesSimpleAdWizard } from "@/lib/nre/platform-labels";

export function WizardPlatformSummaryLabel({ platform }: { platform: Platform }) {
  return <span className="text-[15px] text-white">{getPlatformLabel(platform)}</span>;
}

/** Shown on Step 5 for Google — one line only. */
export function WizardGoogleGenerateBanner() {
  return (
    <div className="rounded-lg border border-dash-border bg-dash-card p-4">
      <p className="text-[16px] text-dash-ink-secondary">All campaigns in your file are included — generate when ready.</p>
    </div>
  );
}
