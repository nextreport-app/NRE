import type { NreRow } from "./columns";
import { apiQueryCoverage } from "./api-query-coverage";
import { metaApiImportRange } from "./meta-api-import-range";
import { comparisonPeriodSchema, dateSelectionSchema, parseJsonFormField, reportTypeSchema } from "../validators/report-wizard";
/** A newly selected period needs a new import; never shift an API report to fit older cached data. */
export function metaApiSelectionCoverageError(form: FormData | null, rows: NreRow[], timezone: string, now = new Date()): string | null {
  const coverage = apiQueryCoverage(rows);
  if (!coverage || !form) return null;
  try {
    const requested = metaApiImportRange({ reportType: parseJsonFormField(form, "reportType", reportTypeSchema), dateSelection: parseJsonFormField(form, "dateSelection", dateSelectionSchema), comparisonPeriodA: parseJsonFormField(form, "comparisonPeriodA", comparisonPeriodSchema), comparisonPeriodB: parseJsonFormField(form, "comparisonPeriodB", comparisonPeriodSchema), historicalMonthCount: Number(form.get("historicalMonthCount")) || undefined }, now, timezone);
    if (requested.sinceIso < coverage.startIso || requested.untilIso > coverage.endIso) return "Your API import does not cover these reporting dates. Return to Import, select the dates you want, and sync the ad account again.";
  } catch (error) { return error instanceof Error ? error.message : "Choose valid report dates."; }
  return null;
}
