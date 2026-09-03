import {
  fetchMetaAdAccountInsights,
  type MetaInsightAction,
  type MetaInsightRow,
} from "@/lib/meta-api";
import { computeLastNDaysIsoRange } from "./api-date-range";
import { isoToCsvDay, rowsToCsv } from "./rows-to-csv";

const META_CSV_HEADERS = [
  "Campaign name",
  "Ad set name",
  "Day",
  "Amount spent (USD)",
  "Reach",
  "Impressions",
  "CTR (All)",
  "CPC (cost per link click)",
  "Link clicks",
  "Frequency",
  "Results",
  "Result type",
  "Cost per result",
] as const;

/** Maps Meta action_type to a human-readable result type label (CSV-style). */
function actionTypeToResultLabel(actionType: string): string {
  const map: Record<string, string> = {
    link_click: "Link clicks",
    purchase: "Purchases",
    lead: "Leads",
    "offsite_conversion.fb_pixel_lead": "Website leads",
    "onsite_conversion.lead_grouped": "Meta leads",
    landing_page_view: "Landing page views",
    omni_purchase: "Purchases",
    "offsite_conversion.fb_pixel_purchase": "Purchases",
  };
  return map[actionType] ?? actionType.replace(/_/g, " ");
}

/** Picks the primary result action — highest numeric value wins. */
function pickPrimaryAction(actions: MetaInsightAction[] | undefined): MetaInsightAction | null {
  if (!actions?.length) return null;
  let best: MetaInsightAction | null = null;
  let bestVal = -1;
  for (const a of actions) {
    const val = parseFloat(a.value);
    if (!Number.isFinite(val) || val <= 0) continue;
    if (val > bestVal) {
      bestVal = val;
      best = a;
    }
  }
  return best;
}

function formatPercent(raw: string | undefined): string {
  if (!raw) return "";
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return raw;
  // Meta returns CTR as decimal (e.g. 0.015) or sometimes as percent — normalize to percent string.
  const pct = n <= 1 && n > 0 ? n * 100 : n;
  return `${pct.toFixed(2)}%`;
}

function formatMoney(raw: string | undefined): string {
  if (!raw) return "0";
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return raw;
  return n.toFixed(2);
}

function insightToCsvRow(row: MetaInsightRow): string[] {
  const primary = pickPrimaryAction(row.actions);
  const cprAction = primary
    ? row.cost_per_action_type?.find((a) => a.action_type === primary.action_type)
    : null;

  return [
    row.campaign_name ?? "",
    row.adset_name ?? "",
    row.date_start ? isoToCsvDay(row.date_start) : "",
    formatMoney(row.spend),
    row.reach ?? "",
    row.impressions ?? "",
    formatPercent(row.ctr),
    formatMoney(row.cpc),
    row.inline_link_clicks ?? "",
    row.frequency ?? "",
    primary?.value ?? "",
    primary ? actionTypeToResultLabel(primary.action_type) : "",
    cprAction?.value ? formatMoney(cprAction.value) : "",
  ];
}

export interface FetchMetaReportCsvInput {
  accessToken: string;
  adAccountId: string;
  timezone: string;
  now?: Date;
  days?: number;
}

/** Fetches Meta insights and serializes to CSV bytes matching the NRE Meta export shape. */
export async function fetchMetaReportCsv(input: FetchMetaReportCsvInput): Promise<{
  csvText: string;
  rowCount: number;
  sinceIso: string;
  untilIso: string;
}> {
  const { sinceIso, untilIso } = computeLastNDaysIsoRange(
    input.now ?? new Date(),
    input.timezone,
    input.days ?? 30,
  );

  const insights = await fetchMetaAdAccountInsights({
    accessToken: input.accessToken,
    adAccountId: input.adAccountId,
    sinceIso,
    untilIso,
  });

  const dataRows = insights
    .filter((r) => r.campaign_name && r.date_start)
    .map(insightToCsvRow);

  const csvText = rowsToCsv([...META_CSV_HEADERS], dataRows);

  return { csvText, rowCount: dataRows.length, sinceIso, untilIso };
}

export { META_CSV_HEADERS };
