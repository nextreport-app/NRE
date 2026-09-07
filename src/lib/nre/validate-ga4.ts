/**
 * GA4 CSV validation before website report generation.
 */

import type { Ga4ColumnMap, Ga4Row } from "./ga4-columns";
import { parseDate } from "./dates";
import type { ValidationIssue, ValidationResult } from "./validate";

const MAX_RANGE_DAYS = 366;

export const GA4_NO_DATA_ROWS_MESSAGE =
  "Your GA4 CSV contains no usable data rows. Export a report from GA4 with Sessions and at least one date or dimension column.";

function parseNum(value: string | undefined): number {
  if (!value) return 0;
  const cleaned = value.replace(/[,$%]/g, "").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function parseRate(value: string | undefined): number {
  if (!value) return 0;
  const cleaned = value.replace(/%/g, "").trim();
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return 0;
  return n > 1 ? n / 100 : n;
}

export function getGa4RowDate(row: Ga4Row): string {
  return row.date ?? "";
}

export function validateGa4Csv(
  colMap: Ga4ColumnMap,
  rows: Ga4Row[],
  now: Date = new Date(),
  headers: string[] = [],
): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  if (!colMap.sessions) {
    errors.push({
      field: "sessions",
      message:
        "Your CSV is missing a Sessions column. In GA4, include Sessions when exporting — Reports → Export or Explore → Download CSV.",
    });
  }

  const nonEmpty = rows.filter((r) => parseNum(r.sessions) > 0 || Object.values(r._raw).some((v) => v.trim()));
  if (nonEmpty.length === 0) {
    errors.push({ field: "rows", message: GA4_NO_DATA_ROWS_MESSAGE });
  }

  if (colMap.date) {
    const dates = nonEmpty
      .map((r) => parseDate(getGa4RowDate(r)))
      .filter((d): d is NonNullable<ReturnType<typeof parseDate>> => d !== null);
    if (dates.length === 0) {
      warnings.push({
        field: "date",
        message: "Date column found but no rows parsed as valid dates. Check date format (YYYY-MM-DD or MM/DD/YYYY).",
      });
    } else if (dates.length >= 2) {
      const sorted = dates.map((d) => Date.UTC(d.year, d.month - 1, d.day)).sort((a, b) => a - b);
      const spanDays = (sorted[sorted.length - 1]! - sorted[0]!) / 86_400_000 + 1;
      if (spanDays > MAX_RANGE_DAYS) {
        warnings.push({
          field: "date",
          message: `CSV spans ${Math.round(spanDays)} days. Very long ranges may produce large reports.`,
        });
      }
    }
  } else {
    warnings.push({
      field: "date",
      message:
        "No Date column detected — treating the CSV as a pre-aggregated export for the wizard's selected date range.",
    });
  }

  if (headers.length > 0 && errors.length > 0) {
    warnings.push({
      field: "headers",
      message: `Detected columns: ${headers.slice(0, 8).join(", ")}${headers.length > 8 ? "…" : ""}`,
    });
  }

  void now;
  return { valid: errors.length === 0, errors, warnings, noCampaignData: nonEmpty.length === 0 };
}

export { parseNum as parseGa4CsvNum, parseRate as parseGa4CsvRate };
