import type { MetaInsightRow } from "../meta-api";
export const PURCHASE_ACTIONS = new Set([
  "offsite_conversion.fb_pixel_purchase",
  "omni_purchase",
  "purchase",
  "onsite_conversion.purchase",
]);
export interface PurchasePeriodEvidence {
  spend: number;
  values: Record<string, number | null>;
}
export type PurchaseEvidence = Record<
  string,
  { current?: PurchasePeriodEvidence; previous?: PurchasePeriodEvidence }
>;
export function purchasePeriodMap(
  rows: MetaInsightRow[],
): Record<string, PurchasePeriodEvidence> {
  const result: Record<string, PurchasePeriodEvidence> = {};
  for (const row of rows) {
    const id = row.campaign_id;
    if (!id) continue;
    if (result[id]) throw Error("Duplicate campaign purchase-value rows.");
    const spend = Number(row.spend);
    if (!Number.isFinite(spend) || spend < 0 || !String(row.spend ?? "").trim())
      throw Error("Campaign value spend is unavailable.");
    const values: Record<string, number | null> = {};
    for (const action of PURCHASE_ACTIONS) {
      const observed = (row.action_values ?? []).filter(
        (v) => v.action_type === action,
      );
      if (observed.length > 1)
        throw Error("Duplicate purchase value for one action.");
      const text = observed[0]?.value;
      const value =
        text !== undefined && String(text).trim() !== "" ? Number(text) : null;
      const count = row.actions?.find((v) => v.action_type === action)?.value;
      values[action] = observed.length
        ? value !== null && Number.isFinite(value) && value >= 0
          ? value
          : null
        : row.actions && Number(count ?? 0) === 0
          ? 0
          : null;
    }
    result[id] = { spend, values };
  }
  return result;
}
