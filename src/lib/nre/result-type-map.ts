/**
 * Objective Confirmation (permanent objective-detection fix) — the
 * definitive mapping from Meta's own machine-readable `result_type` values
 * (e.g. "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_purchase")
 * to NextReport's internal objective vocabulary.
 *
 * This is a NEW, separate signal from objective.ts's OBJECTIVE_CATALOG,
 * which matches free-text result_type against fuzzy regex patterns (built
 * for CSVs where result_type shows up as human-readable text like "Website
 * lead" or "Purchase"). RESULT_TYPE_MAP instead matches the EXACT machine
 * strings Meta's Ads Manager export actually writes into that column —
 * strictly more precise when it hits, so objective.ts's resolveCampaignObjective
 * checks this map FIRST, before falling back to the existing fuzzy/column-
 * presence/data-value priority chain for anything this map doesn't recognize.
 *
 * resultLabel/costLabel are kept identical to objective.ts's own
 * OBJECTIVE_CATALOG wherever the same objective already exists there
 * (PURCHASES, ADD TO CART, INITIATE CHECKOUT, WEBSITE LEADS, META FORM
 * LEADS, REACH, IMPRESSIONS, LINK CLICKS, LANDING PAGE VIEWS, APP INSTALLS,
 * VIDEO VIEWS, POST ENGAGEMENTS, PAGE LIKES, SUBSCRIPTIONS, AD RECALL LIFT,
 * CONTENT VIEWS) — so a campaign resolved via this exact-match table and one
 * resolved via the fuzzy catalog never disagree on label text for the same
 * underlying objective.
 */

export interface ObjectiveInfo {
  /** Internal, stable identifier for this objective — used by the wizard's Objective Confirmation dropdown to key its options and by callers that need a machine-comparable value rather than display text. */
  key: string;
  resultLabel: string;
  costLabel: string;
  /** True for awareness/reach-style objectives, whose "cost per result" is conventionally cost-per-1,000 (reach/impressions) rather than a plain per-conversion cost. */
  isReach: boolean;
}

