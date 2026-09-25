/**
 * Meta API sync (rewritten): Insights API → synthetic CSV identical in shape and
 * fill rules to manual Ads Manager exports, then the normal NRE CSV import path.
 *
 * - Fetch: ad-set + daily (same grain as typical manual downloads)
 * - Transform: insight-engine.ts (manual export result picking)
 * - Serialize: shared rows-to-csv helper
 */
export {
  fetchMetaReportCsv,
  type FetchMetaReportCsvInput,
} from "./fetch-meta-report-csv";
export {
  META_CSV_HEADERS,
  pickResultAction,
  pickResultFromAdsManagerFields,
  pickManualExportResult,
  insightToManualCsvRow,
  dedupeInsightsByAdSetDay,
} from "./insight-engine";
