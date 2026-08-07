/**
 * Maps a dynamically-selected metric to one of the 7 icon categories the
 * campaign template's own 7 fixed card slots already have baked in (Spend/
 * Reach/Impressions/Results/CTR/Cost-per-Result/CPC — see fill-tags.ts's
 * buildCampaignOrAdSetSlideXml, which swaps each slot's own <p:pic> to
 * point at a DIFFERENT slot's relationship id when the metric assigned to
 * it doesn't match that slot's native icon category, reusing the
 * template's own already-embedded icon images rather than embedding new
 * ones).
 */

export type MetricIconId = "spend" | "reach" | "impressions" | "results" | "ctr" | "cost" | "cpc";

/**
 * Explicit key overrides first (the metrics that map 1:1 onto a template
 * card the icons were literally drawn for, plus the product's own literal
 * mapping list for the "results" bucket); everything else falls back to
 * format-based category rules, and any format this doesn't recognize falls
 * back to the RESULTS icon (per product direction: "for metrics that do not
 * have a matching icon in the template, use the most visually similar icon
 * from the extracted set — e.g. the RESULTS icon for any unknown
 * result-type metric, since there's no dedicated video icon in the
 * template either").
 */
export function resolveMetricIconId(metric: {
  key: string;
  format: "currency" | "number" | "percentage" | "duration" | "ratio" | "text";
  perUnitOf?: string;
}): MetricIconId {
  switch (metric.key) {
    case "spend":
    case "cost":
      return "spend";
    case "reach":
      return "reach";
    case "impressions":
    case "frequency":
      return "impressions";
    case "ctr":
      return "ctr";
    case "cpc_link_click":
    case "avg_cpc":
    case "cpc_all":
      return "cpc";
    case "results":
    case "website_leads":
    case "leads":
    case "link_clicks":
    case "landing_page_views":
    case "purchases":
    case "app_installs":
    case "video_views":
    case "thruplays":
    case "video_p100":
    case "messaging_conversations":
    case "clicks":
    case "conversions":
      return "results";
  }

  // "cost per X" / CPC / CPM / bid-target style per-unit currency metrics —
  // never a plain sum (see dynamic-metrics.ts), so visually distinct from a
  // spend/revenue total.
  if (metric.format === "currency" && metric.perUnitOf) {
    return metric.key.includes("cpc") || metric.key.includes("cpv") || metric.key.includes("cpe") ? "cpc" : "cost";
  }
  if (metric.format === "currency") return "spend"; // aggregate totals: revenue, conv. value, gross profit, ...
  if (metric.format === "percentage") return "ctr"; // rates/shares — visually the "Ads + click" icon fits best
  if (metric.format === "ratio") return "cost"; // ROAS-style efficiency ratios
  if (metric.format === "duration") return "impressions";
  return "results"; // number/text and anything else — the documented default
}
