/**
 * Independent result counting — mirrors summing Meta Ads Manager export columns
 * (primarily Results + Result type), used for CSV verification and optional
 * align-with-export report mode.
 */

import type { MetricRow } from "./types";
import { parseCellNum } from "./format";
import { getMetaResultLabels } from "./meta-objective-dictionary";

/** Count one row toward a campaign's assigned objective using export-style rules. */
export function metaCsvExportResultValue(row: MetricRow, campaignObjectiveLabel: string): number {
  const results = parseCellNum(row.results);
  const rtLabel = getMetaResultLabels(row.result_type).resultLabel;

  if (rtLabel === campaignObjectiveLabel) {
    return results;
  }

  if (campaignObjectiveLabel === "LINK CLICKS") {
    const clicks = parseCellNum(row.link_clicks);
    if (clicks > 0) return clicks;
    return rtLabel === "LINK CLICKS" ? results : 0;
  }

  if (campaignObjectiveLabel === "LANDING PAGE VIEWS") {
    const lpv = parseCellNum(row.landing_page_views);
    if (lpv > 0) return lpv;
    return rtLabel === "LANDING PAGE VIEWS" ? results : 0;
  }

  if (campaignObjectiveLabel === "WEBSITE LEADS") {
    if (rtLabel === "WEBSITE LEADS") {
      if (results > 0) return results;
      const wl = parseCellNum(row.website_leads);
      return wl > 0 ? wl : 0;
    }
    return 0;
  }

  if (campaignObjectiveLabel === "META FORM LEADS") {
    if (rtLabel === "META FORM LEADS") return results;
    return 0;
  }

  if (campaignObjectiveLabel === "REACH") {
    return parseCellNum(row.reach) || (rtLabel === "REACH" ? results : 0);
  }

  if (rtLabel && rtLabel !== "RESULTS" && rtLabel !== campaignObjectiveLabel) {
    return 0;
  }

  return results;
}

export type ResultCountingMode = "standard" | "meta-csv-export";
