/**
 * Meta Ads CSV export — wizard + /help/download share this copy.
 * NextReport requires Reports export with Day breakdown (not Campaigns-screen export).
 * Column lists are generated from meta-dictionary.ts (same as Step 3 metrics).
 */

import {
  buildMetaCsvObjectiveColumnGroups,
  buildMetaExportBaseColumns,
  metaCsvColumnsForObjectiveGroup as columnsForGroup,
  type MetaCsvObjectiveColumnGroup,
} from "./meta-csv-export-from-dictionary";

export const META_CSV_EXPORT_PATH = {
  title: "Use the Reports export (required)",
  doThis:
    "Ads Manager → open Reports (or Reporting) → build a Campaign report → Export → Export table data → CSV.",
  notThis:
    "Campaigns (or Ad Sets) → Export on the main table does not include Day breakdown. That file will fail upload.",
  dayBreakdown: "Set Time breakdown to Day — one row per campaign per day.",
} as const;

/** Columns every Meta campaign report CSV should include when possible (from dictionary). */
export const META_CSV_BASE_COLUMNS: readonly string[] = buildMetaExportBaseColumns();

export type { MetaCsvObjectiveColumnGroup };

/** Objective-shaped add-ons — base columns above still apply. */
export const META_CSV_OBJECTIVE_COLUMN_GROUPS: readonly MetaCsvObjectiveColumnGroup[] =
  buildMetaCsvObjectiveColumnGroups();

export function metaCsvColumnsForObjectiveGroup(groupId: string): string[] {
  return columnsForGroup(groupId, META_CSV_BASE_COLUMNS, META_CSV_OBJECTIVE_COLUMN_GROUPS);
}

/** Short numbered steps for help page — no paragraphs. */
export const META_CSV_QUICK_STEPS: readonly { title: string; detail?: string }[] = [
  { title: META_CSV_EXPORT_PATH.doThis },
  { title: META_CSV_EXPORT_PATH.dayBreakdown },
  { title: "Pick the date range for your report type (see wizard Download instructions)." },
  { title: "Include base columns + extras for your campaign objectives (Metrics to include in wizard)." },
  { title: "Export as CSV and upload on Import." },
];
