/**
 * Canonical 8-card packs — the only source of default campaign-slide chips.
 *
 * Objective + performance goal → exactly 8 metric keys, in PPT slot order.
 * CSV extras (Frequency, CPC (All), landing-page views, ATC, …) never enter
 * these 8 unless the user adds them on Metric Review. Missing values stay
 * on that card as a dash; they are never swapped for another metric.
 *
 * Slot layout (matches the campaign template):
 *   1 spend  2 reach  3 impressions
 *   4 primary result  5 primary cost
 *   6 CTR (all)
 *   7–8 secondary pair for this performance goal
 */

export const CORE_PACK_PREFIX = ["spend", "reach", "impressions"] as const;

export type PackId =
  | "awareness_reach"
  | "awareness_impressions"
  | "traffic_link_clicks"
  | "traffic_landing_page_views"
  | "leads_meta_form"
  | "leads_website"
  | "leads_messaging"
  | "sales_purchase"
  | "sales_add_to_cart"
  | "sales_initiate_checkout";

export interface MetricPack {
  id: PackId;
  objective: string;
  performanceGoal: string;
  /** Exactly 8 keys, slot order. */
  keys: readonly [string, string, string, string, string, string, string, string];
  extraPoolExamples: readonly string[];
}

function pack(
  id: PackId,
  objective: string,
  performanceGoal: string,
  slot4: string,
  slot5: string,
  slot7: string,
  slot8: string,
  extraPoolExamples: readonly string[],
): MetricPack {
  return {
    id,
    objective,
    performanceGoal,
    keys: ["spend", "reach", "impressions", slot4, slot5, "ctr", slot7, slot8],
    extraPoolExamples,
  };
}

/** Locked Instant Form 8 — confirmed with the product owner. */
export const LEADS_META_FORM_PACK = pack(
  "leads_meta_form",
  "LEADS",
  "Meta instant form",
  "meta_form_leads",
  "cost_per_lead",
  "link_clicks",
  "cpc_link_click",
  ["frequency", "cpc_all", "landing_page_views", "cost_per_lpv"],
);

export const METRIC_PACKS: readonly MetricPack[] = [
  pack("awareness_reach", "AWARENESS", "Maximise reach of ads", "frequency", "cpm", "link_clicks", "cpc_link_click", ["video_thruplay"]),
  pack("awareness_impressions", "AWARENESS", "Maximise number of impressions", "cpm", "frequency", "link_clicks", "cpc_link_click", ["video_thruplay"]),
  pack("traffic_link_clicks", "TRAFFIC", "Maximise link clicks", "link_clicks", "cpc_link_click", "landing_page_views", "cost_per_lpv", ["cpc_all", "frequency", "clicks_all"]),
  pack("traffic_landing_page_views", "TRAFFIC", "Maximise landing page views", "landing_page_views", "cost_per_lpv", "link_clicks", "cpc_link_click", ["cpc_all", "frequency"]),
  LEADS_META_FORM_PACK,
  pack("leads_website", "LEADS", "Website lead", "website_leads", "cost_per_website_lead", "landing_page_views", "link_clicks", ["cpc_all", "cpc_link_click", "frequency"]),
  pack("leads_messaging", "LEADS", "Messaging conversations", "messaging_conversations_started", "cost_per_conversation", "new_messaging_contacts", "link_clicks", ["frequency"]),
  pack("sales_purchase", "SALES", "Purchase", "purchases", "cost_per_purchase", "add_to_cart", "results_roas", ["initiate_checkout", "cost_per_add_to_cart", "landing_page_views"]),
  pack("sales_add_to_cart", "SALES", "Add to cart", "add_to_cart", "cost_per_add_to_cart", "initiate_checkout", "purchases", ["results_roas"]),
  pack("sales_initiate_checkout", "SALES", "Initiate checkout", "initiate_checkout", "cost_per_initiate_checkout", "add_to_cart", "purchases", ["results_roas"]),
];

const RESULT_LABEL_TO_PACK: Record<string, PackId> = {
  "META FORM LEADS": "leads_meta_form",
  "WEBSITE LEADS": "leads_website",
  LEADS: "leads_website",
  "LINK CLICKS": "traffic_link_clicks",
  "LANDING PAGE VIEWS": "traffic_landing_page_views",
  REACH: "awareness_reach",
  "UNIQUE REACH": "awareness_reach",
  PURCHASES: "sales_purchase",
  "ADD TO CART": "sales_add_to_cart",
  "INITIATE CHECKOUT": "sales_initiate_checkout",
  "MESSAGING LEADS": "leads_messaging",
  CONVERSATIONS: "leads_messaging",
};

export function packForResultLabel(resultLabel: string): MetricPack | undefined {
  const id = RESULT_LABEL_TO_PACK[(resultLabel || "").toUpperCase()];
  return METRIC_PACKS.find((p) => p.id === id);
}
