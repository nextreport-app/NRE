/**
 * Universal TikTok Ads objective dictionary — single source of truth for:
 *  - API sync result_type labels (fetch-tiktok-report-rows.ts)
 *  - Manual CSV Result type column normalization (tiktok-columns.ts)
 *  - Exact-match aliases merged into RESULT_TYPE_MAP (shared Meta pipeline)
 */

import type { ObjectiveInfo } from "./meta-objective-dictionary";

export interface TikTokApiMetrics {
  spend?: string;
  clicks?: string;
  reach?: string;
  impressions?: string;
  conversion?: string;
  cost_per_conversion?: string;
  cpc?: string;
  video_play_actions?: string;
  cost_per_video_play?: string;
  complete_payment?: string;
  cost_per_complete_payment?: string;
  form_submission?: string;
  cost_per_form_submission?: string;
}

export interface TikTokCsvResultFields {
  results: string;
  resultType: string;
  costPerResult: string;
}

export interface TikTokObjectiveSpec {
  key: string;
  resultLabel: string;
  costLabel: string;
  /** Human-readable Result type written by API sync + expected in CSV uploads. */
  apiCsvLabel: string;
  /** Lowercase exact-match aliases for RESULT_TYPE_MAP. */
  aliases: readonly string[];
  /** API resolution priority — first matching spec with data wins. */
  detectionPriority: number;
  /** Returns true when this spec's primary metric has a positive value. */
  matchesApiMetrics: (metrics: TikTokApiMetrics) => boolean;
  readApiFields: (metrics: TikTokApiMetrics) => TikTokCsvResultFields;
}

function parseNum(raw: string | undefined): number {
  if (!raw) return 0;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(raw: string | undefined): string {
  if (!raw) return "0";
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return raw;
  return n.toFixed(2);
}

export const TIKTOK_OBJECTIVE_SPECS: readonly TikTokObjectiveSpec[] = [
  {
    key: "complete_payment",
    resultLabel: "PURCHASES",
    costLabel: "COST PER PURCHASE",
    apiCsvLabel: "Complete payment",
    aliases: ["complete payment", "complete_payment", "tiktok complete payment"],
    detectionPriority: 10,
    matchesApiMetrics: (m) => parseNum(m.complete_payment) > 0,
    readApiFields: (m) => ({
      results: m.complete_payment ?? "0",
      resultType: "Complete payment",
      costPerResult: formatMoney(m.cost_per_complete_payment),
    }),
  },
  {
    key: "form_submission",
    resultLabel: "LEADS",
    costLabel: "COST PER LEAD",
    apiCsvLabel: "Form submission",
    aliases: ["form submission", "form_submission", "tiktok form submission"],
    detectionPriority: 20,
    matchesApiMetrics: (m) => parseNum(m.form_submission) > 0,
    readApiFields: (m) => ({
      results: m.form_submission ?? "0",
      resultType: "Form submission",
      costPerResult: formatMoney(m.cost_per_form_submission),
    }),
  },
  {
    key: "conversions",
    resultLabel: "CONVERSIONS",
    costLabel: "COST PER CONVERSION",
    apiCsvLabel: "Conversions",
    aliases: ["conversions", "conversion", "total conversions"],
    detectionPriority: 30,
    matchesApiMetrics: (m) => parseNum(m.conversion) > 0,
    readApiFields: (m) => ({
      results: m.conversion ?? "0",
      resultType: "Conversions",
      costPerResult: formatMoney(m.cost_per_conversion),
    }),
  },
  {
    key: "video_views",
    resultLabel: "VIDEO VIEWS",
    costLabel: "COST PER VIDEO VIEW",
    apiCsvLabel: "Video views",
    aliases: ["video views", "video view", "video_play_actions", "video play actions"],
    detectionPriority: 40,
    matchesApiMetrics: (m) => parseNum(m.video_play_actions) > 0,
    readApiFields: (m) => ({
      results: m.video_play_actions ?? "0",
      resultType: "Video views",
      costPerResult: formatMoney(m.cost_per_video_play),
    }),
  },
  {
    key: "reach",
    resultLabel: "REACH",
    costLabel: "COST PER 1K REACH",
    apiCsvLabel: "Reach",
    aliases: ["reach", "people reached"],
    detectionPriority: 50,
    matchesApiMetrics: (m) => {
      const reach = parseNum(m.reach);
      const clicks = parseNum(m.clicks);
      return reach > 0 && clicks <= reach * 0.05;
    },
    readApiFields: (m) => {
      const reach = parseNum(m.reach);
      return {
        results: m.reach ?? "0",
        resultType: "Reach",
        costPerResult: reach > 0 ? formatMoney(String(parseNum(m.spend) / reach)) : formatMoney(m.cpc),
      };
    },
  },
  {
    key: "link_clicks",
    resultLabel: "LINK CLICKS",
    costLabel: "COST PER CLICK",
    apiCsvLabel: "Link clicks",
    aliases: ["link clicks", "link click", "clicks", "clicks (destination)"],
    detectionPriority: 60,
    matchesApiMetrics: () => true,
    readApiFields: (m) => ({
      results: m.clicks ?? "0",
      resultType: "Link clicks",
      costPerResult: formatMoney(m.cpc),
    }),
  },
];

/** CSV header aliases → Meta-shaped "Result type" column name. */
export const TIKTOK_CSV_HEADER_ALIASES: Record<string, string> = {
  cost: "Amount spent (USD)",
  "total cost": "Amount spent (USD)",
  "ad group name": "Ad set name",
  "adgroup name": "Ad set name",
  "clicks (destination)": "Link clicks",
  clicks: "Link clicks",
  "cpc (destination)": "CPC (cost per link click)",
  cpc: "CPC (cost per link click)",
  "ctr (destination)": "CTR (All)",
  ctr: "CTR (All)",
  conversions: "Results",
  conversion: "Results",
  "cost per conversion": "Cost per result",
  "result type": "Result type",
  "optimization type": "Result type",
  "optimization goal": "Result type",
  result: "Results",
  day: "Day",
  date: "Day",
};

/** Normalize a TikTok CSV Result type cell value to a dictionary apiCsvLabel. */
export function normalizeTikTokResultTypeCell(value: string): string {
  const lower = value.toLowerCase().trim();
  for (const spec of TIKTOK_OBJECTIVE_SPECS) {
    if (spec.aliases.includes(lower)) return spec.apiCsvLabel;
  }
  return value;
}

export function resolveTikTokApiResultFields(metrics: TikTokApiMetrics): TikTokCsvResultFields {
  const sorted = [...TIKTOK_OBJECTIVE_SPECS].sort((a, b) => a.detectionPriority - b.detectionPriority);
  for (const spec of sorted) {
    if (spec.key === "link_clicks") continue;
    if (spec.matchesApiMetrics(metrics)) return spec.readApiFields(metrics);
  }
  return sorted.find((s) => s.key === "link_clicks")!.readApiFields(metrics);
}

export function buildTikTokResultTypeAliases(base?: Record<string, ObjectiveInfo>): Record<string, ObjectiveInfo> {
  const out: Record<string, ObjectiveInfo> = {};
  for (const spec of TIKTOK_OBJECTIVE_SPECS) {
    const info: ObjectiveInfo = {
      key: spec.key,
      resultLabel: spec.resultLabel,
      costLabel: spec.costLabel,
      isReach: spec.key === "reach",
    };
    const candidates = [spec.apiCsvLabel, ...spec.aliases].map((a) => a.toLowerCase());
    for (const alias of candidates) {
      if (base && alias in base) continue;
      out[alias] = info;
    }
  }
  return out;
}
