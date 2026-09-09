/**
 * Comparison report date coverage — validates that Period A/B fit the
 * uploaded CSV (and optional stored Previous Month Data), and merges rows
 * when Period B spans dates outside the primary Last-30-Days export.
 */

import { getRowDate, type NreRow } from "./columns";
import { filterNreRowsByDateRange, type CsvDateBounds, type CustomRangeValidation, type DateRangeIso } from "./date-range";

export interface ComparisonCoverageResult extends CustomRangeValidation {
  /** Period B will include rows from stored Previous Month Data. */
  periodBUsesSupplemental?: boolean;
  /** Informational message when supplemental data fills Period B gaps. */
  warning?: string;
}

function periodWithinBounds(period: DateRangeIso, bounds: CsvDateBounds): boolean {
  const startTs = Date.parse(period.startIso + "T00:00:00Z");
  const endTs = Date.parse(period.endIso + "T00:00:00Z");
  const minTs = Date.parse(bounds.minIso + "T00:00:00Z");
  const maxTs = Date.parse(bounds.maxIso + "T00:00:00Z");
  return startTs >= minTs && endTs <= maxTs;
}

function mergedBounds(primary: CsvDateBounds, supplemental: CsvDateBounds): CsvDateBounds {
  return {
    minIso: primary.minIso < supplemental.minIso ? primary.minIso : supplemental.minIso,
    maxIso: primary.maxIso > supplemental.maxIso ? primary.maxIso : supplemental.maxIso,
  };
}

/** Validates one comparison period against CSV bounds (same rules as custom weekly). */
export function validateComparisonPeriodCoverage(
  period: DateRangeIso,
  bounds: CsvDateBounds,
): CustomRangeValidation {
  const startTs = Date.parse(period.startIso + "T00:00:00Z");
  const endTs = Date.parse(period.endIso + "T00:00:00Z");
  if (Number.isNaN(startTs) || Number.isNaN(endTs)) {
    return { valid: false, error: "Invalid comparison period dates." };
  }
  if (startTs > endTs) {
    return { valid: false, error: "Comparison period start must be before end." };
  }
  const minTs = Date.parse(bounds.minIso + "T00:00:00Z");
  const maxTs = Date.parse(bounds.maxIso + "T00:00:00Z");
  if (startTs < minTs || endTs > maxTs) {
    return {
      valid: false,
      error: `This period (${period.startIso} to ${period.endIso}) is outside the available data (${bounds.minIso} to ${bounds.maxIso}).`,
    };
  }
  return { valid: true };
}

/**
 * Period A must fit the primary CSV. Period B may use stored Previous Month
 * Data when the Last-30-Days export does not reach back far enough.
 */
export function validateComparisonReportCoverage(
  periodA: DateRangeIso,
  periodB: DateRangeIso,
  primaryBounds: CsvDateBounds | null,
  supplementalBounds?: CsvDateBounds | null,
): ComparisonCoverageResult {
  if (!primaryBounds) {
    return { valid: false, error: "Upload a CSV with daily data before running a comparison report." };
  }

  const periodAValidation = validateComparisonPeriodCoverage(periodA, primaryBounds);
  if (!periodAValidation.valid) {
    return {
      valid: false,
      error: `Period A is not fully covered by your CSV. ${periodAValidation.error ?? ""}`.trim(),
    };
  }

  if (periodWithinBounds(periodB, primaryBounds)) {
    return { valid: true };
  }

  if (supplementalBounds) {
    const combined = mergedBounds(primaryBounds, supplementalBounds);
    const combinedValidation = validateComparisonPeriodCoverage(periodB, combined);
    if (combinedValidation.valid) {
      const usesSupplemental = periodB.startIso < primaryBounds.minIso || periodB.endIso < primaryBounds.minIso;
      return {
        valid: true,
        periodBUsesSupplemental: usesSupplemental,
        warning: usesSupplemental
          ? "Period B includes dates from your stored Previous Month Data because your main CSV does not reach that far back."
          : undefined,
      };
    }
  }

  const periodBPrimary = validateComparisonPeriodCoverage(periodB, primaryBounds);
  if (!periodBPrimary.valid) {
    const hint = supplementalBounds
      ? " Re-export a longer custom range, or upload Previous Month Data on the client Manage page."
      : " Export a custom date range that includes both periods, or upload Previous Month Data on Manage for the month-vs-month preset.";
    return {
      valid: false,
      error: `Period B is not fully covered by your CSV.${hint}`,
    };
  }

  return { valid: true };
}

function comparisonRowKey(row: NreRow): string {
  const date = getRowDate(row) ?? "";
  const campaign = row.campaign_name ?? "";
  const adSet = row.ad_set_name ?? "";
  return `${date}|${campaign}|${adSet}`;
}

/** Primary rows win when the same day/campaign/ad set exists in both sources. */
export function mergeComparisonPeriodRows(
  primaryRows: NreRow[],
  supplementalRows: NreRow[] | undefined,
  period: DateRangeIso,
): NreRow[] {
  const fromPrimary = filterNreRowsByDateRange(primaryRows, period);
  if (!supplementalRows?.length) return fromPrimary;

  const primaryKeys = new Set(fromPrimary.map(comparisonRowKey));
  const gapFill = filterNreRowsByDateRange(supplementalRows, period).filter(
    (row) => !primaryKeys.has(comparisonRowKey(row)),
  );
  return [...fromPrimary, ...gapFill];
}
