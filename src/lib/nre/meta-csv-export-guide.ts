/**
 * Meta Ads CSV export — wizard + /help/download share this copy.
 * Daily workflows use Day breakdown; Monthly also accepts validated campaign/month totals.
 * Column lists are generated from meta-dictionary.ts (same as Step 3 metrics).
 */

import {
  buildMetaCsvObjectiveColumnGroups,
  buildMetaExportBaseColumns,
  metaCsvColumnsForObjectiveGroup as columnsForGroup,
  type MetaCsvObjectiveColumnGroup,
} from "./meta-csv-export-from-dictionary";

/** Direct deep link — Ads Manager → Reporting (Ad Reporting export). */
export const META_ADS_MANAGER_REPORTING = {
  href: "https://adsmanager.facebook.com/adsmanager/reporting",
  linkLabel: "Meta Ads Reporting Section",
  shortLabel: "Meta Ads Reporting",
} as const;

export type MetaAdsReportingLinkVariant = "inline" | "button" | "help";

/** Import-step tooltip — day-wise CSV from Ads Reporting + common metrics. */
export const META_CSV_IMPORT_TOOLTIP = {
  body: "Download the day-wise breakdown CSV from Ads Reporting in Meta Ads Manager. Include these common metrics when possible:",
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
  title: "Export a campaign report from Meta Ads Manager",
  exportSteps: [
    "Open Meta Ads Reporting Section (link above) and select the ad account",
    "Build a Campaign report",
    "Choose the reporting dates required by your report type",
    "Use Day breakdown for Weekly, Daily and custom comparisons; Monthly accepts campaign totals or Month breakdown",
    "Include metrics to go in the report",
    "Save → Export table data → CSV",
  ] as const,
  dayBreakdownImportant: 'Monthly totals need Reporting starts/ends and one row per campaign/month. Use Day breakdown for Weekly, Daily and custom comparisons.',
  baseColumnsIntro:
    "Include base columns: Popular metric from meta you can always include.",
  baseColumnsInExport: [
    "Amount spent",
    "Reach",
    "Impressions",
    "Results",
    "Cost per result",
    "CTR",
    "CPC",
    "Link clicks",
  ] as const,
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
