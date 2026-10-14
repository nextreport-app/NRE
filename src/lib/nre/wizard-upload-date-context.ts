import type { NreRow } from "./columns";
import {
  computeCsvDateBounds,
  computeDailyRangeIso,
  computeMonthComparisonRangeOptions,
  computeMtdRangeIso,
  computeWeeklyRangeOptions,
} from "./date-range";

/** Date-range options derived from a parsed upload session — shared by analyze and draft rehydrate. */
export function computeWizardUploadDateContext(rows: NreRow[], timezone: string, now = new Date()) {
  return {
    dateBounds: computeCsvDateBounds(rows),
    weeklyOptions: computeWeeklyRangeOptions(rows, now, timezone),
    mtdRange: computeMtdRangeIso(rows, now, timezone),
    monthComparisonOptions: computeMonthComparisonRangeOptions(rows, now, timezone),
    dailyRange: computeDailyRangeIso(rows, now, timezone),
  };
}
