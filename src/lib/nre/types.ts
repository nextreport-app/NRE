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
  /** Correctly-bound counterpart of meta_leads (columns.ts's Layer 1 fix) — the objective-detection rebuild's own resolveCampaignObjective pipeline reads this field, never meta_leads (whose keyword binding is deliberately left broken/unchanged since resolveObjective/health.ts still depend on its exact current behavior). */
  meta_form_leads?: unknown;
  leads?: unknown;
  landing_page_views?: unknown;
  /**
   * Campaign-level objective rollup fix (Combined Total table MTD-row bug)
   * — present as real numeric totals on an AggRow (aggregateRows now
   * retains its own accumulated g.initiate_checkout/g.add_to_cart rather
   * than discarding them), and undefined on a raw NreRow (which has no
   * dedicated mapped column for either — objective.ts's
   * groupResultsByCampaignObjective falls back to reading these straight
   * from _raw for a raw row instead). Lets groupResultsByCampaignObjective
   * read the metric that actually matches a CAMPAIGN's assigned objective
   * for each of its ad-set rows, instead of blindly trusting `results`
   * (which, per ad-set-group, reflects THAT ad set's own — possibly
   * different — resolved objective; see aggregate.ts's actualResults
   * correction).
   */
  initiate_checkout?: unknown;
  add_to_cart?: unknown;
  /** Raw, unmapped CSV column values for this row, if the caller has them (a raw NreRow always does; an aggregated AggRow never does) — used only to detect column-name presence (Priority 3), never for values. */
  _raw?: Record<string, string>;
}
