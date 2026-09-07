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

/** Meta and TikTok share the full 5-step ad wizard (campaigns → objectives → metrics → generate). */
export function usesFullAdWizard(platform: Platform): boolean {
  return platform === "META" || platform === "TIKTOK";
}

/** Google uses a simplified 2-step flow (upload → generate). */
export function usesSimpleAdWizard(platform: Platform): boolean {
  return platform === "GOOGLE";
}

export type AdWizardFlow = "full" | "simple";

export function getAdWizardFlow(platform: Platform): AdWizardFlow {
  return usesSimpleAdWizard(platform) ? "simple" : "full";
}

/** Step indicator labels — Google shows Upload → Generate only. */
export function getVisibleWizardSteps(flow: AdWizardFlow): Array<1 | 2 | 3 | 4 | 5> {
  return flow === "simple" ? [1, 5] : [1, 2, 3, 4, 5];
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
  if (usesSimpleAdWizard(platform)) {
    return step === 1 ? "Add your Google Ads data" : "Review and generate";
  }
  const headings: Record<1 | 2 | 3 | 4 | 5, string> = {
    1: "Add your ad data",
    2: platform === "TIKTOK" ? "Select campaigns & ad groups" : "Select campaigns",
    3: "Confirm objectives",
    4: "Review metric cards",
    5: "Choose report type and generate",
  };
  return headings[step];
}

/** Optional one-line hint under the step heading — kept minimal to reduce clutter. */
export function getWizardStepSubtitle(step: 1 | 2 | 3 | 4 | 5, platform: Platform): string {
  if (usesSimpleAdWizard(platform)) {
    return step === 1 ? "API sync or CSV upload." : "";
  }
  if (step === 5) return "Pick a report type, then generate.";
  return "";
}
