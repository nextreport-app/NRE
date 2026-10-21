/**
 * Detect Meta exports where the Reach column header exists but every row's
 * reach cell is blank — Ads Manager sometimes omits reach on ad-set daily
 * exports even when Impressions are populated. The engine cannot estimate
 * period reach without daily reach values (Sainsbury needs them).
 */

import type { ColumnMap, NreRow } from "./columns";
import { parseCellNum } from "./format";
import type { Platform } from "./google-columns";
import { adsManagerName } from "./platform-reporting";
import type { CsvDateWarning } from "./csv-date-guidance";

export function csvReachColumnPresentButEmpty(colMap: ColumnMap, rows: NreRow[]): boolean {
  if (!colMap.reach) return false;
  let hasImpressions = false;
  for (const row of rows) {
    if (parseCellNum(row.impressions) > 0) hasImpressions = true;
    if (parseCellNum(row.reach) > 0) return false;
  }
  return hasImpressions;
}

export function missingReachValuesWarning(
  colMap: ColumnMap,
  rows: NreRow[],
  platform: Platform = "META",
): CsvDateWarning | null {
  if (platform !== "META") return null;
  if (!csvReachColumnPresentButEmpty(colMap, rows)) return null;
  const manager = adsManagerName(platform);
  return {
    kind: "missing_reach_values",
    title: "Reach is blank in this CSV",
    message:
      `Your file has Impressions but every Reach cell is empty, so Reach will show as 0 on slides. ` +
      `Re-export from ${manager} → Reports → Export table data with Time breakdown: Day, and confirm Reach has numbers in the preview before downloading. ` +
      `If Reach is empty in Ads Manager too, widen the date range or export at campaign level once to copy period reach.`,
    suggestedDownload: "last_30_days",
  };
}
