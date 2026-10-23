/**
 * Meta Campaigns-table CSV exports put API action ids in "Result indicator"
 * (e.g. actions:offsite_conversion.custom.871123778777517) instead of the
 * human "Result type" column Ads Reporting includes. Numeric custom conversion
 * ids are account-specific; map known ids to the same synthetic result_type
 * strings we use for Ads Reporting so objectives match (Quote Request Submitted
 * → QUOTE REQUESTS, website submission → WEBSITE LEADS, etc.).
 */

const CUSTOM_ID =
  /^actions:offsite_conversion\.custom\.(\d+)$/i;

/** Validated against Ad Reporting / API for the same account — add ids as we confirm them. */
export const KNOWN_META_CUSTOM_CONVERSION_RESULT_TYPE: Readonly<Record<string, string>> = {
  /** BumperTech — matches Ad Reporting "Quote Request Submitted" on Website Retargeting campaigns. */
  "871123778777517": "Quote Request Submitted",
};

/**
 * Synthetic Result type text for counting/objective detection (matches Ads Reporting labels).
 */
export function syntheticResultTypeFromMetaResultIndicator(indicator: string): string | null {
  const trimmed = indicator.trim();
  if (!trimmed) return null;
  const core = trimmed.replace(/^actions:/i, "");

  const custom = CUSTOM_ID.exec(trimmed);
  if (custom) {
    const known = KNOWN_META_CUSTOM_CONVERSION_RESULT_TYPE[custom[1]];
    if (known) return known;
    return "website submission";
  }

  if (/offsite_conversion\.custom\./i.test(core)) {
    const idMatch = /offsite_conversion\.custom\.(\d+)/i.exec(core);
    if (idMatch) {
      const known = KNOWN_META_CUSTOM_CONVERSION_RESULT_TYPE[idMatch[1]];
      if (known) return known;
    }
    return "website submission";
  }
  if (/offsite_conversion\.fb_pixel_lead/i.test(core)) return "website submission";
  if (/offsite_conversion\.fb_pixel_submit_application/i.test(core)) return "Website applications submitted";
  if (/onsite_conversion\.lead_grouped/i.test(core)) return "Leads (form)";
  if (/link_click/i.test(core)) return "Link clicks";
  if (/landing_page_view/i.test(core)) return "Landing page view";
  return null;
}

/** Wizard-friendly label for Result indicator rows (not the raw action id). */
export function displayResultIndicatorLabel(indicatorOrSynthetic: string): string {
  const trimmed = indicatorOrSynthetic.trim();
  if (/^actions:offsite_conversion\.custom\./i.test(trimmed)) {
    const idMatch = /offsite_conversion\.custom\.(\d+)/i.exec(trimmed.replace(/^actions:/i, ""));
    const id = idMatch?.[1];
    const known = id ? KNOWN_META_CUSTOM_CONVERSION_RESULT_TYPE[id] : undefined;
    if (known) return known;
    return "website submission (custom conversion)";
  }
  return trimmed.replace(/^actions:/i, "");
}
