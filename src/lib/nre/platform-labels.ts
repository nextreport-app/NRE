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

/** Meta, Google, and TikTok share the full 4-step ad wizard (campaigns + objectives → metrics → generate). */
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

/** Step indicator labels for the full 4-step ad wizard. */
export function getVisibleWizardSteps(_flow: AdWizardFlow): Array<1 | 2 | 3 | 4> {
  return [1, 2, 3, 4];
}

export function getWizardStepLabel(step: 1 | 2 | 3 | 4, flow: AdWizardFlow): string {
  if (flow === "simple") {
    return step === 1 ? "Upload" : "Generate";
  }
  const labels: Record<1 | 2 | 3 | 4, string> = {
    1: "Upload",
    2: "Setup",
    3: "Metrics",
    4: "Generate",
  };
  return labels[step];
}

export function getWizardStepHeading(step: 1 | 2 | 3 | 4, platform: Platform): string {
  const headings: Record<1 | 2 | 3 | 4, string> = {
    1: platform === "GOOGLE" ? "Add your Google Ads data" : "Add your ad data",
    2:
      platform === "TIKTOK" || platform === "GOOGLE"
        ? "Select campaigns, ad groups & objectives"
        : "Select campaigns & confirm objectives",
    3: "Review metric cards",
    4: "Choose report type and generate",
  };
  return headings[step];
}

/** Optional one-line hint under the step heading — kept minimal to reduce clutter. */
export function getWizardStepSubtitle(step: 1 | 2 | 3 | 4, _platform: Platform): string {
  if (step === 4) return "Pick a report type, then generate.";
  if (step === 2) return "Pick campaigns first, then confirm objectives below.";
  return "";
}
