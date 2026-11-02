import type { NreRow } from "./columns";
import { hasNumericCsvValue } from "./csv-metric-evidence";
import { aggregateReachAcrossCampaigns } from "./reach-aggregation";

/** Match Weekly's period estimator, retaining unavailable versus exported zero. */
export function dailyPeriodReach(rows: NreRow[]): number | null {
  if (
    !rows.length ||
    !rows.every((row) => {
      const raw = row._raw;
      return raw && Object.keys(raw).length
        ? Object.entries(raw).some(
            ([header, value]) =>
              header.trim().toLowerCase() === "reach" &&
              hasNumericCsvValue(value),
          )
        : hasNumericCsvValue(row.reach);
    })
  )
    return null;
  return aggregateReachAcrossCampaigns(rows);
}
