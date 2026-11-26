import type { CampaignPerformance, PerformanceSignal } from "./facts";
import { signalObservation } from "./portfolio";
const words = (s: string) =>
  s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
export function signalSummaryLine(
  campaign: CampaignPerformance,
  signal: PerformanceSignal,
) {
  if (signal.key === "results-stopped-7d" && campaign.recent) return `No ${words(campaign.objective)} were reported in the last 7 completed days (${campaign.recent.periodA.startIso} – ${campaign.recent.periodA.endIso}) despite meaningful spend. Check tracking, delivery and attribution.`;
  const observation = signalObservation(campaign, signal);
  const change = signal.change;
  const name = signal.key.replace(/^recovered:/, "");
  const label = /^results-/.test(name)
    ? words(campaign.objective)
    : /^cpr-/.test(name) || name === "cost-above-target"
      ? words(campaign.costLabel)
      : signal.metric;
  if (
    observation?.reference === "target" ||
    name === "cost-above-target" ||
    name === "roas-below-target"
  )
    return `${label} is ${change == null ? "outside the saved target" : `${Math.abs(change).toLocaleString("en-US", { maximumFractionDigits: 1 })}% ${change > 0 ? "above" : "below"} the saved target`}.`;
  if (change != null && Number.isFinite(change)) {
    const amount =
      Math.abs(change) < 0.1
        ? "less than 0.1"
        : Math.abs(change).toLocaleString("en-US", {
            maximumFractionDigits: 1,
          });
    const line = `${label} ${change < 0 ? "declined" : change > 0 ? "increased" : "is unchanged"}${change === 0 ? "" : ` by ${amount}%`} compared with the previous period.`;
    return signal.key === "ctr-down"
      ? `${line} Consider refreshing the creatives.`
      : line;
  }
  if (signal.state === "recovered")
    return `${label} is back within the review threshold.`;
  if (signal.key === "target-met")
    return "Results meet the saved efficiency target.";
  if (signal.key === "results-resumed")
    return `${words(campaign.objective)} were reported again after none in the previous period.`;
  if (signal.key === "roas-unavailable")
    return "Purchase ROAS is unavailable for this comparison.";
  return `${label} needs review for this comparison.`;
}
