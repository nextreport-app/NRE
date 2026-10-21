/**
 * Distinguish a broken Meta export (delivery without spend) from a legit
 * $0 / paused period (no delivery signals at all).
 */

import type { ColumnMap, NreRow } from "./columns";
import { parseCellNum } from "./format";
import type { Platform } from "./google-columns";
import { adsManagerName } from "./platform-reporting";

export type CsvSpendDeliveryKind = "has_spend" | "broken_export" | "no_delivery";

export function classifyCsvSpendDelivery(
  colMap: ColumnMap,
  rows: NreRow[],
  platform: Platform = "META",
): CsvSpendDeliveryKind {
  if (platform !== "META" || !colMap.spend || rows.length === 0) {
    return "has_spend";
  }

  if (rows.some((r) => parseCellNum(r.spend) > 0)) {
    return "has_spend";
  }

  const hasDeliverySignal = rows.some(
    (r) =>
      parseCellNum(r.impressions) > 0 ||
      parseCellNum(r.reach) > 0 ||
      parseCellNum(r.link_clicks) > 0 ||
      parseCellNum(r.results) > 0,
  );

  return hasDeliverySignal ? "broken_export" : "no_delivery";
}

export function brokenSpendExportMessage(platform: Platform = "META"): string {
  const manager = adsManagerName(platform);
  return (
    `This CSV shows delivery (impressions, reach, clicks, or results) but Amount spent is $0 on every row — often a broken ${manager} Reporting export. ` +
    `Re-export from Reports when spend appears in the preview, or try Campaigns → select your campaign → Breakdown: Day → export and upload that file here.`
  );
}

export function noDeliveryWarningMessage(): string {
  return (
    "No spend, impressions, or results in this file for the exported dates. " +
    "If campaigns were paused, you can continue for a paused-period report; otherwise widen the date range or re-export."
  );
}
