import type { ColumnMap, NreRow } from "./columns";
import {
  csvHasDailyGranularity,
  getRowDate,
  hasRealRowDate,
  hasReportingStartsEndsDailyRow,
} from "./columns";
import { parseDate } from "./dates";
import { toIsoDate } from "./date-range";
import { parseCellNum } from "./format";
import { normalizeCampaignName } from "./objective";
import {
  normalizeMetaSyntheticResultType,
  syntheticResultTypeFromMetaResultIndicator,
  type MetaCustomConversionResultTypeLookup,
} from "./meta-result-indicator";

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
export const META_CAMPAIGNS_TABLE_ADSET_SKIP_HINT = {
  headline: "No ad set column in this file — ad set slides won’t be included.",
  recommended: "Recommended: Download the CSV from Ad Reporting to include ad set slides.",
} as const;

function resultTypeFromCampaignsTableIndicator(
  indicator: string,
  customConversionResultTypes?: MetaCustomConversionResultTypeLookup,
): string | null {
  return syntheticResultTypeFromMetaResultIndicator(indicator, customConversionResultTypes);
}

/**
 * Campaigns-table rows often omit Result type; fill from Result indicator or
 * website submission column so counting matches Ads Reporting exports.
 */
/** Re-run campaigns-table Result indicator → result_type using an updated custom conversion catalog. */
export function reapplyMetaCampaignsTableResultTypes(
  colMap: ColumnMap,
  rows: NreRow[],
  headers: string[] | undefined,
  customConversionResultTypes?: MetaCustomConversionResultTypeLookup,
): MetaCsvExportProfile | undefined {
  const profile = detectMetaCsvExportProfile(colMap, rows, headers);
  if (profile.kind !== "campaigns_table") return profile;
  for (const row of rows) {
    const raw = row._raw ?? {};
    const indicator = String(raw["Result indicator"] ?? raw["result indicator"] ?? "").trim();
    if (indicator) row.result_type = undefined;
  }
  normalizeMetaCampaignsTableToAdsReportingShape(rows, profile, customConversionResultTypes);
  return profile;
}

/** Earliest Meta "Starts" date per campaign — same column Ads Reporting exports carry. */
function campaignStartsIsoByName(rows: NreRow[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const row of rows) {
    const name = normalizeCampaignName(String(row.campaign_name ?? ""));
    if (!name) continue;
    const raw = row._raw ?? {};
    const starts = String(raw["Starts"] ?? raw["starts"] ?? "").trim();
    const parsed = parseDate(starts);
    if (!parsed) continue;
    const iso = toIsoDate(parsed);
    const cur = out.get(name);
    if (!cur || iso < cur) out.set(name, iso);
  }
  return out;
}

function rowDateIso(row: NreRow): string | null {
  const parsed = parseDate(getRowDate(row));
  return parsed ? toIsoDate(parsed) : null;
}

/** Campaigns-table daily rows use Reporting starts/ends; inject `Day` so getRowDate matches Ad Reporting. */
function injectDayColumnLikeAdsReporting(row: NreRow): void {
  if (hasRealRowDate(row)) return;
  if (!hasReportingStartsEndsDailyRow(row)) return;
  const raw = row._raw ?? {};
  const startRaw = String(raw["Reporting starts"] ?? row.date_start ?? "").trim();
  if (!startRaw) return;
  raw["Day"] = startRaw;
}

function rowHasDeliverySignal(row: NreRow): boolean {
  return (
    parseCellNum(row.spend) > 0 ||
    parseCellNum(row.results) > 0 ||
    parseCellNum(row.impressions) > 0 ||
    parseCellNum(row.reach) > 0 ||
    parseCellNum(row.link_clicks) > 0
  );
}

/**
 * Single ingest normalizer — after this, campaigns-table uploads follow the
 * same row/date/result_type conventions as Ad Reporting exports for the
 * shared wizard + report engine (objectives, metrics, chart dates, CPR, etc.).
 */
export function normalizeMetaCampaignsTableToAdsReportingShape(
  rows: NreRow[],
  profile: MetaCsvExportProfile,
  customConversionResultTypes?: MetaCustomConversionResultTypeLookup,
): void {
  if (profile.kind !== "campaigns_table") return;
  enrichMetaCampaignsTableRows(rows, profile, customConversionResultTypes);
  const startsByCampaign = campaignStartsIsoByName(rows);

  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i]!;
    injectDayColumnLikeAdsReporting(row);

    const name = normalizeCampaignName(String(row.campaign_name ?? ""));
    const rowIso = rowDateIso(row);
    const startIso = name ? startsByCampaign.get(name) : undefined;
    if (rowIso && startIso && rowIso < startIso) {
      rows.splice(i, 1);
      continue;
    }
    if (!rowHasDeliverySignal(row)) {
      rows.splice(i, 1);
    }
  }
}

export function enrichMetaCampaignsTableRows(
  rows: NreRow[],
  profile: MetaCsvExportProfile,
  customConversionResultTypes?: MetaCustomConversionResultTypeLookup,
): void {
  if (profile.kind !== "campaigns_table") return;
  for (const row of rows) {
    if ((row.result_type ?? "").trim()) continue;
    const raw = row._raw ?? {};
    const indicator = String(raw["Result indicator"] ?? raw["result indicator"] ?? "").trim();
    const fromIndicator = indicator
      ? resultTypeFromCampaignsTableIndicator(indicator, customConversionResultTypes)
      : null;
    if (fromIndicator) {
      row.result_type = normalizeMetaSyntheticResultType(fromIndicator);
      continue;
    }
    const wl = String(row.website_leads ?? raw["website submission"] ?? "").trim();
    if (wl && Number(wl) > 0 && !String(row.results ?? "").trim()) {
      row.result_type = "website submission";
    }
  }
}
