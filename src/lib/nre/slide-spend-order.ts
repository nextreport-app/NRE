/** Sort presentation groups by raw reporting-period spend, with stable name ties. */
export function orderSlidesBySpend<T extends {
  campaignName: string;
  adSetName?: string;
  isMonthTotal?: boolean;
  ai: { spendNum?: number };
}>(slides: readonly T[]): T[] {
  const spend = (slide: T) => Number.isFinite(slide.ai.spendNum) ? slide.ai.spendNum! : 0;
  const name = (slide: T) => `${slide.campaignName}\0${slide.adSetName ?? ""}`;
  return [...slides].sort((a, b) =>
    Number(!!a.isMonthTotal) - Number(!!b.isMonthTotal)
    || spend(b) - spend(a)
    || (name(a) < name(b) ? -1 : name(a) > name(b) ? 1 : 0),
  );
}
