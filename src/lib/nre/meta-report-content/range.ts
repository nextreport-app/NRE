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
  dateSelection?: DateSelection;
  historicalMonthCount?: number;
  rows: NreRow[];
  timezone: string;
  now?: Date;
}): DateRangeIso[] {
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
