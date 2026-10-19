import type { NreRow } from "./columns";
import {
  capRangeToData,
  computeCsvDateBounds,
  computeDailyRangeIso,
  computeEffectiveLast7RangeIso,
  computeEffectiveMtdRangeIso,
  computeMonthComparisonRangeOptions,
  computeWeeklyRangeOptions,
} from "./date-range";

/** Date-range options derived from a parsed upload session — shared by analyze and draft rehydrate. */
export function computeWizardUploadDateContext(rows: NreRow[], timezone: string, now = new Date()) {
  const calendarWeekly = computeWeeklyRangeOptions(rows, now, timezone);
  const effectiveLast7 = computeEffectiveLast7RangeIso(rows, now, timezone) ?? calendarWeekly.last7;
  return {
    dateBounds: computeCsvDateBounds(rows),
    weeklyOptions: {
      last7: effectiveLast7,
      prev7: capRangeToData(calendarWeekly.prev7, rows, now, timezone),
      last14: capRangeToData(calendarWeekly.last14, rows, now, timezone),
    },
    mtdRange: computeEffectiveMtdRangeIso(rows, now, timezone),
    monthComparisonOptions: computeMonthComparisonRangeOptions(rows, now, timezone),
    dailyRange: computeDailyRangeIso(rows, now, timezone),
  };
}
