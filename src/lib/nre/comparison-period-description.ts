import { reportCalendarYesterday } from "./report-period-selection";
import type { DateRangeIso } from "./date-range";

/** Human labels supplement exact dates; historical/custom windows never pretend to be current. */
export function comparisonPeriodDescription(a: DateRangeIso, b: DateRangeIso, now = new Date(), timezone = "UTC") {
  const days = (range: DateRangeIso) => Math.round((Date.parse(range.endIso) - Date.parse(range.startIso)) / 86400000) + 1;
  const countA = days(a), countB = days(b);
  if (![countA, countB].every(count => Number.isFinite(count) && count > 0)) return { comparisonLabel: "Custom date comparison", periodATitle: "PERIOD A", periodBTitle: "PERIOD B" };
  const consecutive = Date.parse(a.startIso) - Date.parse(b.endIso) === 86400000;
  if ([7, 15, 30].includes(countA) && countA === countB && consecutive) {
    const current = a.endIso === reportCalendarYesterday(now, timezone);
    return { comparisonLabel: `${current ? "Last " : ""}${countA} days vs previous ${countA} days`, periodATitle: `${current ? "LAST " : ""}${countA} DAYS`, periodBTitle: `PREVIOUS ${countA} DAYS` };
  }
  return { comparisonLabel: "Custom date comparison", periodATitle: `PERIOD A · ${countA} ${countA === 1 ? "DAY" : "DAYS"}`, periodBTitle: `PERIOD B · ${countB} ${countB === 1 ? "DAY" : "DAYS"}` };
}
