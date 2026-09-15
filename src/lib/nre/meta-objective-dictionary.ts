/**
 * Universal Meta Ads objective dictionary — single source of truth for:
 *  - CSV export `result_type` exact matching (RESULT_TYPE_MAP)
 *  - API sync action_type → human-readable Result type (fetch-meta-report-rows)
 *  - Step 0 definitive-proof detection (one typed row = ground truth)
 *
 * Manual CSV exports and API-sync rows both flow through result-type-map.ts's
 * resolveObjectiveFromResultType, so keeping aliases here prevents the two
 * paths from drifting apart.
 */

export interface ObjectiveInfo {
  key: string;
  resultLabel: string;
  costLabel: string;
  isReach: boolean;
}

export interface MetaObjectiveSpec {
  key: string;
  resultLabel: string;
  costLabel: string;
  isReach: boolean;
  canonicalText: string;
  /** Lowercase exact-match aliases (machine + human-readable export labels). */
  aliases: readonly string[];
  /**
   * Step 0 — even ONE row with this result_type is Meta's declared optimization
   * result for that day; outweighs blank-majority mid-funnel column noise.
   */
  definitiveProof?: boolean;
  /** Primary human-readable Result type label written by API sync CSV builder. */
  apiCsvLabel?: string;
}

/** Step 0 tie-break order — deepest / most specific conversion wins. */
export const DEFINITIVE_PROOF_PRIORITY: readonly string[] = [
  "purchases",
  "initiate_checkout",
  "add_to_cart",
  "payment_info",
  "content_views",
  "website_leads",
  "meta_form_leads",
  "messaging",
  "whatsapp_leads",
  "instagram_dm_leads",
  "phone_calls",
  "appointment_leads",
  "registrations",
  "applications",
  "subscriptions",
  "quote_requests",
  "app_events",
  "app_installs",
  "link_clicks",
  "landing_page_views",
  "video_views",
  "post_engagements",
  "page_likes",
  "followers",
  "event_responses",
  "profile_visits",
  "reach",
  "impressions",
  "ad_recall_lift",
  "conversions",
  "leads",
  "store_visits",
];

