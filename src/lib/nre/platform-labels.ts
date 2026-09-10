import type { Platform } from "./google-columns";

/** Human-readable platform name for UI copy. */
export function getPlatformLabel(platform: Platform): string {
  switch (platform) {
    case "GOOGLE":
      return "Google Ads";
    case "TIKTOK":
      return "TikTok Ads";
    default:
      return "Meta Ads";
  }
}

/** Meta, Google, and TikTok share the full 5-step ad wizard (campaigns → objectives → metrics → generate). */
export function usesFullAdWizard(platform: Platform): boolean {
  return platform === "META" || platform === "GOOGLE" || platform === "TIKTOK";
}

/** Reserved for future simplified flows — all ad platforms use the full wizard today. */
export function usesSimpleAdWizard(platform: Platform): boolean {
  return false;
}

export type AdWizardFlow = "full" | "simple";

export function getAdWizardFlow(platform: Platform): AdWizardFlow {
  return usesSimpleAdWizard(platform) ? "simple" : "full";
}

/** Step indicator labels for the full 5-step ad wizard. */
export function getVisibleWizardSteps(_flow: AdWizardFlow): Array<1 | 2 | 3 | 4 | 5> {
  return [1, 2, 3, 4, 5];
}

export function getWizardStepLabel(step: 1 | 2 | 3 | 4 | 5, flow: AdWizardFlow): string {
  if (flow === "simple") {
    return step === 1 ? "Upload" : "Generate";
  }
  const labels: Record<1 | 2 | 3 | 4 | 5, string> = {
    1: "Upload",
    2: "Campaigns",
    3: "Objectives",
    4: "Metrics",
    5: "Generate",
  };
  return labels[step];
}

export function getWizardStepHeading(step: 1 | 2 | 3 | 4 | 5, platform: Platform): string {
  const headings: Record<1 | 2 | 3 | 4 | 5, string> = {
    1: platform === "GOOGLE" ? "Add your Google Ads data" : "Add your ad data",
    2:
      platform === "TIKTOK" || platform === "GOOGLE"
        ? "Select campaigns & ad groups"
        : "Select campaigns",
    3: "Confirm objectives",
    4: "Review metric cards",
    5: "Choose report type and generate",
  };
  return headings[step];
}

/** Optional one-line hint under the step heading — kept minimal to reduce clutter. */
export function getWizardStepSubtitle(step: 1 | 2 | 3 | 4 | 5, _platform: Platform): string {
  if (step === 5) return "Pick a report type, then generate.";
  return "";
}
