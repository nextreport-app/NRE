/**
 * NEXTREPORT ENGINE (NRE v1) — COMPLETE METRIC DICTIONARY
 * Built from actual Meta Ads Manager (388 columns) and Google Ads (141 columns)
 * exports provided by the product owner.
 *
 * Structure per entry:
 *   key:         internal normalised field name used throughout the codebase
 *   label:       client-facing display label on the PPT slide card
 *   type:        currency | number | percentage | ratio | time | text
 *   section:     primary (always shown if present) | secondary (shown only if in CSV)
 *   priority:    order of display within section (lower = shown first)
 *   platforms:   ['meta'] | ['google'] | ['meta','google']
 *   variants:    array of all known column name variations (lowercase, trimmed)
 */

const NRE_DICTIONARY = {

  // ══════════════════════════════════════════════════════════════════════
  // UNIVERSAL — appear in both Meta and Google exports
  // ══════════════════════════════════════════════════════════════════════

  campaign_name: {
    label: 'Campaign', type: 'text', section: 'meta', priority: 0,
    platforms: ['meta', 'google'],
    variants: ['campaign name', 'campaign', 'campaign id']
  },
  ad_set_name: {
    label: 'Ad Set / Ad Group', type: 'text', section: 'meta', priority: 0,
    platforms: ['meta', 'google'],
    variants: ['ad set name', 'adset name', 'ad group', 'ad group name', 'ad group id']
  },

  // ══════════════════════════════════════════════════════════════════════
  // META ADS — PRIMARY METRICS (always displayed if present)
  // Source: NRE Library-Meta Metrics-Core
  // ══════════════════════════════════════════════════════════════════════

  spend: {
    label: 'AD SPEND', type: 'currency', section: 'primary', priority: 1,
    platforms: ['meta'],
    variants: [
      'amount spent (usd)', 'amount spent (inr)', 'amount spent', 'spend', 'cost',
      'total spend', 'budget spent'
    ]
  },
  impressions: {
    label: 'IMPRESSIONS', type: 'number', section: 'primary', priority: 2,
    platforms: ['meta'],
    variants: ['impressions', 'gross impressions']
  },
  reach: {
    label: 'REACH', type: 'number', section: 'primary', priority: 3,
    platforms: ['meta'],
    variants: ['reach', 'people reached', 'unique reach']
  },
  results: {
    label: 'RESULTS', type: 'number', section: 'primary', priority: 4,
    platforms: ['meta'],
    variants: ['results', 'meta leads', 'leads', 'conversions', 'result']
  },
  cost_per_result: {
    label: 'COST PER RESULT', type: 'currency', section: 'primary', priority: 5,
    platforms: ['meta'],
    variants: [
      'cost per result', 'cost per lead', 'cost per meta lead', 'cost per landing page view',
      'cost per purchase', 'cost per link click', 'cost per conversion'
    ]
  },
  frequency: {
    label: 'FREQUENCY', type: 'number', section: 'primary', priority: 6,
    platforms: ['meta'],
    variants: ['frequency', 'ad frequency']
  },
  link_clicks: {
    label: 'LINK CLICKS', type: 'number', section: 'primary', priority: 7,
    platforms: ['meta'],
    variants: [
      'link clicks', 'clicks (link)', 'outbound clicks', 'unique link clicks',
      'unique outbound clicks', 'clicks (all)', 'clicks'
    ]
  },
  cpc: {
    label: 'CPC (ALL)', type: 'currency', section: 'primary', priority: 8,
    platforms: ['meta'],
    variants: [
      'cpc (all)', 'cpc (cost per link click)', 'cost per link click',
      'average cpc', 'avg. cpc', 'cpc'
    ]
  },
  cpm: {
    label: 'CPM', type: 'currency', section: 'primary', priority: 9,
    platforms: ['meta'],
    variants: [
      'cpm (cost per 1,000 impressions)', 'cpm (cost per 1000 impressions)',
      'cost per 1,000 impressions', 'cpm'
    ]
  },
  ctr: {
    label: 'CTR (ALL)', type: 'percentage', section: 'primary', priority: 10,
    platforms: ['meta'],
    variants: [
      'ctr (all)', 'ctr (link click-through rate)', 'click-through rate (all)',
      'outbound ctr (click-through rate)', 'unique ctr (link click-through rate)', 'ctr'
    ]
  },
  result_type: {
    label: 'RESULT TYPE', type: 'text', section: 'meta', priority: 0,
    platforms: ['meta'],
    variants: ['result type', 'objective', 'optimization goal', 'result value type']
  },

  // ══════════════════════════════════════════════════════════════════════
  // META ADS — SECONDARY METRICS (shown only when present in CSV)
  // ══════════════════════════════════════════════════════════════════════

  landing_page_views: {
    label: 'LANDING PAGE VIEWS', type: 'number', section: 'secondary', priority: 11,
    platforms: ['meta'],
    variants: ['landing page views', 'lpv', 'landing page view']
  },
  cost_per_lpv: {
    label: 'COST PER LPV', type: 'currency', section: 'secondary', priority: 12,
    platforms: ['meta'],
    variants: ['cost per landing page view', 'cost per lpv']
  },
  meta_leads: {
    label: 'META LEADS', type: 'number', section: 'secondary', priority: 13,
    platforms: ['meta'],
    variants: ['meta leads', 'instant form leads', 'form leads']
  },
  website_leads: {
    label: 'WEBSITE LEADS', type: 'number', section: 'secondary', priority: 14,
    platforms: ['meta'],
    variants: ['website leads', 'website form leads', 'web leads']
  },
  cost_per_lead: {
    label: 'COST PER LEAD', type: 'currency', section: 'secondary', priority: 15,
    platforms: ['meta'],
    variants: ['cost per meta lead', 'cost per web lead']
  },
  purchases: {
    label: 'PURCHASES', type: 'number', section: 'secondary', priority: 16,
    platforms: ['meta'],
    variants: [
      'purchases', 'website purchases', 'purchase conversions',
      'purchase', 'purchases conversion value'
    ]
  },
  purchase_roas: {
    label: 'ROAS', type: 'ratio', section: 'secondary', priority: 17,
    platforms: ['meta'],
    variants: [
      'purchase roas (return on ad spend)', 'purchase roas', 'roas',
      'return on ad spend', 'results roas', 'results value'
    ]
  },
  purchase_value: {
    label: 'PURCHASE VALUE', type: 'currency', section: 'secondary', priority: 18,
    platforms: ['meta'],
    variants: [
      'purchases conversion value', 'purchase conversion value',
      'average purchases conversion value', 'conversion value'
    ]
  },
  cost_per_purchase: {
    label: 'COST PER PURCHASE', type: 'currency', section: 'secondary', priority: 19,
    platforms: ['meta'],
    variants: ['cost per purchase']
  },
  add_to_cart: {
    label: 'ADD TO CART', type: 'number', section: 'secondary', priority: 20,
    platforms: ['meta'],
    variants: ['add to cart', 'adds to cart', 'add-to-cart']
  },
  cost_per_atc: {
    label: 'COST PER ADD TO CART', type: 'currency', section: 'secondary', priority: 21,
    platforms: ['meta'],
    variants: ['cost per add to cart', 'cost per adds to cart']
  },
  initiate_checkout: {
    label: 'INITIATE CHECKOUT', type: 'number', section: 'secondary', priority: 22,
    platforms: ['meta'],
    variants: ['initiate checkout', 'checkouts initiated', 'initiate checkouts']
  },
  cost_per_checkout: {
    label: 'COST PER CHECKOUT', type: 'currency', section: 'secondary', priority: 23,
    platforms: ['meta'],
    variants: ['cost per initiated checkout', 'cost per initiate checkout', 'cost per checkout']
  },
  // Video metrics
  video_plays: {
    label: 'VIDEO PLAYS', type: 'number', section: 'secondary', priority: 30,
    platforms: ['meta'],
    variants: [
      'video plays', '3-second video plays', 'thruplays', '2-second continuous video plays',
      'unique 2-second continuous video plays', 'views'
    ]
  },
  video_avg_play_time: {
    label: 'AVG. WATCH TIME', type: 'time', section: 'secondary', priority: 31,
    platforms: ['meta'],
    variants: ['video average play time', 'avg. watch time']
  },
  cost_per_thruplay: {
    label: 'COST PER THRUPLAY', type: 'currency', section: 'secondary', priority: 32,
    platforms: ['meta'],
    variants: [
      'cost per thruplay', 'cost per 3-second video play',
      'cost per 2-second continuous video play'
    ]
  },
  video_p25: {
    label: 'VIDEO VIEWS 25%', type: 'number', section: 'secondary', priority: 33,
    platforms: ['meta'],
    variants: ['video plays at 25%', 'video watched at 25%']
  },
  video_p50: {
    label: 'VIDEO VIEWS 50%', type: 'number', section: 'secondary', priority: 34,
    platforms: ['meta'],
    variants: ['video plays at 50%', 'video watched at 50%']
  },
  video_p75: {
    label: 'VIDEO VIEWS 75%', type: 'number', section: 'secondary', priority: 35,
    platforms: ['meta'],
    variants: ['video plays at 75%', 'video watched at 75%']
  },
  video_p95: {
    label: 'VIDEO VIEWS 95%', type: 'number', section: 'secondary', priority: 36,
    platforms: ['meta'],
    variants: ['video plays at 95%', 'video watched at 95%']
  },
  video_p100: {
    label: 'VIDEO COMPLETIONS', type: 'number', section: 'secondary', priority: 37,
    platforms: ['meta'],
    variants: ['video plays at 100%', 'video completions', 'video watched at 100%']
  },
  // Engagement metrics
  post_engagements: {
    label: 'POST ENGAGEMENTS', type: 'number', section: 'secondary', priority: 40,
    platforms: ['meta'],
    variants: ['post engagements', 'page engagement', 'post reactions', 'engagements']
  },
  post_shares: {
    label: 'POST SHARES', type: 'number', section: 'secondary', priority: 41,
    platforms: ['meta'],
    variants: ['post shares']
  },
  post_saves: {
    label: 'POST SAVES', type: 'number', section: 'secondary', priority: 42,
    platforms: ['meta'],
    variants: ['post saves']
  },
  post_comments: {
    label: 'POST COMMENTS', type: 'number', section: 'secondary', priority: 43,
    platforms: ['meta'],
    variants: ['post comments']
  },
  fb_page_likes: {
    label: 'PAGE LIKES', type: 'number', section: 'secondary', priority: 44,
    platforms: ['meta'],
    variants: ['facebook likes', 'page likes', 'new page likes']
  },
  ig_follows: {
    label: 'IG FOLLOWS', type: 'number', section: 'secondary', priority: 45,
    platforms: ['meta'],
    variants: ['instagram follows']
  },
  cost_per_engagement: {
    label: 'COST PER ENGAGEMENT', type: 'currency', section: 'secondary', priority: 46,
    platforms: ['meta'],
    variants: ['cost per page engagement', 'cost per post engagement', 'cost per like']
  },
  // Messaging metrics
  messaging_convos: {
    label: 'MESSAGES STARTED', type: 'number', section: 'secondary', priority: 50,
    platforms: ['meta'],
    variants: [
      'messaging conversations started', 'new messaging contacts',
      'messaging subscriptions', 'welcome message views',
      'messaging conversations replied'
    ]
  },
  cost_per_message: {
    label: 'COST PER MESSAGE', type: 'currency', section: 'secondary', priority: 51,
    platforms: ['meta'],
    variants: [
      'cost per messaging conversation started', 'cost per new messaging contact',
      'cost per messaging subscription'
    ]
  },
  // App metrics
  app_installs: {
    label: 'APP INSTALLS', type: 'number', section: 'secondary', priority: 55,
    platforms: ['meta'],
    variants: ['app installs', 'mobile app installs']
  },
  // Reach cost
  cp1k_reach: {
    label: 'CP 1K REACH', type: 'currency', section: 'secondary', priority: 60,
    platforms: ['meta'],
    variants: [
      'cost per 1,000 people reached', 'cost per 1k reach', 'cpm reach',
      'cost per 1,000 meta accounts reached'
    ]
  },
  // Phone calls
  phone_calls: {
    label: 'PHONE CALLS', type: 'number', section: 'secondary', priority: 65,
    platforms: ['meta'],
    variants: [
      '20-second phone calls', '60-second phone calls',
      'phone calls placed', 'callback requests submitted',
      '20-second messenger calls', '60-second messenger calls', 'messenger calls placed'
    ]
  },
  // Quality
  quality_ranking: {
    label: 'QUALITY RANKING', type: 'text', section: 'secondary', priority: 70,
    platforms: ['meta'],
    variants: ['quality ranking']
  },
  engagement_ranking: {
    label: 'ENGAGEMENT RANKING', type: 'text', section: 'secondary', priority: 71,
    platforms: ['meta'],
    variants: ['engagement rate ranking']
  },
  conv_rate_ranking: {
    label: 'CONV. RATE RANKING', type: 'text', section: 'secondary', priority: 72,
    platforms: ['meta'],
    variants: ['conversion rate ranking']
  },
  // Date fields
  date_start: {
    label: 'DATE START', type: 'text', section: 'meta', priority: 0,
    platforms: ['meta'],
    variants: ['reporting starts', 'starts', 'date start', 'start date', 'from date']
  },
  date_end: {
    label: 'DATE END', type: 'text', section: 'meta', priority: 0,
    platforms: ['meta'],
    variants: ['reporting ends', 'ends', 'date end', 'end date', 'to date']
  },
  day: {
    label: 'DAY', type: 'text', section: 'meta', priority: 0,
    platforms: ['meta'],
    variants: ['day', 'date']
  },

  // ══════════════════════════════════════════════════════════════════════
  // GOOGLE ADS — PRIMARY METRICS
  // Source: NRE Library-Google Metrics + Core
  // ═════════════════════════════════════════════════════════════════════

  g_cost: {
    label: 'COST (SPEND)', type: 'currency', section: 'primary', priority: 1,
    platforms: ['google'],
    variants: ['cost', 'spend', 'total cost', 'measurable cost']
  },
  g_clicks: {
    label: 'CLICKS', type: 'number', section: 'primary', priority: 2,
    platforms: ['google'],
    variants: ['clicks', 'interactions']
  },
  g_impressions: {
    label: 'IMPRESSIONS', type: 'number', section: 'primary', priority: 3,
    platforms: ['google'],
    variants: ['impr.', 'impressions', 'viewable impr.', 'measurable impr.']
  },
  g_ctr: {
    label: 'CTR', type: 'percentage', section: 'primary', priority: 4,
    platforms: ['google'],
    variants: ['ctr', 'click-through rate', 'interaction rate', 'viewable ctr']
  },
  g_avg_cpc: {
    label: 'AVG. CPC', type: 'currency', section: 'primary', priority: 5,
    platforms: ['google'],
    variants: ['avg. cpc', 'average cpc', 'avg. cost', 'avg. cpe']
  },
  g_conversions: {
    label: 'CONVERSIONS', type: 'number', section: 'primary', priority: 6,
    platforms: ['google'],
    variants: [
      'conversions', 'all conv.', 'purchase conversions', 'purchase',
      'results', 'conversions (by conv. time)'
    ]
  },
  g_cost_per_conv: {
    label: 'COST / CONV.', type: 'currency', section: 'primary', priority: 7,
    platforms: ['google'],
    variants: [
      'cost / conv.', 'cost per conversion', 'cpa', 'cost / all conv.',
      'customer acquisition cost'
    ]
  },

  // ══════════════════════════════════════════════════════════════════════
  // GOOGLE ADS — SECONDARY METRICS
  // ══════════════════════════════════════════════════════════════════════

  g_conv_rate: {
    label: 'CONV. RATE', type: 'percentage', section: 'secondary', priority: 11,
    platforms: ['google'],
    variants: ['conv. rate', 'conversion rate', 'all conv. rate']
  },
  g_conv_value: {
    label: 'CONV. VALUE', type: 'currency', section: 'secondary', priority: 12,
    platforms: ['google'],
    variants: [
      'conv. value', 'conversion value', 'all conv. value',
      'conv. value (by conv. time)', 'original conv. value', 'results value'
    ]
  },
  g_roas: {
    label: 'ROAS', type: 'ratio', section: 'secondary', priority: 13,
    platforms: ['google'],
    variants: [
      'conv. value / cost', 'all conv. value / cost', 'purchase roas',
      'roas', 'return on ad spend', 'avg. target roas'
    ]
  },
  g_value_per_conv: {
    label: 'VALUE / CONV.', type: 'currency', section: 'secondary', priority: 14,
    platforms: ['google'],
    variants: ['value / conv.', 'value / conv. (by conv. time)', 'value / all conv.']
  },
  g_revenue: {
    label: 'REVENUE', type: 'currency', section: 'secondary', priority: 15,
    platforms: ['google'],
    variants: ['revenue', 'lead revenue', 'results value']
  },
  g_avg_order_value: {
    label: 'AVG. ORDER VALUE', type: 'currency', section: 'secondary', priority: 16,
    platforms: ['google'],
    variants: ['avg. order value', 'average order value', 'aov']
  },
  g_orders: {
    label: 'ORDERS', type: 'number', section: 'secondary', priority: 17,
    platforms: ['google'],
    variants: ['orders', 'avg. cart size', 'units sold', 'lead units sold']
  },
  g_gross_profit: {
    label: 'GROSS PROFIT', type: 'currency', section: 'secondary', priority: 18,
    platforms: ['google'],
    variants: ['gross profit', 'lead gross profit', 'cross-sell gross profit', 'gross profit margin']
  },
  g_search_is: {
    label: 'SEARCH IMPR. SHARE', type: 'percentage', section: 'secondary', priority: 20,
    platforms: ['google'],
    variants: [
      'search impr. share', 'search impression share', 'impression share',
      'search top is', 'top of page rate'
    ]
  },
  g_lost_is_budget: {
    label: 'LOST IS (BUDGET)', type: 'percentage', section: 'secondary', priority: 21,
    platforms: ['google'],
    variants: ['search lost is (budget)', 'lost is (budget)']
  },
  g_lost_is_rank: {
    label: 'LOST IS (RANK)', type: 'percentage', section: 'secondary', priority: 22,
    platforms: ['google'],
    variants: ['search lost is (rank)', 'lost is (rank)']
  },
  g_view_through_conv: {
    label: 'VIEW-THROUGH CONV.', type: 'number', section: 'secondary', priority: 25,
    platforms: ['google'],
    variants: ['view-through conv.', 'cross-device conv.']
  },
  g_new_customers: {
    label: 'NEW CUSTOMERS', type: 'number', section: 'secondary', priority: 26,
    platforms: ['google'],
    variants: ['new customers', 'win-back customers']
  },
  // YouTube / Video
  g_views: {
    label: 'VIDEO VIEWS', type: 'number', section: 'secondary', priority: 30,
    platforms: ['google'],
    variants: ['views', 'video views', 'engagements']
  },
  g_view_rate: {
    label: 'VIEW RATE', type: 'percentage', section: 'secondary', priority: 31,
    platforms: ['google'],
    variants: [
      'view rate', 'trueview view rate (in-stream)', 'trueview view rate (in-feed)',
      'trueview view rate (shorts)', 'engagement rate', 'interaction rate'
    ]
  },
  g_cpv: {
    label: 'COST PER VIEW (CPV)', type: 'currency', section: 'secondary', priority: 32,
    platforms: ['google'],
    variants: ['avg. cpv', 'cost per view', 'avg. cpe']
  },
  // Quality
  g_quality_score: {
    label: 'QUALITY SCORE', type: 'number', section: 'secondary', priority: 40,
    platforms: ['google'],
    variants: ['qual. score', 'quality score', 'optimization score']
  },
  // Viewability
  g_viewable_rate: {
    label: 'VIEWABLE RATE', type: 'percentage', section: 'secondary', priority: 45,
    platforms: ['google'],
    variants: ['viewable rate', 'viewable impr. distrib.', 'measurable rate']
  },
};

/**
 * Build a fast lookup map: lowercase column name → internal key
 * Used by the CSV parser to map any incoming column to a known field.
 */
function buildColumnLookup() {
  const lookup = {};
  Object.entries(NRE_DICTIONARY).forEach(([key, entry]) => {
    entry.variants.forEach(variant => {
      lookup[variant.toLowerCase().trim()] = key;
    });
  });
  return lookup;
}

/**
 * Given a CSV header string, return the internal key or null if unknown.
 * Uses partial matching as fallback for slight naming variations.
 */
function detectColumn(headerRaw) {
  const h = (headerRaw || '').toLowerCase().trim();
  const lookup = buildColumnLookup();
  // Exact match first
  if (lookup[h]) return lookup[h];
  // Partial match — check if any variant is a substring of the header
  for (const [variant, key] of Object.entries(lookup)) {
    if (h.includes(variant) || variant.includes(h)) return key;
  }
  return null; // Unknown column — will be listed in unmatched report
}
