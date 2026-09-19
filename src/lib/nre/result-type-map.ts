/**
 * Exact result_type lookup for Meta (and shared TikTok) CSV + API-sync rows.
 * Aliases are defined once in meta-objective-dictionary.ts — this file adds
 * messaging label normalization and the wizard dropdown list.
 */

import {
  buildResultTypeMap,
  getMetaResultLabels,
  type ObjectiveInfo,
} from "./meta-objective-dictionary";
import { buildTikTokResultTypeAliases } from "./tiktok-objective-dictionary";

export type { ObjectiveInfo };

const META_RESULT_TYPE_MAP = buildResultTypeMap();

export const RESULT_TYPE_MAP: Record<string, ObjectiveInfo> = {
  ...META_RESULT_TYPE_MAP,
  ...buildTikTokResultTypeAliases(META_RESULT_TYPE_MAP),
};

/** Canonical messaging objective — one label everywhere (engine + dropdown). */
export const MESSAGING_OBJECTIVE: ObjectiveInfo = {
  key: "messaging",
  resultLabel: "MESSAGING / CONVERSATIONS",
  costLabel: "COST PER CONVERSATION",
  isReach: false,
};

const MESSAGING_LABEL_ALIASES = new Set([
  "MESSAGING LEADS",
  "CONVERSATIONS",
  "MESSAGING CONVERSATIONS STARTED",
  "MESSAGING / CONVERSATIONS",
]);

/** Collapses legacy/alternate messaging labels to the single dropdown label. */
export function normalizeObjectiveLabel(resultLabel: string): string {
  const upper = resultLabel.toUpperCase().trim();
  return MESSAGING_LABEL_ALIASES.has(upper) ? MESSAGING_OBJECTIVE.resultLabel : resultLabel;
}

/** Maps a detected resultLabel/costLabel pair to a dropdown ObjectiveInfo (never synthesizes a duplicate messaging option). */
export function objectiveInfoForDetectedLabel(resultLabel: string, costLabel: string): ObjectiveInfo {
  const normalized = normalizeObjectiveLabel(resultLabel);
  const match = OBJECTIVE_DROPDOWN_OPTIONS.find((o) => o.resultLabel === normalized);
  if (match) return match;
  return {
    key: normalized.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
    resultLabel: normalized,
    costLabel,
    isReach: false,
  };
}

function isMachineReadableResultType(resultType: string): boolean {
  return resultType.includes(".") || resultType.includes("_");
}

/**
 * Resolve a CSV/API `result_type` to an objective.
 *
 * 1. Case-insensitive exact alias match (Meta machine names + known export labels)
 * 2. For human-readable export text only: fuzzy substring catalog (spacing,
 *    casing, suffixes like "Submitted", near-synonyms)
 *
 * Machine-readable strings (dots/underscores) stay exact-only so fuzzy patterns
 * like `/leads?/` cannot misread API action names.
 */
export function resolveObjectiveFromResultType(resultType: string | null | undefined): ObjectiveInfo | null {
  if (!resultType) return null;
  const normalized = resultType.toLowerCase().trim();
  const exact = RESULT_TYPE_MAP[normalized];
  if (exact) {
    return {
      ...exact,
      resultLabel: normalizeObjectiveLabel(exact.resultLabel),
    };
  }

  if (isMachineReadableResultType(normalized)) return null;

  const fuzzy = getMetaResultLabels(resultType);
  if (fuzzy.resultLabel === "RESULTS") return null;

  return objectiveInfoForDetectedLabel(fuzzy.resultLabel, fuzzy.costLabel);
}

/**
 * Objective Confirmation dropdown — every objective a user can manually select.
 * `RESULTS` is deliberately last.
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
  { key: "impressions", resultLabel: "IMPRESSIONS", costLabel: "CPM", isReach: true },
  { key: "ad_recall_lift", resultLabel: "AD RECALL LIFT", costLabel: "COST PER RECALL LIFT", isReach: true },
  { key: "messaging", resultLabel: "MESSAGING / CONVERSATIONS", costLabel: "COST PER CONVERSATION", isReach: false },
  { key: "whatsapp_leads", resultLabel: "WHATSAPP LEADS", costLabel: "COST PER CONVERSATION", isReach: false },
  { key: "instagram_dm_leads", resultLabel: "INSTAGRAM DM LEADS", costLabel: "COST PER CONVERSATION", isReach: false },
  { key: "app_installs", resultLabel: "APP INSTALLS", costLabel: "COST PER INSTALL", isReach: false },
  { key: "post_engagements", resultLabel: "POST ENGAGEMENTS", costLabel: "COST PER ENGAGEMENT", isReach: false },
  { key: "page_likes", resultLabel: "PAGE LIKES", costLabel: "COST PER PAGE LIKE", isReach: false },
  { key: "followers", resultLabel: "FOLLOWERS", costLabel: "COST PER FOLLOW", isReach: false },
  { key: "phone_calls", resultLabel: "PHONE CALLS", costLabel: "COST PER CALL", isReach: false },
  { key: "appointment_leads", resultLabel: "APPOINTMENT LEADS", costLabel: "COST PER BOOKING", isReach: false },
  { key: "registrations", resultLabel: "REGISTRATIONS", costLabel: "COST PER REGISTRATION", isReach: false },
  { key: "applications", resultLabel: "APPLICATIONS", costLabel: "COST PER APPLICATION", isReach: false },
  { key: "subscriptions", resultLabel: "SUBSCRIPTIONS", costLabel: "COST PER SUBSCRIPTION", isReach: false },
  { key: "quote_requests", resultLabel: "QUOTE REQUESTS", costLabel: "COST PER QUOTE", isReach: false },
  { key: "event_responses", resultLabel: "EVENT RESPONSES", costLabel: "COST PER RESPONSE", isReach: false },
  { key: "store_visits", resultLabel: "STORE VISITS", costLabel: "COST PER STORE VISIT", isReach: false },
  { key: "donations", resultLabel: "DONATIONS", costLabel: "COST PER DONATION", isReach: false },
  { key: "find_location", resultLabel: "FIND LOCATION", costLabel: "COST PER LOCATION", isReach: false },
  { key: "payment_info", resultLabel: "PAYMENT INFO", costLabel: "COST PER PAYMENT INFO", isReach: false },
  { key: "app_events", resultLabel: "APP EVENTS", costLabel: "COST PER APP EVENT", isReach: false },
  { key: "profile_visits", resultLabel: "PROFILE VISITS", costLabel: "COST PER VISIT", isReach: false },
  { key: "group_joins", resultLabel: "GROUP JOINS", costLabel: "COST PER JOIN", isReach: false },
  { key: "content_views", resultLabel: "CONTENT VIEWS", costLabel: "COST PER VIEW", isReach: false },
  { key: "leads", resultLabel: "LEADS", costLabel: "COST PER LEAD", isReach: false },
  { key: "conversions", resultLabel: "CONVERSIONS", costLabel: "COST PER CONVERSION", isReach: false },
  { key: "results", resultLabel: "RESULTS", costLabel: "COST PER RESULT", isReach: false },
];
