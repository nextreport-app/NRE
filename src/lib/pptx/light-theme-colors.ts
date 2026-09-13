/**
 * Readable text colors for the light .pptx template and from-scratch light slides.
 * Headings and body copy use dark navy/slate — not amber — for contrast on cream/white surfaces.
 */

/** Primary body text on light backgrounds. */
export const LIGHT_INK = "0d1b2e";

/** Secondary labels, captions, muted lines. */
export const LIGHT_INK_MUTED = "475569";

/** Slide titles and section headings. */
export const LIGHT_HEADING = "0d1b2e";

/** Campaign / ad-set type badges on light slides — slate, not amber. */
export const LIGHT_CAMPAIGN_LABEL = "334155";

/** Ad-set badge on light slides. */
export const LIGHT_AD_SET_LABEL = "1d4ed8";

/** Report-type chrome line ("YOUR WEEKLY PERFORMANCE REPORT", table/chart titles). */
export const LIGHT_REPORT_HEADER = "0d1b2e";

export function reportHeaderColor(isLightTemplate: boolean): string {
  return isLightTemplate ? LIGHT_REPORT_HEADER : "94a3b8";
}

export function campaignTypeLabelColor(
  isLightTemplate: boolean,
  kind: "campaign" | "adset" | "monthTotal",
): string {
  if (!isLightTemplate) {
    if (kind === "monthTotal") return "38bdf8";
    if (kind === "adset") return "63b3ed";
    return "f6ad55";
  }
  if (kind === "monthTotal") return "0369a1";
  if (kind === "adset") return LIGHT_AD_SET_LABEL;
  return LIGHT_CAMPAIGN_LABEL;
}
