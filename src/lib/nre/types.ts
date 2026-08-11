/**
 * Shared row shape consumed by objective/table-row calculations. Both AggRow
 * (numeric, output of aggregateRows) and NreRow (string, raw CSV-mapped) are
 * structurally compatible with this — field values just flow through
 * parseCellNum, which accepts number | string | null | undefined.
 */
export interface MetricRow {
  spend?: unknown;
  reach?: unknown;
  impressions?: unknown;
  ctr?: unknown;
  cpc?: unknown;
  results?: unknown;
  cpr?: unknown;
  frequency?: unknown;
  result_type?: string | null;
  campaign_name?: string;
  ad_set_name?: string;
  date_start?: string;
  date_end?: string;
  /**
   * Objective-specific result columns (this round's fix — see
   * objective.ts's resolveObjective) — present on a raw NreRow (which has
   * these as real, mapped CSV columns) but not on an already-aggregated
   * AggRow (aggregateRows folds them into result_type/results before
   * output), so they're always undefined there and resolveObjective simply
   * falls through to result_type text, which aggregateRows already
   * resolved correctly upstream. All optional — genuinely absent unless
   * the caller's own CSV had the column.
   */
  link_clicks?: unknown;
  purchases?: unknown;
  website_leads?: unknown;
  meta_leads?: unknown;
  leads?: unknown;
  landing_page_views?: unknown;
  /** Raw, unmapped CSV column values for this row, if the caller has them (a raw NreRow always does; an aggregated AggRow never does) — used only to detect column-name presence (Priority 3), never for values. */
  _raw?: Record<string, string>;
}
