/** Illustrative data only; derive every displayed total and rate from these facts. */
const sample = { spend: 480, reach: 40000, impressions: 80000, leads: 120, allClicks: 1600, linkClicks: 1200 };
const number = (n: number) => n.toLocaleString("en-US");
const money = (n: number) => `$${n.toFixed(2)}`;
export const HERO_SAMPLE_VALUES = [
  `$${number(sample.spend)}`, number(sample.reach), number(sample.impressions), number(sample.leads), money(sample.spend / sample.leads),
  `${(sample.allClicks / sample.impressions * 100).toFixed(2)}%`, number(sample.linkClicks), money(sample.spend / sample.allClicks),
] as const;
