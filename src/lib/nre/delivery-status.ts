/**
 * NRE v1 — delivery status detection for the MTD chart slide's active-
 * campaign count. Not part of the ported Apps Script (new, spec-driven):
 * a campaign only counts as "active" when at least one of its rows reports
 * an active-ish delivery status; otherwise the chart shows a small
 * "Paused"/"Inactive" indicator instead.
 */

export type DeliveryStatusIndicator = "Paused" | "Inactive" | null;

/**
 * True when the status reads as actively delivering. The exclusion check
 * runs first and short-circuits: "not_delivering" contains the substring
 * "delivering", so a naive inclusion-only check would misclassify it.
 */
export function isActiveDeliveryStatus(status: string | null | undefined): boolean {
  const s = (status || "").toLowerCase().trim();
  if (!s) return false;
  if (/not.?deliver|inactive|paused/.test(s)) return false;
  return /active|deliver/.test(s);
}

/** Small on-chart label for a non-active status — null when active, blank, or unrecognized (never guess). */
export function deliveryStatusIndicator(status: string | null | undefined): DeliveryStatusIndicator {
  const s = (status || "").toLowerCase().trim();
  if (!s) return null;
  if (/paused/.test(s)) return "Paused";
  if (/not.?deliver|inactive/.test(s)) return "Inactive";
  return null;
}

/**
 * Campaign-level indicator across every ad set's status: "Paused" wins if
 * any ad set is explicitly paused (the more specific, actionable state),
 * otherwise "Inactive" if any ad set reads as not delivering, else null.
 */
export function campaignStatusIndicator(statuses: (string | null | undefined)[]): DeliveryStatusIndicator {
  const indicators = statuses.map(deliveryStatusIndicator);
  if (indicators.includes("Paused")) return "Paused";
  if (indicators.includes("Inactive")) return "Inactive";
  return null;
}
