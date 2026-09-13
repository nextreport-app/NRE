/**
 * TikTok-specific result-type resolution for API sync → Meta-shaped CSV.
 * Does NOT reuse Meta's pickResultAction / optimization-goal tables — TikTok
 * exposes different metrics; we infer from spend/clicks/reach/conversions only.
 */

export interface TikTokApiMetrics {
  spend?: string;
  clicks?: string;
  reach?: string;
  impressions?: string;
  conversion?: string;
  cost_per_conversion?: string;
  cpc?: string;
}

export interface TikTokCsvResultFields {
  results: string;
  resultType: string;
  costPerResult: string;
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

/**
 * Maps TikTok integrated-report metrics to Result type / Results / Cost per result
 * columns the shared pipeline understands via RESULT_TYPE_MAP.
 */
export function resolveTikTokApiResultFields(metrics: TikTokApiMetrics): TikTokCsvResultFields {
  const conversions = parseNum(metrics.conversion);
  const clicks = parseNum(metrics.clicks);
  const reach = parseNum(metrics.reach);

  if (conversions > 0) {
    return {
      results: metrics.conversion ?? "0",
      resultType: "Conversions",
      costPerResult: formatMoney(metrics.cost_per_conversion),
    };
  }

  // Reach-first campaigns: meaningful reach with little/no click volume.
  if (reach > 0 && clicks <= reach * 0.05) {
    return {
      results: metrics.reach ?? "0",
      resultType: "Reach",
      costPerResult: reach > 0 ? formatMoney(String(parseNum(metrics.spend) / reach)) : formatMoney(metrics.cpc),
    };
  }

  return {
    results: metrics.clicks ?? "0",
    resultType: "Link clicks",
    costPerResult: formatMoney(metrics.cpc),
  };
}
