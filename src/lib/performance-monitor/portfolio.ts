import type {
  CampaignPerformance,
  PerformanceSignal,
  PeriodMetrics,
} from "./facts";
import { campaignVerdict } from "./decision";

export type CampaignState =
  | "critical"
  | "review"
  | "positive"
  | "neutral"
  | "insufficient"
  | "no-delivery";
export type PortfolioState = CampaignState | "check" | "setup";
export type ObservationUnit = "money" | "number" | "percent" | "multiple";
export interface Observation {
  metric: string;
  current: number | null;
  previous: number | null;
  reference: "previous" | "target";
  unit: ObservationUnit;
  change: number | null;
}
export const PORTFOLIO_LABELS: Record<PortfolioState, string> = {
  critical: "Critical",
  review: "Review",
  positive: "Improvement",
  neutral: "Neutral",
  insufficient: "More data needed",
  "no-delivery": "No delivery",
  check: "Refresh needed",
  setup: "Needs setup",
};
export function campaignState(c: CampaignPerformance): CampaignState {
  const verdict = campaignVerdict(c);
  if (verdict !== "neutral")
    return verdict === "improving" ? "positive" : verdict;
  if (c.current.spend === 0 && c.current.impressions === 0)
    return "no-delivery";
  // Neutral requires evidence for the campaign's primary outcome, not just the absence of warnings.
  if (
    !c.comparableResults ||
    c.current.impressions < 1000 ||
    c.previous.impressions < 1000 ||
    (c.current.results ?? 0) < 5 ||
    (c.previous.results ?? 0) < 5 ||
    c.current.cpr === null ||
    c.previous.cpr === null
  )
    return "insufficient";
  return "neutral";
}
function priority(s: PerformanceSignal) {
  return s.tone === "critical"
    ? 0
    : s.role !== "supporting" && s.tone === "warning"
      ? 1
      : s.role === "primary" && s.tone === "positive"
        ? 2
        : s.tone === "warning"
          ? 3
          : 4;
}
export function leadingSignal(c: CampaignPerformance) {
  const state = campaignState(c);
  // A primary improvement remains the lead even if a supporting metric needs watching.
  return [...c.signals]
    .sort((a, b) => priority(a) - priority(b))
    .find((s) => state !== "positive" || s.tone === "positive");
}
export function signalObservation(
  c: CampaignPerformance,
  s?: PerformanceSignal,
): Observation | null {
  if (!s) return null;
  if (s.key === "results-stopped-7d" && c.recent) return { metric: `${c.objective} · last 7 days`, current: c.recent.current.results, previous: c.recent.previous.results, reference: "previous", unit: "number", change: s.change };
  let key: keyof PeriodMetrics, unit: ObservationUnit;
  const name = s.key.replace(/^recovered:/, "");
  if (name.startsWith("ctr-")) {
    key = "ctr";
    unit = "percent";
  } else if (name.startsWith("link-cpc-")) {
    key = "linkCpc";
    unit = "money";
  } else if (name.startsWith("cpc-")) {
    key = "cpc";
    unit = "money";
  } else if (name.startsWith("cpr-") || name === "cost-above-target") {
    key = "cpr";
    unit = "money";
  } else if (
    name === "roas-up" ||
    name === "roas-down" ||
    name === "roas-below-target"
  ) {
    key = "roas";
    unit = "multiple";
  } else if (name.startsWith("results-")) {
    key = "results";
    unit = "number";
  } else return null;
  const target =
    name === "cost-above-target"
      ? c.target?.maxCpr
      : name === "roas-below-target"
        ? c.target?.minRoas
        : undefined;
  return {
    metric: s.metric,
    current: c.current[key] ?? null,
    previous: target ?? c.previous[key] ?? null,
    reference: target === undefined ? "previous" : "target",
    unit,
    change: s.change,
  };
}
export function campaignBrief(c: CampaignPerformance) {
  const state = campaignState(c),
    signal = leadingSignal(c);
  const reason = signal
    ? signal.key === "target-met"
      ? "Saved efficiency target met."
      : signal.key === "results-stopped"
        ? "Results fell to zero while spend continued."
        : signal.key === "target-no-results"
          ? "Spend reached twice the cost target with no reported results."
          : signal.key === "target-mismatch"
            ? "Campaign goal changed; review its saved target."
            : signal.key === "roas-unavailable"
              ? "Purchase values are unavailable; ROAS needs a data check."
              : `${signal.metric} ${signal.state === "recovered" ? "recovered" : signal.tone === "warning" || signal.tone === "critical" ? "needs review" : "improved"}.`
    : state === "no-delivery"
      ? "No spend or impressions in the current period."
      : state === "insufficient"
        ? !c.comparableResults
          ? "Comparable primary outcomes are not available for both periods."
          : "Primary outcome volume is too low for a neutral assessment."
        : "No alert threshold crossed with sufficient primary-outcome data.";
  return {
    name: c.name,
    id: c.id ?? null,
    objective: c.objective,
    state,
    reason,
    observation:
      signalObservation(c, signal) ??
      (!signal
        ? {
            metric: c.objective,
            current: c.current.results,
            previous: c.previous.results,
            reference: "previous" as const,
            unit: "number" as const,
            change:
              c.comparableResults &&
              c.current.results !== null &&
              (c.previous.results ?? 0) > 0
                ? (c.current.results! / c.previous.results! - 1) * 100
                : null,
          }
        : signal.key === "target-met" && c.target?.maxCpr
          ? {
              metric: c.costLabel,
              current: c.current.cpr,
              previous: c.target.maxCpr,
              reference: "target" as const,
              unit: "money" as const,
              change: null,
            }
          : signal.key === "target-met" && c.target?.minRoas
            ? {
                metric: "Purchase ROAS",
                current: c.current.roas ?? null,
                previous: c.target.minRoas,
                reference: "target" as const,
                unit: "multiple" as const,
                change: null,
              }
            : null),
    lifecycle: signal?.state ?? null,
  };
}
export function campaignRank(c: CampaignPerformance) {
  return {
    critical: 0,
    review: 1,
    positive: 2,
    insufficient: 3,
    neutral: 4,
    "no-delivery": 5,
  }[campaignState(c)];
}
export const portfolioRank: Record<PortfolioState, number> = {
  critical: 0,
  review: 1,
  check: 2,
  insufficient: 3,
  positive: 4,
  neutral: 5,
  "no-delivery": 6,
  setup: 7,
};