export const RESULT_TYPE_MAP: Record<string, ObjectiveInfo> = {
  // REACH / AWARENESS
  reach: { key: "reach", resultLabel: "REACH", costLabel: "COST PER 1K REACH", isReach: true },
  impressions: { key: "impressions", resultLabel: "IMPRESSIONS", costLabel: "CPM", isReach: true },
  ad_recall_lift: { key: "ad_recall_lift", resultLabel: "AD RECALL LIFT", costLabel: "COST PER RECALL LIFT", isReach: true },
  estimated_ad_recall_lift: { key: "ad_recall_lift", resultLabel: "AD RECALL LIFT", costLabel: "COST PER RECALL LIFT", isReach: true },
  thruplay: { key: "video_views", resultLabel: "VIDEO VIEWS", costLabel: "COST PER VIDEO VIEW", isReach: false },
  thruplays: { key: "video_views", resultLabel: "VIDEO VIEWS", costLabel: "COST PER VIDEO VIEW", isReach: false },
  video_view: { key: "video_views", resultLabel: "VIDEO VIEWS", costLabel: "COST PER VIDEO VIEW", isReach: false },
  video_plays_at_least_2_secs: { key: "video_views", resultLabel: "VIDEO VIEWS", costLabel: "COST PER VIDEO VIEW", isReach: false },
  "2_second_continuous_video_plays": { key: "video_views", resultLabel: "VIDEO VIEWS", costLabel: "COST PER VIDEO VIEW", isReach: false },

  // TRAFFIC
  link_click: { key: "link_clicks", resultLabel: "LINK CLICKS", costLabel: "COST PER CLICK", isReach: false },
  landing_page_view: { key: "landing_page_views", resultLabel: "LANDING PAGE VIEWS", costLabel: "COST PER LPV", isReach: false },
  instagram_profile_visit: { key: "profile_visits", resultLabel: "PROFILE VISITS", costLabel: "COST PER VISIT", isReach: false },

  // ENGAGEMENT
  post_engagement: { key: "post_engagements", resultLabel: "POST ENGAGEMENTS", costLabel: "COST PER ENGAGEMENT", isReach: false },
  page_like: { key: "page_likes", resultLabel: "PAGE LIKES", costLabel: "COST PER PAGE LIKE", isReach: false },
  page_engagement: { key: "post_engagements", resultLabel: "POST ENGAGEMENTS", costLabel: "COST PER ENGAGEMENT", isReach: false },
  event_response: { key: "event_responses", resultLabel: "EVENT RESPONSES", costLabel: "COST PER RESPONSE", isReach: false },
  photo_view: { key: "photo_views", resultLabel: "PHOTO VIEWS", costLabel: "COST PER VIEW", isReach: false },
  check_in: { key: "check_ins", resultLabel: "CHECK-INS", costLabel: "COST PER CHECK-IN", isReach: false },

  // LEADS
  lead: { key: "website_leads", resultLabel: "WEBSITE LEADS", costLabel: "COST PER WEBSITE LEAD", isReach: false },
  website_lead: { key: "website_leads", resultLabel: "WEBSITE LEADS", costLabel: "COST PER WEBSITE LEAD", isReach: false },
  contact: { key: "website_leads", resultLabel: "WEBSITE LEADS", costLabel: "COST PER WEBSITE LEAD", isReach: false },
  "onsite_conversion.lead_grouped": { key: "meta_form_leads", resultLabel: "META FORM LEADS", costLabel: "COST PER LEAD", isReach: false },
  "onsite_conversion.messaging_conversation_started_7d": { key: "messaging", resultLabel: "CONVERSATIONS", costLabel: "COST PER CONVERSATION", isReach: false },
  leadgen_grouped: { key: "meta_form_leads", resultLabel: "META FORM LEADS", costLabel: "COST PER LEAD", isReach: false },
  onsite_web_lead: { key: "website_leads", resultLabel: "WEBSITE LEADS", costLabel: "COST PER WEBSITE LEAD", isReach: false },
  "offsite_conversion.fb_pixel_lead": { key: "website_leads", resultLabel: "WEBSITE LEADS", costLabel: "COST PER WEBSITE LEAD", isReach: false },
  "onsite_conversion.lead": { key: "meta_form_leads", resultLabel: "META FORM LEADS", costLabel: "COST PER LEAD", isReach: false },
  // Meta's human-readable result_type export for on-Facebook lead-form
  // campaigns (as opposed to the machine-readable
  // "onsite_conversion.lead_grouped" above) — resolveObjectiveFromResultType
  // already lowercases/trims before lookup, so this one lowercase key
  // matches both "leads (form)" and "Leads (form)".
  "leads (form)": { key: "meta_form_leads", resultLabel: "META FORM LEADS", costLabel: "COST PER LEAD", isReach: false },

  // MESSAGING
  messaging_conversation_started_7d: { key: "messaging", resultLabel: "CONVERSATIONS", costLabel: "COST PER CONVERSATION", isReach: false },
  new_messaging_connection: { key: "messaging", resultLabel: "CONVERSATIONS", costLabel: "COST PER CONVERSATION", isReach: false },
  whatsapp_message_send: { key: "messaging", resultLabel: "CONVERSATIONS", costLabel: "COST PER CONVERSATION", isReach: false },
  "onsite_conversion.messaging_first_reply_7d": { key: "messaging", resultLabel: "CONVERSATIONS", costLabel: "COST PER CONVERSATION", isReach: false },

  // CALLS
  phone_call: { key: "phone_calls", resultLabel: "PHONE CALLS", costLabel: "COST PER CALL", isReach: false },
  phone_call_confirm: { key: "phone_calls", resultLabel: "PHONE CALLS", costLabel: "COST PER CALL", isReach: false },

  // APP PROMOTION
  mobile_app_install: { key: "app_installs", resultLabel: "APP INSTALLS", costLabel: "COST PER INSTALL", isReach: false },
  app_install: { key: "app_installs", resultLabel: "APP INSTALLS", costLabel: "COST PER INSTALL", isReach: false },
  "offsite_conversion.fb_mobile_activate_app": { key: "app_installs", resultLabel: "APP INSTALLS", costLabel: "COST PER INSTALL", isReach: false },
  app_event: { key: "app_events", resultLabel: "APP EVENTS", costLabel: "COST PER APP EVENT", isReach: false },

  // SALES — PURCHASE FUNNEL (the critical one — Test 1/2/9)
  purchase: { key: "purchases", resultLabel: "PURCHASES", costLabel: "COST PER PURCHASE", isReach: false },
  "offsite_conversion.fb_pixel_purchase": { key: "purchases", resultLabel: "PURCHASES", costLabel: "COST PER PURCHASE", isReach: false },
  onsite_web_purchase: { key: "purchases", resultLabel: "PURCHASES", costLabel: "COST PER PURCHASE", isReach: false },
  product_catalog_sales: { key: "purchases", resultLabel: "PURCHASES", costLabel: "COST PER PURCHASE", isReach: false },

  add_to_cart: { key: "add_to_cart", resultLabel: "ADD TO CART", costLabel: "COST PER ADD TO CART", isReach: false },
  "offsite_conversion.fb_pixel_add_to_cart": { key: "add_to_cart", resultLabel: "ADD TO CART", costLabel: "COST PER ADD TO CART", isReach: false },
  onsite_web_add_to_cart: { key: "add_to_cart", resultLabel: "ADD TO CART", costLabel: "COST PER ADD TO CART", isReach: false },

  initiate_checkout: { key: "initiate_checkout", resultLabel: "INITIATE CHECKOUT", costLabel: "COST PER CHECKOUT", isReach: false },
  "offsite_conversion.fb_pixel_initiate_checkout": { key: "initiate_checkout", resultLabel: "INITIATE CHECKOUT", costLabel: "COST PER CHECKOUT", isReach: false },
  onsite_web_initiate_checkout: { key: "initiate_checkout", resultLabel: "INITIATE CHECKOUT", costLabel: "COST PER CHECKOUT", isReach: false },

  view_content: { key: "content_views", resultLabel: "CONTENT VIEWS", costLabel: "COST PER VIEW", isReach: false },
  "offsite_conversion.fb_pixel_view_content": { key: "content_views", resultLabel: "CONTENT VIEWS", costLabel: "COST PER VIEW", isReach: false },

  // SUBSCRIPTIONS
  subscribe: { key: "subscriptions", resultLabel: "SUBSCRIPTIONS", costLabel: "COST PER SUBSCRIPTION", isReach: false },
  recurring_subscription_payment_made: { key: "subscriptions", resultLabel: "SUBSCRIPTIONS", costLabel: "COST PER SUBSCRIPTION", isReach: false },

  // QUOTE REQUESTS
  quote_request: { key: "quote_requests", resultLabel: "QUOTE REQUESTS", costLabel: "COST PER QUOTE", isReach: false },

  // GROUP JOINS
  join_group: { key: "group_joins", resultLabel: "GROUP JOINS", costLabel: "COST PER JOIN", isReach: false },

  // GENERIC FALLBACKS
  offsite_conversion: { key: "conversions", resultLabel: "CONVERSIONS", costLabel: "COST PER CONVERSION", isReach: false },
  onsite_conversion: { key: "conversions", resultLabel: "CONVERSIONS", costLabel: "COST PER CONVERSION", isReach: false },
};

