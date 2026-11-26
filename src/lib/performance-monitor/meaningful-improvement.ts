import type { CampaignPerformance, PerformanceSignal } from "./facts";

/** The dashboard celebrates substantial period gains, not target compliance/recovery. */
export function isMeaningfulImprovement(
  campaign: CampaignPerformance,
  signal: PerformanceSignal,
): boolean {
  if (
    signal.tone !== "positive" ||
    signal.change == null ||
    !Number.isFinite(signal.change)
  )
    return false;
  if (
    !campaign.comparableResults ||
    campaign.signals.some((s) => s.tone !== "positive" && s.role === "primary")
  )
    return false;
  const a = campaign.current,
    b = campaign.previous;
  if (signal.key === "cpr-down") return signal.change <= -20 + 1e-8;
  if (signal.key === "results-up") return signal.change >= 25 - 1e-8;
  if (signal.key === "roas-up")
    return /purchase/i.test(campaign.objective) && signal.change >= 20 - 1e-8;
  // Cheaper/more responsive clicks alone must not disguise weaker primary outcomes.
  const stableOutcome =
    a.results != null &&
    b.results != null &&
    b.results >= 5 &&
    a.results >= b.results &&
    a.cpr != null &&
    b.cpr != null &&
    a.cpr <= b.cpr * 1.05;
  if (!stableOutcome) return false;
  if (signal.key === "ctr-up") return signal.change >= 30 - 1e-8;
  if (signal.key === "cpc-down" || signal.key === "link-cpc-down")
    return signal.change <= -25 + 1e-8;
  return false;
}
