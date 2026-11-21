import { comparisonPercent } from "./comparison-presentation";
import { fmtCurrency2dp, fmtResultCount } from "./format";
import type { ComparisonCampaignData } from "./report-data";
import type { MetaPerformanceRow, MetaContentOptions } from "./meta-report-content/types";

/** One factual contract for both exported slides and browser reports. No causal or forecast claims. */
export interface ClientNarrative { summary: string; insights: string[] }
const short = (name: string) => name.length > 55 ? `${name.slice(0, 52)}…` : name;
const usable = (value: {value: number; formatted: string}) => Number.isFinite(value.value) && /\d/.test(value.formatted);
const tie = (size: number) => size > 1 ? ` (tied across ${size})` : "";

export function metaClientNarrative(input: {
  rows: MetaPerformanceRow[]; total: MetaPerformanceRow; objective: string;
  costLabel: string; dimension: string; currency: string; creative: boolean; options: MetaContentOptions;
}): ClientNarrative {
  const { rows, total, objective, costLabel, currency, creative, options } = input;
  const money = (n: number) => fmtCurrency2dp(n, currency);
  const label = objective.toLowerCase(), cost = costLabel.toLowerCase();
  const context = creative ? "Selected ads" : `The ${input.dimension.toLowerCase()} breakdown`;
  const available = rows.filter(r => r.results !== null);
  const missing = rows.length - available.length;
  const partial = total.results === null && available.length > 0 && missing > 0 &&
    !["REACH", "AD RECALL LIFT"].includes(objective.toUpperCase());
  const partialResults = partial
    ? ` Available ${creative ? "ads" : "segments"} report ${fmtResultCount(available.reduce((n, row) => n + row.results!, 0))} ${label}; ${missing} ${creative ? (missing === 1 ? "ad has" : "ads have") : (missing === 1 ? "segment has" : "segments have")} unavailable results. Overall results and ${cost} are unavailable.`
    : ` ${objective} totals are unavailable.`;
  const summary = `${context} recorded ${money(total.spend)} spend and ${fmtResultCount(total.impressions)} impressions across the selected campaigns.${total.results !== null ? ` Results: ${fmtResultCount(total.results)} ${label}.` : partialResults}${total.cpr !== null ? ` ${costLabel.charAt(0) + costLabel.slice(1).toLowerCase()}: ${money(total.cpr)}.` : ""}`;
  const insights: string[] = [];
  const highestSpend = Math.max(...rows.map(r => r.spend));
  if (highestSpend > 0) {
    const top = rows.filter(r => Math.abs(r.spend - highestSpend) < 1e-8);
    insights.push(`${short(top[0].name)} received the most spend${tie(top.length)}: ${money(highestSpend)} (${(highestSpend / total.spend * 100).toFixed(1)}% of this view).`);
  }
  if (available.length === rows.length && total.results !== null) {
    const peak = Math.max(0, ...available.map(r => r.results!));
    if (peak > 0) {
      const top = available.filter(r => Math.abs(r.results! - peak) < 1e-8);
      insights.push(`${short(top[0].name)} recorded the most ${label}${tie(top.length)}: ${fmtResultCount(peak)}.`);
    } else insights.push(`No ${label} were recorded in this view; this does not establish why.`);
  }
  if (creative) {
    const ranked = rows.filter(r => r.eligible && r.rank === 1)[0];
    if (ranked) {
      const metric = options.ranking;
      const number = (row: MetaPerformanceRow) => metric === "cpr" ? row.cpr : metric === "roas" ? row.roas : metric === "ctr" ? row.ctr : row.spend;
      const peers = rows.filter(row => row.eligible && number(row) !== null && Math.abs(number(row)! - number(ranked)!) < 1e-8);
      const value = metric === "cpr" ? money(ranked.cpr!) : metric === "roas" ? `${ranked.roas!.toFixed(2)}x` : metric === "ctr" ? `${ranked.ctr!.toFixed(2)}%` : money(ranked.spend);
      insights.push(`Top eligible ad by ${metric === "cpr" ? cost : metric === "ctr" ? "CTR (all)" : metric === "roas" ? "purchase ROAS" : "spend"}: ${short(ranked.name)}${tie(peers.length)} · ${value}. ${metric === "ctr" ? "Click-through rate does not establish conversion quality." : "This ranking does not establish incremental impact."}`);
    } else insights.push("No ads meet the selected ranking thresholds; their available metrics remain in the tables.");
  } else {
    const threshold = Math.max(5, options.minResults);
    const eligible = rows.filter(r => r.cpr !== null && r.spend > 0 && r.spend >= options.minSpend && r.results !== null && r.results >= threshold);
    if (eligible.length) {
      const best = Math.min(...eligible.map(r => r.cpr!));
      const top = eligible.filter(r => Math.abs(r.cpr! - best) < 1e-8);
      insights.push(`Among segments with ${partial ? "available results and " : ""}at least ${threshold} results, ${short(top[0].name)} had the lowest ${cost}${tie(top.length)}: ${money(best)}.`);
    } else if (total.results !== null && total.results > 0) insights.push(`No segment has at least ${threshold} results for an efficiency ranking.`);
  }
  if (!insights.length) insights.push("Only the selected campaigns, dates and available source metrics are included.");
  return {summary, insights: insights.slice(0, 3)};
}

export function comparisonClientNarrative(campaign: ComparisonCampaignData): ClientNarrative {
  const {metricsA: a, metricsB: b, objective, costLabel} = campaign;
  const estimatedReach = /reach/i.test(objective) && (a.reach.estimated || b.reach.estimated);
  const resultLabel = estimatedReach ? `${objective.toLowerCase()} (estimated)` : objective.toLowerCase();
  const outcome = (m: typeof a) => usable(m.results) ? ` and ${m.results.formatted} ${resultLabel}` : "";
  const summary = `Period A recorded ${a.spend.formatted} spend${outcome(a)}. Period B recorded ${b.spend.formatted} spend${outcome(b)}.`;
  const insights: string[] = [];
  const change = (label: string, av: number, bv: number) => bv === 0
    ? av === 0 ? `${label}: zero in both periods.` : `${label}: ${av > 0 ? "recorded in Period A" : "unavailable"} versus zero in Period B; percentage change is unavailable.`
    : `${label} ${av === bv ? "was unchanged" : `${av > bv ? "increased" : "decreased"} by ${comparisonPercent(Math.abs((av - bv) / bv * 100)).replace(/^\+/, "")}`} in Period A versus Period B.`;
  insights.push(change("Spend", a.spend.value, b.spend.value));
  if (usable(a.results) && usable(b.results)) insights.push(change(estimatedReach ? `${objective} (estimated)` : objective, a.results.value, b.results.value));
  if (usable(a.cpr) && usable(b.cpr) && a.results.value > 0 && b.results.value > 0) {
    insights.push(`${change(costLabel, a.cpr.value, b.cpr.value).replace(/\.$/, "")} (${a.cpr.formatted} versus ${b.cpr.formatted}).`);
  } else insights.push(`${costLabel} cannot be compared when a period has no recorded results or its cost is unavailable.`);
  return {summary, insights};
}
