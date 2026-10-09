/**
 * Meta Ads CSV export — wizard + /help/download share this copy.
 * NextReport requires Ad Reporting export with Day-wise breakdown (not Campaigns-screen export).
 * Column lists are generated from meta-dictionary.ts (same as Step 3 metrics).
 */

import {
  buildMetaCsvObjectiveColumnGroups,
  buildMetaExportBaseColumns,
  metaCsvColumnsForObjectiveGroup as columnsForGroup,
  type MetaCsvObjectiveColumnGroup,
} from "./meta-csv-export-from-dictionary";

/** Import-step tooltip — day-wise CSV from Ads Reporting + common metrics. */
export const META_CSV_IMPORT_TOOLTIP = {
  body: 'Download the day-wise breakdown CSV from the Ads Reporting section. Include these common metrics when possible:',
  metrics: [
    "Amount spent",
    "Reach",
    "Impressions",
    "Results",
    "Cost per result",
    "CTR",
    "CPC",
    "Link clicks",
  ],
} as const;

export const META_CSV_EXPORT_PATH = {
  title: "Always use the Ad Reporting section to export (required)",
  exportSteps: [
    "Ads Manager → open Ad Reporting",
    "Build a Campaign report",
    "Select last 30 days",
    "Breakdown (Day-wise) always",
    "Include metrics to go in the report",
    "Save → Export table data → CSV",
  ] as const,
  dayBreakdownImportant: 'Important - Set Time breakdown to "Day-wise" — for all campaigns.',
  baseColumnsIntro:
    "Include base columns: Popular metric from meta you can always include.",
  baseColumnsOutro: "+ extras for your campaign objectives.",
  saveTip: "Save the report before downloading so next time you don't have to select again.",
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

/** Curated lists for /help/download — simpler than full dictionary chips. */
export const META_CSV_HELP_BASE = {
  title: "Base columns",
  subtitle: "Popular metric from meta to always include.",
  metrics: [
    "Amount spent",
    "Impressions",
    "Reach",
    "Results",
    "Cost per result",
    "Link clicks",
    "CPC (cost per link click)",
    "CTR (all)",
  ],
} as const;

export const META_CSV_HELP_BY_OBJECTIVE = {
  title: "Additionally, more relevant metrics based on your campaign objective:",
  metrics: [
    "CPM",
    "Landing page views",
    "Cost per landing page view",
    "Leads",
    "Cost per lead",
    "Purchase ROAS (return on ad spend)",
    "Purchases",
    "Cost per purchase",
    "Purchases conversion value",
    "Add to Cart",
    "Initiate Checkout",
  ],
} as const;

export const META_CSV_HELP_PREVIOUS_MONTH = {
  title: "1st of month · previous month file · historical",
  bullets: [
    "Go to Ads reporting within Ads Manager and select the ad account.",
    'Set time duration to "Previous month", breakdown day-wise, include metrics, and export CSV.',
    "Upload the file in the Previous month section on Import.",
    "Adds a previous-month row alongside current month-to-date on your Monthly campaign overview slide.",
    "Use it to compare this month vs last month campaign performance.",
  ] as const,
} as const;
