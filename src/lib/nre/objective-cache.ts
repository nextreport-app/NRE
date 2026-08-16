/**
 * Objective Confirmation memory cache — the persisted, per-client JSON blob
 * (Client.campaignObjectiveCache) that remembers every campaign objective a
 * user has confirmed (or accepted as pre-filled and clicked Continue on) on
 * the Objective Confirmation wizard step, across every report ever
 * generated for that client. Makes the step frictionless from the second
 * report onwards: a campaign found in the cache pre-selects instantly with
 * a "Previously confirmed" badge instead of asking the user to re-review
 * the engine's detection every single month.
 *
 * Cache values store the full {key, resultLabel, costLabel} triple (not
 * just objective.key, despite that being the more compact option) so a
 * cached objective always round-trips losslessly even for the rare case
 * where the engine's own detection falls outside result-type-map.ts's
 * common ~16-entry OBJECTIVE_DROPDOWN_OPTIONS list (e.g. "AD RECALL LIFT") —
 * reconstructing resultLabel/costLabel from a bare key alone would be lossy
 * for exactly those cases.
 */

import { normalizeCampaignName, type ResultLabels } from "./objective";

export interface CachedObjective extends ResultLabels {
  key: string;
}

/** Keyed by normalizeCampaignName (trimmed, lower-cased) — matches every other campaign-name map in this codebase (campaignObjectiveMap, buildCampaignObjectiveMap), so a cache lookup never misses purely on casing. */
export type ObjectiveCacheMap = Record<string, CachedObjective>;

function isCachedObjective(value: unknown): value is CachedObjective {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.key === "string" && typeof v.resultLabel === "string" && typeof v.costLabel === "string";
}

/** Parses Client.campaignObjectiveCache into a lookup map. Missing, null, malformed JSON, or any entry that doesn't match CachedObjective's shape is simply dropped/ignored — a corrupt or stale cache degrades to "nothing cached" rather than failing report generation. */
export function parseObjectiveCache(raw: string | null | undefined): ObjectiveCacheMap {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== "object") return {};

  const out: ObjectiveCacheMap = {};
  for (const [name, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (isCachedObjective(value)) {
      out[normalizeCampaignName(name)] = { key: value.key, resultLabel: value.resultLabel, costLabel: value.costLabel };
    }
  }
  return out;
}

/** Case-insensitive lookup — campaignName is normalized the same way the cache itself is keyed, so callers never need to normalize it themselves first. */
export function lookupCachedObjective(cache: ObjectiveCacheMap, campaignName: string): CachedObjective | null {
  return cache[normalizeCampaignName(campaignName)] ?? null;
}

/**
 * Merges newly confirmed per-campaign objectives into an existing serialized
 * cache, returning the new JSON string to persist. A campaign already in
 * `existingRaw` that's absent from `confirmed` keeps its old cached value
 * (this is a merge, not a replace) — only campaigns the user actually saw
 * on THIS report's Objective Confirmation step get written/overwritten.
 */
export function mergeObjectiveCache(
  existingRaw: string | null | undefined,
  confirmed: Record<string, CachedObjective>,
): string {
  const merged = parseObjectiveCache(existingRaw);
  for (const [name, info] of Object.entries(confirmed)) {
    merged[normalizeCampaignName(name)] = { key: info.key, resultLabel: info.resultLabel, costLabel: info.costLabel };
  }
  return JSON.stringify(merged);
}
