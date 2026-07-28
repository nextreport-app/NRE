/**
 * NRE v1 — delivery status detection for the MTD chart slide's active-
 * campaign count. Not part of the ported Apps Script (new, spec-driven):
 * a campaign only counts as "active" when at least one of its rows reports
 * an active-ish delivery status; otherwise the chart shows a small
 * "Paused"/"Inactive" indicator instead.
 */

export type DeliveryStatusIndicator = "Paused" | "Inactive" | null;

/**
 * True when the status reads as actively delivering — includes Meta's
 * "active_with_issues" (contains "active" as a substring, so no separate
 * check needed). The exclusion check runs first and short-circuits:
 * "not_delivering" contains the substring "delivering", so a naive
 * inclusion-only check would misclassify it.
 */
export function isActiveDeliveryStatus(status: string | null | undefined): boolean {
  const s = (status || "").toLowerCase().trim();
  if (!s) return false;
  if (/not.?deliver|inactive|paused|archived/.test(s)) return false;
  return /active|deliver/.test(s);
}

/** True for Meta's "archived" delivery status specifically — distinct from the generic Inactive bucket because report-data.ts's ad-set slide filter excludes archived ad sets unconditionally, regardless of spend (see Fix 3), not just because they're non-active. */
export function isArchivedDeliveryStatus(status: string | null | undefined): boolean {
  return /archived/.test((status || "").toLowerCase().trim());
}

/** Small on-chart label for a non-active status — null when active, blank, or unrecognized (never guess). "archived" counts as Inactive here so a campaign made up entirely of archived ad sets still resolves to a real badge instead of silently showing none. */
export function deliveryStatusIndicator(status: string | null | undefined): DeliveryStatusIndicator {
  const s = (status || "").toLowerCase().trim();
  if (!s) return null;
  if (/paused/.test(s)) return "Paused";
  if (/not.?deliver|inactive|archived/.test(s)) return "Inactive";
  return null;
}

/**
 * Campaign-level indicator across every ad set's status. A campaign counts
 * as active if AT LEAST ONE ad set is actively delivering — one active ad
 * set is enough to keep the whole campaign off the Inactive/Paused badge,
 * even if every other ad set in it is paused/inactive/archived. Only when
 * EVERY ad set is non-active does the campaign get a badge: "Paused" if any
 * of them is explicitly paused (the more specific, actionable state),
 * otherwise "Inactive".
 *
 * Previously this returned a badge the moment ANY ad set was non-active,
 * which put an Inactive/Paused tag on campaigns that were still very much
 * running (just with one paused ad set among several active ones) — the
 * `some(isActiveDeliveryStatus)` short-circuit below is the fix.
 */
export function campaignStatusIndicator(statuses: (string | null | undefined)[]): DeliveryStatusIndicator {
  if (statuses.some((s) => isActiveDeliveryStatus(s))) return null;
  const indicators = statuses.map(deliveryStatusIndicator);
  if (indicators.includes("Paused")) return "Paused";
  if (indicators.includes("Inactive")) return "Inactive";
  return null;
}
