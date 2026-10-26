/** Pure numeric accounting. No labels, file parsing, clocks, formatting, or network calls. */
export interface NumericFact {
  spend: number;
  impressions: number;
  clicksAll: number;
  results: number;
}

export function preciseSum(values: readonly number[]): number {
  let sum = 0, correction = 0;
  for (const value of values) {
    if (!Number.isFinite(value)) throw new Error("Non-finite input to report accounting");
    const adjusted = value - correction;
    const next = sum + adjusted;
    correction = (next - sum) - adjusted;
    sum = next;
  }
  return sum;
}

export function aggregateNumericFacts(facts: readonly NumericFact[], resultScale = 1) {
  const spend = preciseSum(facts.map(fact => fact.spend));
  const impressions = preciseSum(facts.map(fact => fact.impressions));
  const clicksAll = preciseSum(facts.map(fact => fact.clicksAll));
  const results = preciseSum(facts.map(fact => fact.results));
  return {
    spend, impressions, clicksAll, results,
    ctr: impressions > 0 ? clicksAll / impressions * 100 : null,
    cpc: clicksAll > 0 ? spend / clicksAll : null,
    cpr: results > 0 ? spend / results * resultScale : null,
  };
}
