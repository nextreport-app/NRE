import type { DateSelection } from "@/lib/validators/report-wizard";
import type { DateRangeIso } from "../types";

/** Maps legacy quick-pick modes to UI-supported values, preserving the intended range as custom when needed. */
export function normalizeSavedDateSelection(
  selection: DateSelection,
  weeklyOptions: { last7: DateRangeIso; prev7: DateRangeIso; last14: DateRangeIso } | null,
): { mode: DateSelection["mode"]; customStart?: string; customEnd?: string } {
  if (selection.mode === "custom") return selection;
  if (selection.mode === "last7") return selection;

  if (selection.mode === "prev7" && weeklyOptions) {
    return {
      mode: "custom",
      customStart: weeklyOptions.prev7.startIso,
      customEnd: weeklyOptions.prev7.endIso,
    };
  }
  if (selection.mode === "last14" && weeklyOptions) {
    return {
      mode: "custom",
      customStart: weeklyOptions.last14.startIso,
      customEnd: weeklyOptions.last14.endIso,
    };
  }

  return { mode: "last7" };
}
