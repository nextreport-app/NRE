/**
 * Weekly report CSV completeness — the calendar week (e.g. last 7 days ending
 * yesterday) must have a daily row for every day in that window when the
 * campaign was delivering later in the week. Missing leading days (common
 * when re-exporting without extending the date range) otherwise under-count
 * spend while the slide still shows the full week label.
 */

import { filterRowsByCampaigns } from "./campaigns";
import { getRowDate, type NreRow } from "./columns";
import { computeCsvDateBounds, type DateRangeIso } from "./date-range";
import { toIsoDate } from "./date-range";

function tsOfIso(iso: string): number {
  return Date.parse(iso + "T00:00:00Z");
}

/** Inclusive calendar days from startIso through endIso. */
export function eachDayInWeeklyRange(range: DateRangeIso): string[] {
  const startTs = tsOfIso(range.startIso);
  const endTs = tsOfIso(range.endIso);
  if (Number.isNaN(startTs) || Number.isNaN(endTs) || startTs > endTs) return [];
  const out: string[] = [];
  for (let ts = startTs; ts <= endTs; ts += 86400000) {
    const d = new Date(ts);
    out.push(
      toIsoDate({
        year: d.getUTCFullYear(),
        month: d.getUTCMonth() + 1,
        day: d.getUTCDate(),
      }),
    );
  }
  return out;
}

export interface WeeklyCsvCoverageResult {
  ok: boolean;
  /** ISO dates in the reporting window with no daily rows for selected campaigns. */
  missingDays: string[];
  error?: string;
}

/**
 * Returns ok:false when the CSV has no rows on one or more days inside the
 * weekly window while other days in the same window do have rows — the usual
 * pattern when Oct 2 is missing but Oct 3–8 are present for a Oct 2–8 report.
 */
export function validateWeeklyCsvDayRowsPresent(
  rows: NreRow[],
  range: DateRangeIso,
  selectedCampaigns: string[] | null | undefined,
): WeeklyCsvCoverageResult {
  const days = eachDayInWeeklyRange(range);
  if (days.length === 0) {
    return { ok: false, missingDays: [], error: "Invalid weekly date range." };
  }

  const filtered = filterRowsByCampaigns(rows, selectedCampaigns ?? null);
  if (filtered.length === 0) {
    return { ok: true, missingDays: [] };
  }

  const daysWithRows = new Set<string>();
  filtered.forEach((row) => {
    const iso = getRowDate(row);
    if (iso) daysWithRows.add(iso);
  });

  const missingDays = days.filter((day) => !daysWithRows.has(day));
  if (missingDays.length === 0) {
    return { ok: true, missingDays: [] };
  }

  const hasAnyRowInWindow = days.some((day) => daysWithRows.has(day));
  if (!hasAnyRowInWindow) {
    return { ok: true, missingDays: [] };
  }

  const firstDayWithData = days.find((day) => daysWithRows.has(day));
  const leadingOnly =
    firstDayWithData != null && missingDays.every((day) => day < firstDayWithData);
  const trailingOrInternal = missingDays.some((day) => firstDayWithData != null && day > firstDayWithData);

  if (leadingOnly || trailingOrInternal) {
    const bounds = computeCsvDateBounds(filtered);
    if (leadingOnly && bounds && bounds.minIso > range.startIso) {
      // The week starts before this export's first day — normal for new campaigns
      // or a short re-export; weekly_period_partial / custom range handles that.
      return { ok: true, missingDays: [] };
    }

    const sample = missingDays.slice(0, 3).join(", ");
    const more = missingDays.length > 3 ? ` (+${missingDays.length - 3} more)` : "";
    return {
      ok: false,
      missingDays,
      error: `Your CSV is missing daily rows for ${sample}${more} inside the report week (${range.startIso} – ${range.endIso}). Re-export from Ads Manager with daily breakdown for the full week so spend matches Ads Manager.`,
    };
  }

  return { ok: true, missingDays: [] };
}
