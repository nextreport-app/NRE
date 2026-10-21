/**
 * Shared defaults for the Meta manual-CSV report engine.
 * Keep in sync with buildReportData (alignResultsWithCsvExport) and
 * resolveCsvAlignResults in report-wizard.ts — both default to export-style counting.
 */

import type { ResultCountingMode } from "./meta-csv-export-counting";

/** Ads Manager export rules — blank Result type + blank Results = 0 leads. */
export const DEFAULT_META_RESULT_COUNTING_MODE: ResultCountingMode = "meta-csv-export";
