/**
 * Meta Ads CSV export — wizard + /help/download share this copy.
 * NextReport requires Reports export with Day breakdown (not Campaigns-screen export).
 */

export const META_CSV_EXPORT_PATH = {
  title: "Use the Reports export (required)",
  doThis:
    "Ads Manager → open Reports (or Reporting) → build a Campaign report → Export → Export table data → CSV.",
  notThis:
    "Campaigns (or Ad Sets) → Export on the main table does not include Day breakdown. That file will fail upload.",
  dayBreakdown: "Set Time breakdown to Day — one row per campaign per day.",
} as const;

/** Columns every Meta campaign report CSV should include when possible. */
export const META_CSV_BASE_COLUMNS: readonly string[] = [
  "Campaign name",
  "Day",
  "Result type",
  "Results",
  "Amount spent",
  "Cost per result",
  "Reach",
  "Impressions",
  "CTR (all)",
  "CPC (cost per link click)",
  "Link clicks",
];

export interface MetaCsvObjectiveColumnGroup {
  id: string;
  label: string;
  /** Extra columns to tick in Ads Manager for this optimization goal. */
  columns: readonly string[];
  note?: string;
}

/** Objective-shaped add-ons — base columns above still apply. */
export const META_CSV_OBJECTIVE_COLUMN_GROUPS: readonly MetaCsvObjectiveColumnGroup[] = [
  {
    id: "traffic_lpv",
    label: "Traffic · landing page views",
    columns: ["Landing page views", "Cost per landing page view"],
  },
  {
    id: "leads",
    label: "Leads · forms & website",
    columns: ["Website leads", "On-Facebook leads", "Cost per lead"],
  },
  {
    id: "link_clicks",
    label: "Traffic · link clicks (link-click objective)",
    columns: ["Link clicks", "CPC (cost per link click)", "CTR (link click-through rate)"],
    note: "Base list already includes link clicks — add these if Meta hides them until you customize columns.",
  },
  {
    id: "purchase",
    label: "Purchase & shopping funnel",
    columns: [
      "Add to cart",
      "Cost per add to cart",
      "Initiate checkout",
      "Cost per initiate checkout",
      "Purchases",
      "Purchase ROAS (return on ad spend)",
      "Website purchase conversion value",
    ],
    note: "Add purchase-funnel columns when you run purchase or catalog sales campaigns.",
  },
  {
    id: "reach",
    label: "Reach & awareness",
    columns: ["Frequency", "Cost per 1,000 people reached"],
  },
  {
    id: "messaging",
    label: "Messaging · WhatsApp / Instagram",
    columns: ["Messaging conversations started", "Cost per messaging conversation started"],
  },
  {
    id: "video",
    label: "Video views",
    columns: ["ThruPlays", "Cost per ThruPlay", "3-second video plays"],
  },
];

export function metaCsvColumnsForObjectiveGroup(groupId: string): string[] {
  const group = META_CSV_OBJECTIVE_COLUMN_GROUPS.find((g) => g.id === groupId);
  if (!group) return [...META_CSV_BASE_COLUMNS];
  return [...META_CSV_BASE_COLUMNS, ...group.columns];
}

/** Short numbered steps for help page — no paragraphs. */
export const META_CSV_QUICK_STEPS: readonly { title: string; detail?: string }[] = [
  { title: META_CSV_EXPORT_PATH.doThis },
  { title: META_CSV_EXPORT_PATH.dayBreakdown },
  { title: "Pick the date range for your report type (see wizard Download instructions)." },
  { title: "Include base columns + extras for your campaign objectives (Metrics to include in wizard)." },
  { title: "Export as CSV and upload on Import." },
];
