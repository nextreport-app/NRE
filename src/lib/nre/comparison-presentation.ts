export type ComparisonTone = "positive" | "negative" | "neutral";

/** Direction is numerical; favourability depends on what the metric measures. */
export function comparisonTone(key: string, label: string, percent: number | null): ComparisonTone {
  if (percent === null || !Number.isFinite(percent) || percent === 0) return "neutral";
  const metric = key.toLowerCase();
  if (["spend", "cost", "frequency"].includes(metric)) return "neutral";
  const lowerIsBetter = /^(?:cpr|cpc|cpm|cpa)(?:_|$)|^cost_per_/.test(metric) || /\bcost\s*per\b|\bcpc\b|\bcpm\b|\bcpa\b/i.test(label);
  const higherIsBetter = /_roas$/.test(metric) || /\broas\b|return on ad spend/i.test(label) || /^(?:results|reach|impressions|ctr|clicks|link_clicks|landing_page_views|purchases|leads|website_leads|revenue|purchase_value|roas|registrations|app_installs|conversions)(?:_|$)/.test(metric);
  if (!lowerIsBetter && !higherIsBetter) return "neutral";
  return (lowerIsBetter ? percent < 0 : percent > 0) ? "positive" : "negative";
}

/** Do not round small, real changes into a misleading +0%. */
export function comparisonPercent(percent: number | null): string {
  if (percent === null || !Number.isFinite(percent)) return "N/A";
  if (percent === 0) return "0%";
  const sign = percent > 0 ? "+" : "-";
  const amount = Math.abs(percent);
  return `${sign}${amount < 0.1 ? "<0.1" : amount < 1 ? amount.toFixed(1) : String(Math.round(amount))}%`;
}