export const META_OBJECTIVE_SPECS: readonly MetaObjectiveSpec[] = [
  {
    key: "purchases",
    resultLabel: "PURCHASES",
    costLabel: "COST PER PURCHASE",
    isReach: false,
    canonicalText: "Purchase",
    apiCsvLabel: "Purchase",
    definitiveProof: true,
    aliases: [
      "purchase",
      "purchases",
      "website purchase",
      "website purchases",
      "omni_purchase",
      "onsite_conversion.purchase",
      "onsite_web_purchase",
      "onsite_web_app_purchase",
      "offsite_conversion.fb_pixel_purchase",
      "product_catalog_sales",
      "catalog sales",
      "product catalog sales",
    ],
  },
  {
    key: "initiate_checkout",
    resultLabel: "INITIATE CHECKOUT",
    costLabel: "COST PER CHECKOUT",
    isReach: false,
    canonicalText: "Initiate checkout",
    apiCsvLabel: "Initiate checkout",
    definitiveProof: true,
    aliases: [
      "initiate_checkout",
      "initiate checkout",
      "checkouts initiated",
      "offsite_conversion.fb_pixel_initiate_checkout",
      "onsite_web_initiate_checkout",
    ],
  },
  {
    key: "add_to_cart",
    resultLabel: "ADD TO CART",
    costLabel: "COST PER ADD TO CART",
    isReach: false,
    canonicalText: "Add to cart",
    apiCsvLabel: "Add to cart",
    definitiveProof: true,
    aliases: [
      "add_to_cart",
      "add to cart",
      "adds to cart",
      "offsite_conversion.fb_pixel_add_to_cart",
      "onsite_web_add_to_cart",
      "onsite_web_app_add_to_cart",
      "onsite_conversion.add_to_cart",
    ],
  },
  {
    key: "payment_info",
    resultLabel: "PAYMENT INFO",
    costLabel: "COST PER PAYMENT INFO",
    isReach: false,
    canonicalText: "Add payment info",
    apiCsvLabel: "Add payment info",
    definitiveProof: true,
    aliases: [
      "add_payment_info",
      "add payment info",
      "addpaymentinfo",
      "offsite_conversion.fb_pixel_add_payment_info",
    ],
  },
  {
    key: "content_views",
    resultLabel: "CONTENT VIEWS",
    costLabel: "COST PER VIEW",
    isReach: false,
    canonicalText: "View content",
    apiCsvLabel: "View content",
    definitiveProof: true,
    aliases: ["view_content", "view content", "viewcontent", "offsite_conversion.fb_pixel_view_content"],
  },
  {
    key: "website_leads",
    resultLabel: "WEBSITE LEADS",
    costLabel: "COST PER WEBSITE LEAD",
    isReach: false,
    canonicalText: "Website lead",
    apiCsvLabel: "Website leads",
    definitiveProof: true,
    aliases: [
      "website submission",
      "website lead",
      "website leads",
      "web lead",
      "web leads",
      "website_lead",
      "onsite_web_lead",
      "offsite_conversion.fb_pixel_lead",
      "contact",
      "quality_lead",
      "lead",
    ],
  },
  {
    key: "meta_form_leads",
    resultLabel: "META FORM LEADS",
    costLabel: "COST PER LEAD",
    isReach: false,
    canonicalText: "Meta lead",
    apiCsvLabel: "Leads (form)",
    definitiveProof: true,
    aliases: [
      "leads (form)",
      "lead (form)",
      "meta lead",
      "meta leads",
      "instant form leads",
      "onsite_conversion.lead_grouped",
      "onsite_conversion.lead",
      "leadgen_grouped",
      "lead_grouped",
    ],
  },
  {
    key: "messaging",
    resultLabel: "MESSAGING / CONVERSATIONS",
    costLabel: "COST PER CONVERSATION",
    isReach: false,
    canonicalText: "Messaging conversations started",
    apiCsvLabel: "Messaging conversations started",
    definitiveProof: true,
    aliases: [
      "messaging conversations started",
      "messaging conversation started",
      "onsite_conversion.messaging_conversation_started_7d",
      "messaging_conversation_started_7d",
      "onsite_conversion.messaging_first_reply_7d",
      "new_messaging_connection",
      "whatsapp_message_send",
    ],
  },
  {
    key: "whatsapp_leads",
    resultLabel: "WHATSAPP LEADS",
    costLabel: "COST PER CONVERSATION",
    isReach: false,
    canonicalText: "Whatsapp lead",
    apiCsvLabel: "WhatsApp conversations started",
    definitiveProof: true,
    aliases: ["whatsapp conversations started", "whatsapp conversation started"],
  },
  {
    key: "instagram_dm_leads",
    resultLabel: "INSTAGRAM DM LEADS",
    costLabel: "COST PER CONVERSATION",
    isReach: false,
    canonicalText: "Instagram DM",
    apiCsvLabel: "Instagram conversation",
    definitiveProof: true,
    aliases: ["instagram conversation", "instagram conversations", "instagram dm"],
  },
  {
    key: "phone_calls",
    resultLabel: "PHONE CALLS",
    costLabel: "COST PER CALL",
    isReach: false,
    canonicalText: "Phone call",
    apiCsvLabel: "Phone call",
    definitiveProof: true,
    aliases: [
      "phone_call",
      "phone call",
      "phone_call_confirm",
      "click_to_call",
      "call_confirm",
      "call placed",
    ],
  },
  {
    key: "appointment_leads",
    resultLabel: "APPOINTMENT LEADS",
    costLabel: "COST PER BOOKING",
    isReach: false,
    canonicalText: "Appointment",
    apiCsvLabel: "Schedule",
    definitiveProof: true,
    aliases: [
      "schedule",
      "appointment",
      "appointments",
      "booking",
      "bookings",
      "offsite_conversion.fb_pixel_schedule",
    ],
  },
  {
    key: "registrations",
    resultLabel: "REGISTRATIONS",
    costLabel: "COST PER REGISTRATION",
    isReach: false,
    canonicalText: "Registration",
    apiCsvLabel: "Complete registration",
    definitiveProof: true,
    aliases: [
      "complete registration",
      "complete_registration",
      "registration",
      "registrations",
      "omni_complete_registration",
      "offsite_conversion.fb_pixel_complete_registration",
    ],
  },
  {
    key: "applications",
    resultLabel: "APPLICATIONS",
    costLabel: "COST PER APPLICATION",
    isReach: false,
    canonicalText: "Application",
    apiCsvLabel: "Submit application",
    definitiveProof: true,
    aliases: [
      "submit application",
      "submit_application",
      "application",
      "applications",
      "offsite_conversion.fb_pixel_submit_application",
    ],
  },
  {
    key: "subscriptions",
    resultLabel: "SUBSCRIPTIONS",
    costLabel: "COST PER SUBSCRIPTION",
    isReach: false,
    canonicalText: "Subscription",
    apiCsvLabel: "Subscribe",
    definitiveProof: true,
    aliases: [
      "subscribe",
      "subscription",
      "subscriptions",
      "recurring_subscription_payment_made",
      "offsite_conversion.fb_pixel_subscribe",
      "start trial",
      "start_trial",
      "offsite_conversion.fb_pixel_start_trial",
    ],
  },
  {
    key: "quote_requests",
    resultLabel: "QUOTE REQUESTS",
    costLabel: "COST PER QUOTE",
    isReach: false,
    canonicalText: "Quote request",
    apiCsvLabel: "Quote request",
    definitiveProof: true,
    aliases: ["quote_request", "quote request"],
  },
  {
    key: "app_events",
    resultLabel: "APP EVENTS",
    costLabel: "COST PER APP EVENT",
    isReach: false,
    canonicalText: "App event",
    apiCsvLabel: "App event",
    definitiveProof: true,
    aliases: ["app_event", "app event", "in-app purchase", "in app purchase"],
  },
  {
    key: "app_installs",
    resultLabel: "APP INSTALLS",
    costLabel: "COST PER INSTALL",
    isReach: false,
    canonicalText: "App install",
    apiCsvLabel: "App installs",
    definitiveProof: true,
    aliases: [
      "mobile_app_install",
      "omni_app_install",
      "app_install",
      "app install",
      "app installs",
      "mobile app install",
      "mobile app installs",
      "offsite_conversion.fb_mobile_activate_app",
    ],
  },
  {
    key: "link_clicks",
    resultLabel: "LINK CLICKS",
    costLabel: "COST PER CLICK",
    isReach: false,
    canonicalText: "Link click",
    apiCsvLabel: "Link clicks",
    aliases: ["link_click", "link click", "link clicks", "outbound_click", "outbound clicks", "outbound click"],
  },
  {
    key: "landing_page_views",
    resultLabel: "LANDING PAGE VIEWS",
    costLabel: "COST PER LPV",
    isReach: false,
    canonicalText: "Landing page view",
    apiCsvLabel: "Landing page view",
    aliases: ["landing_page_view", "landing page view", "landing page views", "lpv"],
  },
  {
    key: "video_views",
    resultLabel: "VIDEO VIEWS",
    costLabel: "COST PER VIDEO VIEW",
    isReach: false,
    canonicalText: "Video view",
    apiCsvLabel: "Video views",
    aliases: [
      "video_view",
      "video views",
      "video view",
      "video play",
      "video plays",
      "thruplay",
      "thruplays",
      "video_plays_at_least_2_secs",
      "2_second_continuous_video_plays",
    ],
  },
  {
    key: "post_engagements",
    resultLabel: "POST ENGAGEMENTS",
    costLabel: "COST PER ENGAGEMENT",
    isReach: false,
    canonicalText: "Post engagement",
    apiCsvLabel: "Post engagements",
    aliases: [
      "post_engagement",
      "post engagement",
      "post engagements",
      "page_engagement",
      "engagement",
      "engagements",
      "onsite_conversion.post_save",
    ],
  },
  {
    key: "page_likes",
    resultLabel: "PAGE LIKES",
    costLabel: "COST PER PAGE LIKE",
    isReach: false,
    canonicalText: "Page like",
    apiCsvLabel: "Page likes",
    aliases: ["page_like", "page like", "page likes"],
  },
  {
    key: "followers",
    resultLabel: "FOLLOWERS",
    costLabel: "COST PER FOLLOW",
    isReach: false,
    canonicalText: "Follow",
    apiCsvLabel: "Follow",
    aliases: ["follow", "follower", "followers"],
  },
  {
    key: "event_responses",
    resultLabel: "EVENT RESPONSES",
    costLabel: "COST PER RESPONSE",
    isReach: false,
    canonicalText: "Event response",
    apiCsvLabel: "Event response",
    aliases: ["event_response", "event response", "event responses"],
  },
  {
    key: "profile_visits",
    resultLabel: "PROFILE VISITS",
    costLabel: "COST PER VISIT",
    isReach: false,
    canonicalText: "Profile visit",
    apiCsvLabel: "Instagram profile visit",
    aliases: [
      "instagram_profile_visit",
      "instagram profile visit",
      "profile visit",
      "profile visits",
      "photo_view",
      "photo view",
      "check_in",
      "check-in",
      "check in",
    ],
  },
  {
    key: "reach",
    resultLabel: "REACH",
    costLabel: "COST PER 1K REACH",
    isReach: true,
    canonicalText: "Reach",
    apiCsvLabel: "Reach",
    aliases: ["reach", "people reached"],
  },
  {
    key: "impressions",
    resultLabel: "IMPRESSIONS",
    costLabel: "CPM",
    isReach: true,
    canonicalText: "Impression",
    apiCsvLabel: "Impressions",
    aliases: ["impressions", "impression", "cpm"],
  },
  {
    key: "ad_recall_lift",
    resultLabel: "AD RECALL LIFT",
    costLabel: "COST PER RECALL LIFT",
    isReach: true,
    canonicalText: "Ad recall",
    apiCsvLabel: "Ad recall lift",
    aliases: ["ad_recall_lift", "estimated_ad_recall_lift", "ad recall", "recall lift"],
  },
  {
    key: "conversions",
    resultLabel: "CONVERSIONS",
    costLabel: "COST PER CONVERSION",
    isReach: false,
    canonicalText: "Custom conversion",
    apiCsvLabel: "Custom conversion",
    definitiveProof: false,
    aliases: [
      "conversions",
      "custom conversion",
      "custom conversions",
      "offsite_conversion",
      "onsite_conversion",
      "onsite_conversion.flow_complete",
    ],
  },
  {
    key: "group_joins",
    resultLabel: "GROUP JOINS",
    costLabel: "COST PER JOIN",
    isReach: false,
    canonicalText: "Group join",
    apiCsvLabel: "Join group",
    definitiveProof: true,
    aliases: ["join_group", "join group"],
  },
  {
    key: "store_visits",
    resultLabel: "STORE VISITS",
    costLabel: "COST PER STORE VISIT",
    isReach: false,
    canonicalText: "Store visit",
    apiCsvLabel: "Store visit",
    definitiveProof: true,
    aliases: ["store_visit", "store visit", "store visits", "onsite_conversion.store_visit"],
  },
  {
    key: "leads",
    resultLabel: "LEADS",
    costLabel: "COST PER LEAD",
    isReach: false,
    canonicalText: "Lead",
    apiCsvLabel: "Leads",
    definitiveProof: false,
    aliases: ["leads"],
  },
  {
    key: "donate",
    resultLabel: "DONATIONS",
    costLabel: "COST PER DONATION",
    isReach: false,
    canonicalText: "Donate",
    apiCsvLabel: "Donate",
    definitiveProof: true,
    aliases: ["donate", "donation", "donations", "offsite_conversion.fb_pixel_donate"],
  },
  {
    key: "find_location",
    resultLabel: "FIND LOCATION",
    costLabel: "COST PER LOCATION",
    isReach: false,
    canonicalText: "Find location",
    apiCsvLabel: "Find location",
    definitiveProof: true,
    aliases: ["find location", "find_location", "offsite_conversion.fb_pixel_find_location"],
  },
];

