import type { Step } from "./types";

export const STEP_LABELS: Record<Step, string> = {
  1: "Import",
  2: "Campaigns",
  3: "Metrics",
  4: "Generate",
};

export const STEP_HEADINGS: Record<Step, string> = {
  1: "Add your ad data",
  2: "Campaigns & objectives",
  3: "Review metrics",
  4: "Generate report",
};

export const STEP_SUBTITLES: Record<Step, string> = {
  1: "Pick report type, export the matching CSV, then upload or sync.",
  2: "Pick campaigns and confirm each primary result objective.",
  3: "These chips become the PPT cards — customize only if needed.",
  4: "Weekly is recommended for most clients; review readiness, then generate.",
};

export const LAST_PLATFORM_STORAGE_KEY = "nre.lastAdPlatform";

export const ADD_FROM_CSV_VISIBLE = 8;

export const ADSET_CHIP_CLASS =
  "flex-shrink-0 rounded-md border border-dash-border bg-dash-bg px-2 py-1 text-[14px] font-medium text-dash-ink-secondary hover:text-dash-ink disabled:opacity-30";

export const MIN_SELECTED_METRICS = 4;

export const DEFAULT_REPORT_TITLE = "Weekly Performance Report";
export const DEFAULT_MONTHLY_REPORT_TITLE = "Monthly Performance Report";
export const DEFAULT_COMPARISON_REPORT_TITLE = "Comparison Performance Report";
export const DEFAULT_HISTORICAL_REPORT_TITLE = "Multi-Month Performance Report";
/** Multi-day table — one account row per calendar day (not the single-day Yesterday report). */
export const DEFAULT_DAY_BREAKDOWN_REPORT_TITLE = "Day-by-Day Table Report";
/** Single-day snapshot — campaign card slides for the latest complete day. */
export const DEFAULT_DAILY_REPORT_TITLE = "Yesterday Performance Report";
export const DEFAULT_CREATIVE_REPORT_TITLE = "Creative Performance Report";
export const DEFAULT_QUARTER_REPORT_TITLE = "Quarterly Performance Report";
export const DEFAULT_YTD_REPORT_TITLE = "Year-to-Date Performance Report";

export const ACCEPTED_FILE_TYPES = ".csv,.tsv,.txt,.xlsx,.xls,.ods";

export const SPECIFIC_FIELD_ERRORS = new Set(["campaign_name", "spend", "results", "date_granularity"]);
