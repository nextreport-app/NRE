/** Illustrative data only; derive rates from the same sample totals as the cards. */
const sample = { spend: 2847, reach: 45231, impressions: 89456, leads: 34, allClicks: 2147, linkClicks: 1847 };
const money = (n: number) => `$${n.toFixed(2)}`;
export const HERO_SAMPLE_VALUES = [
  "$2,847", "45,231", "89,456", "34", money(sample.spend / sample.leads),
  `${(sample.allClicks / sample.impressions * 100).toFixed(2)}%`, "1,847", money(sample.spend / sample.allClicks),
] as const;
