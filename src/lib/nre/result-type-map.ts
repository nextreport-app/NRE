/**
 * Exact result_type lookup for Meta (and shared TikTok) CSV + API-sync rows.
 * Aliases are defined once in meta-objective-dictionary.ts — this file adds
 * messaging label normalization and the wizard dropdown list.
 */

import {
  buildResultTypeMap,
  type ObjectiveInfo,
} from "./meta-objective-dictionary";

export type { ObjectiveInfo };

export const RESULT_TYPE_MAP: Record<string, ObjectiveInfo> = buildResultTypeMap();

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

/** Case-insensitive exact-string lookup — `null` for anything not in RESULT_TYPE_MAP. */
export function resolveObjectiveFromResultType(resultType: string | null | undefined): ObjectiveInfo | null {
  if (!resultType) return null;
  const normalized = resultType.toLowerCase().trim();
  const info = RESULT_TYPE_MAP[normalized];
  if (!info) return null;
  return {
    ...info,
    resultLabel: normalizeObjectiveLabel(info.resultLabel),
  };
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
  { key: "messaging", resultLabel: "MESSAGING / CONVERSATIONS", costLabel: "COST PER CONVERSATION", isReach: false },
  { key: "app_installs", resultLabel: "APP INSTALLS", costLabel: "COST PER INSTALL", isReach: false },
  { key: "post_engagements", resultLabel: "POST ENGAGEMENTS", costLabel: "COST PER ENGAGEMENT", isReach: false },
  { key: "page_likes", resultLabel: "PAGE LIKES", costLabel: "COST PER PAGE LIKE", isReach: false },
  { key: "phone_calls", resultLabel: "PHONE CALLS", costLabel: "COST PER CALL", isReach: false },
  { key: "registrations", resultLabel: "REGISTRATIONS", costLabel: "COST PER REGISTRATION", isReach: false },
  { key: "applications", resultLabel: "APPLICATIONS", costLabel: "COST PER APPLICATION", isReach: false },
  { key: "subscriptions", resultLabel: "SUBSCRIPTIONS", costLabel: "COST PER SUBSCRIPTION", isReach: false },
  { key: "content_views", resultLabel: "CONTENT VIEWS", costLabel: "COST PER VIEW", isReach: false },
  { key: "results", resultLabel: "RESULTS", costLabel: "COST PER RESULT", isReach: false },
];
