/**
 * Canonical Meta manual-export counting — same rules Ads Manager uses for period
 * totals and what agencies sum in Excel: **Results** on rows where **Result type**
 * matches the objective. Blank Result type + blank Results = **0 leads** for that
 * day, even if optional columns (Meta leads, Leads, Website leads) show numbers.
 *
 * All report math (slides, MTD, chart, CPL) must go through these helpers — never
 * sum Leads/Meta leads columns when Result type and Results are empty.
 */

import type { MetricRow } from "./types";
import { parseCellNum } from "./format";
import { getMetaResultLabels } from "./meta-objective-dictionary";

/** Ads Manager period totals: Results for the row's Result type; ignore orphan Meta leads. */
export function metaFormLeadsFromMetaExportRow(
  row: Pick<MetricRow, "results" | "leads" | "meta_leads" | "result_type">,
): number {
  const results = parseCellNum(row.results);
  if (results > 0) return results;
  const rt = (row.result_type || "").trim();
  if (!rt) return 0;
  if (getMetaResultLabels(rt).resultLabel !== "META FORM LEADS") return 0;
  return parseCellNum(row.meta_leads) || parseCellNum(row.leads) || 0;
}

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
    if (campaignObjectiveLabel === "WEBSITE LEADS") return websiteLeadsFromMetaExportRow(row);
    if (campaignObjectiveLabel === "META FORM LEADS") return metaFormLeadsFromMetaExportRow(row);
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
    return websiteLeadsFromMetaExportRow(row);
  }

  if (campaignObjectiveLabel === "META FORM LEADS") {
    return metaFormLeadsFromMetaExportRow(row);
  }

  if (campaignObjectiveLabel === "PURCHASES") {
    const purchases = parseCellNum(row.purchases);
    if (purchases > 0) return purchases;
    return rtLabel === "PURCHASES" ? results : 0;
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
