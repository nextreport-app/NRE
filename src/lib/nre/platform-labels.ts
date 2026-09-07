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
    2: platform === "TIKTOK" ? "Select campaigns & ad groups" : "Select Campaigns",
    3: "Confirm Objectives",
    4: "Review Metric Cards",
    5: "Choose report type and generate",
  };
  return headings[step];
}

export function getWizardStepSubtitle(step: 1 | 2 | 3 | 4 | 5, platform: Platform): string {
  if (usesSimpleAdWizard(platform)) {
    if (step === 1) {
      return "Connect via Google Ads API or upload a Last 30 Days CSV segmented by Day.";
    }
    return "Google Ads reports include every campaign in your file with month-to-date totals — no campaign picker needed.";
  }

  const subtitles: Record<1 | 2 | 3 | 4 | 5, string> = {
    1:
      platform === "TIKTOK"
        ? "Connect via TikTok Marketing API or upload a CSV — USD reporting. The tip below shows the correct export format."
        : "Connect via official API or upload a CSV — the tip below shows the correct date range for today.",
    2:
      platform === "TIKTOK"
        ? "Unchecked campaigns stay out of the deck. TikTok ad groups appear as ad-set slides — campaign totals still include them."
        : "Unchecked campaigns stay out of the deck. Ad-set slides are extra; campaign totals still include them.",
    3:
      platform === "TIKTOK"
        ? "Same objective engine as Meta — confirm what each campaign optimized for so the right metric cards appear."
        : "Wrong objective means wrong cards and Combined Total. Fix it here.",
    4: "These chips become the PPT cards. Remove or add; extras come only from this CSV.",
    5: "Pick a report type, set dates if needed, review the summary, then generate.",
  };
  return subtitles[step];
}