/** Meta Marketing API action_type → human-readable Result type (CSV pipeline input). */
export const META_API_ACTION_TO_CSV: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const spec of META_OBJECTIVE_SPECS) {
    if (!spec.apiCsvLabel) continue;
    for (const alias of spec.aliases) {
      if (alias.includes(".") || alias.includes("_")) {
        map[alias] = spec.apiCsvLabel;
      }
    }
  }
  // Explicit API-only action types not covered by alias heuristics above.
  const extras: Record<string, string> = {
    link_click: "Link clicks",
    purchase: "Purchase",
    omni_purchase: "Purchase",
    "offsite_conversion.fb_pixel_purchase": "Purchase",
    lead: "Leads",
    "offsite_conversion.fb_pixel_lead": "Website leads",
    website_lead: "Website leads",
    onsite_web_lead: "Website leads",
    "onsite_conversion.lead_grouped": "Leads (form)",
    "onsite_conversion.lead": "Leads (form)",
    leadgen_grouped: "Leads (form)",
    "onsite_conversion.messaging_conversation_started_7d": "Messaging conversations started",
    messaging_conversation_started_7d: "Messaging conversations started",
    "onsite_conversion.messaging_first_reply_7d": "Messaging conversations started",
    new_messaging_connection: "Messaging conversations started",
    whatsapp_message_send: "Messaging conversations started",
    landing_page_view: "Landing page view",
    mobile_app_install: "App installs",
    omni_app_install: "App installs",
    post_engagement: "Post engagements",
    page_like: "Page likes",
    video_view: "Video views",
    thruplay: "Video views",
    omni_complete_registration: "Complete registration",
    "offsite_conversion.fb_pixel_complete_registration": "Complete registration",
    "offsite_conversion.fb_pixel_add_payment_info": "Add payment info",
    "offsite_conversion.fb_pixel_submit_application": "Submit application",
    "offsite_conversion.fb_pixel_subscribe": "Subscribe",
    "offsite_conversion.fb_pixel_schedule": "Schedule",
    "offsite_conversion.fb_pixel_donate": "Donate",
    "offsite_conversion.fb_pixel_find_location": "Find location",
    "offsite_conversion.fb_pixel_start_trial": "Start trial",
    outbound_click: "Outbound clicks",
    initiate_checkout: "Initiate checkout",
    add_to_cart: "Add to cart",
    view_content: "View content",
    click_to_call: "Phone call",
    reach: "Reach",
    impressions: "Impressions",
  };
  return { ...map, ...extras };
})();

