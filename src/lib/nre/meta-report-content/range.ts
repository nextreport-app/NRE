import { apiQueryCoverage } from "../api-query-coverage";
import { computeCsvDateBounds } from "../date-range";
import { reportCalendarYesterday } from "../report-period-selection";
import type { NreRow } from "../columns";
import { csvReportNow } from "../csv-reporting-calendar";
import { resolveDateSelection } from "../resolve-date-selection";
import {
  historicalPeriods,
  selectedSinglePeriod,
} from "../report-period-selection";
import type { DateSelection } from "@/lib/validators/report-wizard";
import type { DateRangeIso } from "../date-range";
export function metaContentRanges(input: {
  reportType: string;
  reportSelection?: import("./selection").MetaReportSelection;
  dateSelection?: DateSelection;
  historicalMonthCount?: number;
  rows: NreRow[];
  timezone: string;
  now?: Date;
}): DateRangeIso[] {
  if (input.reportSelection)
    return [
      standaloneMetaRange(
        input.rows,
        input.dateSelection,
        input.timezone,
        input.now,
      ),
    ];
  const now = csvReportNow(input.rows, input.now ?? new Date(), input.timezone);
  if (input.reportType === "WEEKLY") {
    const result = resolveDateSelection(
      input.rows,
      input.dateSelection,
      now,
      input.timezone,
    );
    if (!result.ok || !result.weeklyRange)
      throw Error(result.error || "Choose a reporting week.");
    return [result.weeklyRange];
  }
  if (input.reportType === "MONTHLY")
    return [
      selectedSinglePeriod(
        "MONTHLY",
        input.dateSelection,
        now,
        input.timezone,
      )!,
    ];
  if (input.reportType === "HISTORICAL")
    return historicalPeriods(
      input.historicalMonthCount ?? 3,
      input.dateSelection?.mode === "custom"
        ? input.dateSelection.customEnd?.slice(0, 7)
        : undefined,
      input.dateSelection?.mode === "custom",
      now,
      input.timezone,
    );
  throw Error(
    "Audience and creative sections are available for Weekly and Monthly reports. Choose one of those report types.",
  );
}

/** Standalone reports use the exact chosen period, never a shifted weekly/MTD window. */
export function standaloneMetaRange(
  rows: NreRow[],
  selection: DateSelection | undefined,
  timezone: string,
  now = new Date(),
): DateRangeIso {
  const start = selection?.customStart,
    end = selection?.customEnd;
  const valid = (value: string | undefined): value is string =>
    !!value &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value + "T00:00:00Z")) &&
    new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value;
  if (
    selection?.mode !== "custom" ||
    !valid(start) ||
    !valid(end) ||
    start > end ||
    end > reportCalendarYesterday(now, timezone)
  )
    throw Error("Choose valid reporting dates ending yesterday or earlier.");
  if ((Date.parse(end) - Date.parse(start)) / 86400000 > 366)
    throw Error("Choose a reporting period of 12 months or less.");
  const api = apiQueryCoverage(rows),
    csv = computeCsvDateBounds(rows);
  const low = api?.startIso ?? csv?.minIso,
    high = api?.endIso ?? csv?.maxIso;
  if (!low || !high || start < low || end > high)
    throw Error(
      "The import does not cover the selected reporting period. Change the dates on Import or import data covering the full selected period.",
    );
  return { startIso: start, endIso: end };
}
