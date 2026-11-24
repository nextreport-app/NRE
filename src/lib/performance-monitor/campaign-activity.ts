import type { CampaignPerformance } from "./facts";
/** Period activity, rather than today's campaign status, determines comparison relevance. */
export function hasComparisonActivity(c: CampaignPerformance): boolean {
  return [c.current, c.previous].some(
    (p) =>
      p.spend > 0 ||
      p.impressions > 0 ||
      (p.clicks ?? 0) > 0 ||
      (p.results ?? 0) > 0 ||
      (p.reach ?? 0) > 0,
  );
}