export function buildResultTypeMap(): Record<string, ObjectiveInfo> {
  const out: Record<string, ObjectiveInfo> = {};
  for (const spec of META_OBJECTIVE_SPECS) {
    const info: ObjectiveInfo = {
      key: spec.key,
      resultLabel: spec.resultLabel,
      costLabel: spec.costLabel,
      isReach: spec.isReach,
    };
    for (const alias of spec.aliases) {
      out[alias.toLowerCase().trim()] = info;
    }
  }
  return out;
}

const specByKey = new Map(META_OBJECTIVE_SPECS.map((s) => [s.key, s]));

/** Alias → objective key for Step 0 definitive-proof lookups. */
export const DEFINITIVE_PROOF_ALIAS_TO_KEY: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>();
  for (const spec of META_OBJECTIVE_SPECS) {
    if (!spec.definitiveProof) continue;
    for (const alias of spec.aliases) {
      map.set(alias.toLowerCase().trim(), spec.key);
    }
  }
  return map;
})();

export function metaApiActionToCsvResultType(actionType: string): string {
  return META_API_ACTION_TO_CSV[actionType] ?? actionType.replace(/_/g, " ");
}

export function resolveDefinitiveObjectiveFromRows(
  rows: readonly { result_type?: string | null }[],
  lookup: (resultType: string) => ObjectiveInfo | null,
): ObjectiveInfo | null {
  const foundKeys = new Set<string>();
  const keyToInfo = new Map<string, ObjectiveInfo>();

  for (const row of rows) {
    const rt = (row.result_type || "").toLowerCase().trim();
    if (!rt) continue;
    const proofKey = DEFINITIVE_PROOF_ALIAS_TO_KEY.get(rt);
    if (!proofKey) continue;
    const info = lookup(rt);
    if (!info) continue;
    foundKeys.add(proofKey);
    keyToInfo.set(proofKey, info);
  }

  if (foundKeys.size === 0) return null;

  for (const priorityKey of DEFINITIVE_PROOF_PRIORITY) {
    if (foundKeys.has(priorityKey)) {
      return keyToInfo.get(priorityKey)!;
    }
  }

  return keyToInfo.values().next().value ?? null;
}

/** When every non-blank result_type maps to the same objective, trust it even if blank rows are the majority. */
export function resolveUniqueMappedObjectiveFromRows(
  rows: readonly { result_type?: string | null }[],
  lookup: (resultType: string) => ObjectiveInfo | null,
): ObjectiveInfo | null {
  const byKey = new Map<string, { info: ObjectiveInfo; count: number }>();
  let blankCount = 0;
  for (const row of rows) {
    const rt = (row.result_type || "").toLowerCase().trim();
    if (!rt) {
      blankCount++;
      continue;
    }
    const info = lookup(rt);
    if (!info) continue;
    const existing = byKey.get(info.key);
    if (existing) existing.count++;
    else byKey.set(info.key, { info, count: 1 });
    if (byKey.size > 1) return null;
  }
  if (byKey.size !== 1) return null;
  const only = byKey.values().next().value!;
  // A single stray typed row among mostly-blank rows must not override column detection.
  if (only.count <= blankCount && only.count < 2) return null;
  return only.info;
}

export function specForObjectiveKey(key: string): MetaObjectiveSpec | undefined {
  return specByKey.get(key);
}
