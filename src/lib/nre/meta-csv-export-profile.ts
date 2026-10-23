import type { ColumnMap, NreRow } from "./columns";
import { csvHasDailyGranularity, hasReportingStartsEndsDailyRow } from "./columns";
import { syntheticResultTypeFromMetaResultIndicator } from "./meta-result-indicator";

export type MetaCsvExportKind = "ads_reporting" | "campaigns_table";

export interface MetaCsvExportProfile {
  kind: MetaCsvExportKind;
  /** True when the file includes named ad sets (Ads Reporting export). */
  includesAdSetBreakdown: boolean;
  hasWebsiteSubmissionColumn: boolean;
  hasResultIndicatorColumn: boolean;
}

function headerSet(headers: string[] | undefined, colMap: ColumnMap): Set<string> {
  const set = new Set<string>();
  if (headers) {
    headers.forEach((h) => {
      const t = String(h ?? "").trim().toLowerCase();
      if (t) set.add(t);
    });
  }
  if (colMap.website_leads) set.add(colMap.website_leads.toLowerCase());
  return set;
}

export function rowsIncludeNamedAdSets(rows: NreRow[]): boolean {
  return rows.some((r) => String(r.ad_set_name ?? "").trim().length > 0);
}

/** Classify Meta manual CSV — Ads Reporting vs Campaigns screen (Breakdown: Day). */
export function detectMetaCsvExportProfile(
  colMap: ColumnMap,
  rows: NreRow[],
  headers?: string[],
): MetaCsvExportProfile {
  const h = headerSet(headers, colMap);
  const hasWebsiteSubmissionColumn =
    !!colMap.website_leads ||
    [...h].some((x) => x.includes("website submission") && !x.includes("cost per"));
  const hasResultIndicatorColumn =
    [...h].some((x) => x === "result indicator") || rows.some((r) => {
      const raw = r._raw ?? {};
      return String(raw["Result indicator"] ?? "").trim().length > 0;
    });
  const includesAdSetBreakdown = !!colMap.ad_set_name && rowsIncludeNamedAdSets(rows);
  const campaignsTableSignals =
    !includesAdSetBreakdown &&
    csvHasDailyGranularity(rows) &&
    (rows.some(hasReportingStartsEndsDailyRow) ||
      [...h].some((x) => x.includes("campaign delivery")) ||
      hasResultIndicatorColumn);

  const kind: MetaCsvExportKind = campaignsTableSignals ? "campaigns_table" : "ads_reporting";

  return {
    kind,
    includesAdSetBreakdown,
    hasWebsiteSubmissionColumn,
    hasResultIndicatorColumn,
  };
}

/** One-line import hint — campaign-level export only. */
export function metaCsvExportImportHint(profile: MetaCsvExportProfile): string | null {
  if (profile.kind !== "campaigns_table") return null;
  return "Campaign-level CSV — campaign slides only. Confirm objectives on the next step.";
}

/** Campaigns step when ad set slides are impossible for this file. */
export const META_CAMPAIGNS_TABLE_ADSET_SKIP_HINT =
  "No ad set column in this file — ad set slides won’t be included. Download the CSV from Ad Reporting to include ad set slides as well.";

function resultTypeFromCampaignsTableIndicator(indicator: string): string | null {
  return syntheticResultTypeFromMetaResultIndicator(indicator);
}

/**
 * Campaigns-table rows often omit Result type; fill from Result indicator or
 * website submission column so counting matches Ads Reporting exports.
 */
export function enrichMetaCampaignsTableRows(rows: NreRow[], profile: MetaCsvExportProfile): void {
  if (profile.kind !== "campaigns_table") return;
  for (const row of rows) {
    if ((row.result_type ?? "").trim()) continue;
    const raw = row._raw ?? {};
    const indicator = String(raw["Result indicator"] ?? raw["result indicator"] ?? "").trim();
    const fromIndicator = indicator ? resultTypeFromCampaignsTableIndicator(indicator) : null;
    if (fromIndicator) {
      row.result_type = fromIndicator;
      continue;
    }
    const wl = String(row.website_leads ?? raw["website submission"] ?? "").trim();
    if (wl && Number(wl) > 0 && !String(row.results ?? "").trim()) {
      row.result_type = "website submission";
    }
  }
}
