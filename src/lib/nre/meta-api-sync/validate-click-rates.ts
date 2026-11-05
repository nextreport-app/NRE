import type { MetaInsightRow } from "@/lib/meta-api";
import { ServiceError } from "@/lib/service-error";

/** Meta rates are percentages; component counts and the matching rate must describe the same observations. */
export function validateMetaClickRates(row: MetaInsightRow): void {
  const impressions = Number(row.impressions);
  if (!(impressions > 0)) return;
  for (const [count, rate] of [[row.clicks, row.ctr], [row.inline_link_clicks, row.inline_link_click_ctr]]) {
    if (count == null || rate == null || count === "" || rate === "") continue;
    const clicks = Number(count), percentage = Number(rate);
    // Permit provider display rounding, but not mixed definitions or unit scaling.
    if (!Number.isFinite(clicks) || !Number.isFinite(percentage) || clicks < 0 || percentage < 0 || Math.abs(clicks / impressions * 100 - percentage) > 0.011) {
      throw new ServiceError("Meta's click counts and CTR do not agree for the same row. Import stopped rather than mix all-click CTR with link CTR. Check the reporting dates and retry sync.", 422);
    }
  }
}
