/**
 * Meta Ads Manager objective matrix — synced from the owner's reference sheet:
 * Campaign objective → Conversion location → Performance goal → Conversion event.
 *
 * Used as a lookup table for API-sync hints and CI regression (every row must
 * resolve to a known engine objective key). Update
 * `reference/meta-campaign-objective-matrix.json` when the sheet changes.
 */

import matrixData from "./reference/meta-campaign-objective-matrix.json";

export interface MetaCampaignObjectiveMatrixRow {
  campaignObjective: string;
  conversionLocation: string | null;
  performanceGoal: string;
  conversionEvent: string | null;
}

export interface MetaCampaignObjectiveMatrix {
  sourceSheetId: string;
  performanceGoalRows: MetaCampaignObjectiveMatrixRow[];
  conversionEventRows: MetaCampaignObjectiveMatrixRow[];
}

export const META_CAMPAIGN_OBJECTIVE_MATRIX = matrixData as MetaCampaignObjectiveMatrix;

function norm(value: string | null | undefined): string {
  return String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/** Performance goal text (Meta Ads Manager UI) → engine objective key. */
const PERFORMANCE_GOAL_TO_KEY: Readonly<Record<string, string>> = {
  "maximise reach of ads": "reach",
  "maximise number of impressions": "impressions",
  "maximise ad recall lift": "ad_recall_lift",
  "maximise thruplay views": "video_views",
  "maximise 2-second continuous video plays": "video_views",
  "maximise number of link clicks": "link_clicks",
  "maximize link clicks": "link_clicks",
  "maximise number of landing page views": "landing_page_views",
  "maximise number of conversations": "messaging",
  "maximise number of calls": "phone_calls",
  "maximise number of instagram profile and facebook page visits": "profile_visits",
  "maximise engagement with a post": "post_engagements",
  "maximise number of page likes": "page_likes",
  "maximise number of event responses": "event_responses",
  "maximise number of leads": "leads",
  "maximise number of qualified leads": "qualified_leads",
  "maximise reminders set": "reminders",
  "maximise daily unique reach": "reach",
  "maximize number of app installs": "app_installs",
  "maximize number of app events": "app_events",
  "maximize pre-registration": "pre_registration",
  "maximise number of conversions": "conversions",
  "maximize number of conversions": "conversions",
  "maximise value of conversions": "conversions",
  "maximize value of conversions": "conversions",
  "maximise video views (thruplays)": "video_views",
};

/** Conversion event label (sheet / Ads Manager) → engine objective key. */
const CONVERSION_EVENT_TO_KEY: Readonly<Record<string, string>> = {
  purchase: "purchases",
  "add to cart": "add_to_cart",
  "initiate checkout": "initiate_checkout",
  "view content": "content_views",
  "content view": "content_views",
  donate: "donate",
  contact: "website_leads",
  schedule: "appointment_leads",
  "start trial": "subscriptions",
  "submit application": "applications",
  subscribe: "subscriptions",
  "add payment info": "payment_info",
  "complete registration": "registrations",
  registration: "registrations",
  lead: "leads",
  "app install": "app_installs",
  "conversion count": "conversions",
};

const INSTANT_FORM_LOCATIONS = new Set([
  "instant forms",
  "instant forms and messenger",
  "website and instant forms",
]);

const WEBSITE_LEAD_LOCATIONS = new Set([
  "website",
  "website and calls",
  "website and instant forms",
]);

const MESSAGING_LOCATIONS = new Set([
  "messenger",
  "message destinations",
  "whatsapp",
  "instant forms and messenger",
]);

export function objectiveKeyFromPerformanceGoal(performanceGoal: string): string | null {
  return PERFORMANCE_GOAL_TO_KEY[norm(performanceGoal)] ?? null;
}

export function objectiveKeyFromConversionEvent(
  conversionEvent: string,
  conversionLocation?: string | null,
): string | null {
  const key = CONVERSION_EVENT_TO_KEY[norm(conversionEvent)];
  if (!key) return null;
  if (key !== "leads") return key;

  const loc = norm(conversionLocation);
  if (INSTANT_FORM_LOCATIONS.has(loc)) return "meta_form_leads";
  if (WEBSITE_LEAD_LOCATIONS.has(loc)) return "website_leads";
  if (MESSAGING_LOCATIONS.has(loc)) return "messaging";
  return "leads";
}

/** Best-effort objective key for one matrix row — conversion event beats performance goal when present. */
export function objectiveKeyFromMatrixRow(row: MetaCampaignObjectiveMatrixRow): string | null {
  if (row.conversionEvent) {
    const fromEvent = objectiveKeyFromConversionEvent(row.conversionEvent, row.conversionLocation);
    if (fromEvent) return fromEvent;
  }

  const fromPerf = objectiveKeyFromPerformanceGoal(row.performanceGoal);
  if (!fromPerf) return null;

  if (fromPerf === "leads" || fromPerf === "conversions") {
    const loc = norm(row.conversionLocation);
    if (fromPerf === "leads") {
      if (INSTANT_FORM_LOCATIONS.has(loc)) return "meta_form_leads";
      if (WEBSITE_LEAD_LOCATIONS.has(loc)) return "website_leads";
      if (MESSAGING_LOCATIONS.has(loc)) return "messaging";
    }
    if (row.campaignObjective === "Catalogue sales") return "purchases";
  }

  return fromPerf;
}

/** Every performance-goal and conversion-event row in the reference sheet. */
export function allMetaCampaignObjectiveMatrixRows(): MetaCampaignObjectiveMatrixRow[] {
  return [
    ...META_CAMPAIGN_OBJECTIVE_MATRIX.performanceGoalRows,
    ...META_CAMPAIGN_OBJECTIVE_MATRIX.conversionEventRows,
  ];
}