/** Case-insensitive exact-string lookup — `null` for anything not in RESULT_TYPE_MAP (the caller falls back to objective.ts's fuzzy/column/data-value priority chain in that case). */
export function resolveObjectiveFromResultType(resultType: string | null | undefined): ObjectiveInfo | null {
  if (!resultType) return null;
  const normalized = resultType.toLowerCase().trim();
  return RESULT_TYPE_MAP[normalized] ?? null;
}

/**
 * The Objective Confirmation step's dropdown options, in display order —
 * every objective a user can manually select for a campaign, independent of
 * whether the CSV's own result_type happens to name it exactly this way.
 * `RESULTS` (the generic fallback) is deliberately last.
 */
export const OBJECTIVE_DROPDOWN_OPTIONS: ObjectiveInfo[] = [
  { key: "purchases", resultLabel: "PURCHASES", costLabel: "COST PER PURCHASE", isReach: false },
  { key: "initiate_checkout", resultLabel: "INITIATE CHECKOUT", costLabel: "COST PER CHECKOUT", isReach: false },
  { key: "add_to_cart", resultLabel: "ADD TO CART", costLabel: "COST PER ADD TO CART", isReach: false },
  { key: "website_leads", resultLabel: "WEBSITE LEADS", costLabel: "COST PER WEBSITE LEAD", isReach: false },
  { key: "meta_form_leads", resultLabel: "META FORM LEADS", costLabel: "COST PER LEAD", isReach: false },
  { key: "link_clicks", resultLabel: "LINK CLICKS", costLabel: "COST PER CLICK", isReach: false },
  { key: "landing_page_views", resultLabel: "LANDING PAGE VIEWS", costLabel: "COST PER LPV", isReach: false },
  { key: "video_views", resultLabel: "VIDEO VIEWS / THRUPLAYS", costLabel: "COST PER VIDEO VIEW", isReach: false },
  { key: "reach", resultLabel: "REACH", costLabel: "COST PER 1K REACH", isReach: true },
  { key: "messaging", resultLabel: "MESSAGING / CONVERSATIONS", costLabel: "COST PER CONVERSATION", isReach: false },
  { key: "app_installs", resultLabel: "APP INSTALLS", costLabel: "COST PER INSTALL", isReach: false },
  { key: "post_engagements", resultLabel: "POST ENGAGEMENTS", costLabel: "COST PER ENGAGEMENT", isReach: false },
  { key: "page_likes", resultLabel: "PAGE LIKES", costLabel: "COST PER PAGE LIKE", isReach: false },
  { key: "phone_calls", resultLabel: "PHONE CALLS", costLabel: "COST PER CALL", isReach: false },
  { key: "subscriptions", resultLabel: "SUBSCRIPTIONS", costLabel: "COST PER SUBSCRIPTION", isReach: false },
  { key: "results", resultLabel: "RESULTS", costLabel: "COST PER RESULT", isReach: false },
];
