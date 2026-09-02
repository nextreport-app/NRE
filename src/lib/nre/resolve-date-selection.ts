/**
 * Resolves the report upload wizard's date-range step choice ("last7" /
 * "prev7" / "custom") into a concrete weekly DateRangeIso against the
 * uploaded CSV's actual rows. Shared by the preview and generate API
 * routes so a custom range is re-validated against the real CSV bounds
 * server-side too, not just trusted from whatever the client already
 * validated.
 */

import { computeCsvDateBounds, computeWeeklyRangeOptions, validateCustomWeeklyRange, type DateRangeIso } from "./date-range";
import type { NreRow } from "./columns";
import type { DateSelection } from "../validators/report-wizard";

export interface ResolveDateSelectionResult {
  ok: boolean;
  error?: string;
  /** `undefined` when there's no selection to apply — caller falls back to the default trailing-7-days window. */
  weeklyRange?: DateRangeIso;
}

export function resolveDateSelection(
  rows: NreRow[],
  selection: DateSelection | undefined,
  now: Date = new Date(),
  timezone = "UTC",
): ResolveDateSelectionResult {
  if (!selection) return { ok: true };

  if (selection.mode === "custom") {
    const bounds = computeCsvDateBounds(rows);
    if (!bounds || !selection.customStart || !selection.customEnd) {
      return { ok: false, error: "Invalid custom date range." };
    }
    const validation = validateCustomWeeklyRange(selection.customStart, selection.customEnd, bounds);
    if (!validation.valid) {
      return { ok: false, error: validation.error || "Invalid custom date range." };
    }
    return { ok: true, weeklyRange: { startIso: selection.customStart, endIso: selection.customEnd } };
  }

  const options = computeWeeklyRangeOptions(rows, now, timezone);
  if (!options) {
    return { ok: false, error: "Could not compute a weekly date range from the uploaded CSV." };
  }
  return { ok: true, weeklyRange: selection.mode === "prev7" ? options.prev7 : options.last7 };
}
