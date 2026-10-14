/**
 * Independent result counting — mirrors summing Meta Ads Manager export columns
 * (primarily Results + Result type), used for CSV verification and optional
 * align-with-export report mode.
 */

import type { MetricRow } from "./types";
import { parseCellNum } from "./format";
import { getMetaResultLabels } from "./meta-objective-dictionary";

/** Ads Manager period totals: Results for the row's Result type; ignore orphan Website leads. */
export function websiteLeadsFromMetaExportRow(
  row: Pick<MetricRow, "results" | "website_leads" | "result_type">,
): number {
  const results = parseCellNum(row.results);
  if (results > 0) return results;
  const wl = parseCellNum(row.website_leads);
  if (wl <= 0) return 0;
  const rt = (row.result_type || "").trim();
  if (!rt) return 0;
  if (getMetaResultLabels(rt).resultLabel === "WEBSITE LEADS") return wl;
  return 0;
}

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
    if (
      rtLabel === "WEBSITE LEADS" ||
      rtLabel === "WEBSITE SUBMIT APPLICATIONS" ||
      rtLabel === "APPLICATIONS"
    ) {
      return websiteLeadsFromMetaExportRow(row);
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
