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
}
