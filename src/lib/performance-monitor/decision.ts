import type {
  CampaignPerformance,
  PeriodMetrics,
  PerformanceSignal,
  PerformanceFacts,
  PerformanceSnapshot,
} from "./facts";
import type { CampaignTarget } from "./settings";
export type Verdict = "critical" | "review" | "improving" | "neutral";
export interface DecisionContext {
  objective?: string;
  target?: CampaignTarget;
  targetMismatch?: boolean;
  purchase?: boolean;
}
export function decisionSignals(
  a: PeriodMetrics,
  b: PeriodMetrics,
  comparable: boolean,
  ctx: DecisionContext = {},
): PerformanceSignal[] {
  const out: PerformanceSignal[] = [];
  const add = (
    key: string,
    metric: string,
    tone: PerformanceSignal["tone"],
    role: "primary" | "supporting",
    message: string,
    change: number | null = null,
  ) => out.push({ key, metric, tone, role, message, change, state: "new" });
  const delta = (
    key: string,
    metric: string,
    x: number | null | undefined,
    y: number | null | undefined,
    threshold: number,
    up: boolean,
    tone: PerformanceSignal["tone"],
    role: "primary" | "supporting",
    message: string,
  ) => {
    if (
      x === null ||
      x === undefined ||
      y === null ||
      y === undefined ||
      y <= 0
    )
      return;
    const p = (x / y - 1) * 100;
    if (Number.isFinite(p) && (up ? p : -p) + 1e-8 >= threshold)
      add(key, metric, tone, role, message, p);
  };
  const delivery = a.impressions >= 1000 && b.impressions >= 1000;
  if (delivery && (a.clicks ?? 0) >= 10 && (b.clicks ?? 0) >= 30)
    delta(
      "ctr-down",
      "CTR (all)",
      a.ctr,
      b.ctr,
      20,
      false,
      "warning",
      "supporting",
      "Click response declined. Inspect creative, audience and placement delivery; this change alone does not identify a cause.",
    );
  if (delivery && (a.clicks ?? 0) >= 30 && (b.clicks ?? 0) >= 30) {
    delta(
      "ctr-up",
      "CTR (all)",
      a.ctr,
      b.ctr,
      20,
      true,
      "positive",
      "supporting",
      "Click response improved. Confirm that the campaign's primary results and result quality also improved.",
    );
    delta(
      "cpc-up",
      "CPC (all)",
      a.cpc,
      b.cpc,
      25,
      true,
      "warning",
      "supporting",
      "Clicks became more expensive. Compare CTR, placements and auction delivery; increased competition is only one possible explanation.",
    );
    delta(
      "cpc-down",
      "CPC (all)",
      a.cpc,
      b.cpc,
      20,
      false,
      "positive",
      "supporting",
      "Click cost improved. For conversion campaigns, assess purchases or leads before treating cheaper clicks as business success.",
    );
  }
  if (comparable) {
    const continued =
      a.spend > 0 &&
      b.spend > 0 &&
      a.spend >= b.spend * 0.8 &&
      a.impressions >= 500;
    if (a.results === 0 && (b.results ?? 0) >= 5 && continued)
      add(
        "results-stopped",
        ctx.objective ?? "Results",
        "critical",
        "primary",
        `No ${String(ctx.objective ?? "results").toLowerCase()} were reported after ${b.results} previously, while spend continued. Check delivery, tracking and the conversion flow. Recent attribution may still arrive; verify before making changes.`,
        -100,
      );
    else if (delivery && (b.results ?? 0) >= 10 && continued)
      delta(
        "results-down",
        ctx.objective ?? "Results",
        a.results,
        b.results,
        30,
        false,
        "warning",
        "primary",
        "Primary results declined despite broadly maintained spend. Inspect conversion tracking, delivery and the customer journey; allow for attribution delays.",
      );
    if (delivery && (b.results ?? 0) >= 10 && (a.results ?? 0) >= 5) {
      delta(
        "cpr-up",
        "Cost per result",
        a.cpr,
        b.cpr,
        25,
        true,
        "warning",
        "primary",
        "Result cost increased. Inspect the campaign's conversion quality and delivery before adjusting budgets.",
      );
      delta(
        "cpr-down",
        "Cost per result",
        a.cpr,
        b.cpr,
        20,
        false,
        "positive",
        "primary",
        "Result cost improved with sufficient reported outcomes. Verify lead or purchase quality before scaling.",
      );
    }
    if (
      delivery &&
      (b.results ?? 0) >= 5 &&
      (a.results ?? 0) >= 10 &&
      a.cpr !== null &&
      b.cpr !== null &&
      a.cpr <= b.cpr * 1.05
    )
      delta(
        "results-up",
        ctx.objective ?? "Results",
        a.results,
        b.results,
        25,
        true,
        "positive",
        "primary",
        "Primary results increased while cost per result stayed stable or improved. Check outcome quality before scaling.",
      );
  }
  if (
    ctx.purchase &&
    comparable &&
    (a.results ?? 0) >= 5 &&
    (b.results ?? 0) >= 5
  ) {
    delta(
      "roas-down",
      "Purchase ROAS",
      a.roas,
      b.roas,
      20,
      false,
      "warning",
      "primary",
      "Purchase value per unit of spend declined. Check conversion values, attribution and purchase quality before changing spend.",
    );
    delta(
      "roas-up",
      "Purchase ROAS",
      a.roas,
      b.roas,
      20,
      true,
      "positive",
      "primary",
      "Purchase value per unit of spend improved. Confirm order values, profitability and attribution before scaling.",
    );
  }
  if (ctx.purchase && (a.results ?? 0) >= 5 && a.roas == null)
    add(
      "roas-unavailable",
      "Purchase value",
      "warning",
      "primary",
      "Matching campaign purchase values were unavailable, so ROAS was not assessed. Check value reporting and refresh; this does not prove a tracking fault.",
    );
  if (ctx.targetMismatch)
    add(
      "target-mismatch",
      "Campaign target",
      "warning",
      "primary",
      "The campaign objective changed. Review its saved target before using it to judge performance.",
    );
  const t = ctx.target;
  if (
    t &&
    a.results !== null &&
    (a.results >= 5 ||
      (a.results === 0 && a.spend >= 2 * (t.maxCpr ?? Infinity)))
  ) {
    if (
      t.maxCpr &&
      a.results === 0 &&
      a.spend >= 2 * t.maxCpr &&
      !out.some((s) => s.key === "results-stopped")
    )
      add(
        "target-no-results",
        "Cost target",
        "critical",
        "primary",
        `Spend reached at least twice the ${t.maxCpr} target without a reported result. Verify tracking and conversion lag before making changes.`,
      );
    else if (t.maxCpr && a.cpr !== null && a.cpr > t.maxCpr * 1.1)
      add(
        "cost-above-target",
        "Cost per result vs target",
        "warning",
        "primary",
        `Current result cost exceeds the saved ${t.maxCpr} target. Improvement versus the previous period does not yet mean the target is met.`,
        (a.cpr / t.maxCpr - 1) * 100,
      );
    if (ctx.purchase && t.minRoas && a.roas != null && a.roas < t.minRoas)
      add(
        "roas-below-target",
        "Purchase ROAS vs target",
        "warning",
        "primary",
        `ROAS is below the saved ${t.minRoas}× target. Review attributed values and profitability.`,
        (a.roas / t.minRoas - 1) * 100,
      );
    const costMet = !t.maxCpr || (a.cpr !== null && a.cpr <= t.maxCpr),
      roasMet =
        !t.minRoas || (ctx.purchase && a.roas != null && a.roas >= t.minRoas);
    if (a.results >= 5 && (t.maxCpr || t.minRoas) && costMet && roasMet)
      add(
        "target-met",
        "Campaign target",
        "positive",
        "primary",
        "Reported outcomes meet the saved efficiency target. Check result quality; this is not an instruction to scale automatically.",
      );
  }
  return out;
}
export function campaignVerdict(
  c: Pick<CampaignPerformance, "signals" | "current" | "comparableResults">,
): Verdict {
  if (c.signals.some((s) => s.tone === "critical")) return "critical";
  if (c.signals.some((s) => s.tone === "warning" && s.role !== "supporting"))
    return "review";
  if (
    c.signals.some(
      (s) =>
        s.tone === "positive" &&
        (s.role === "primary" ||
          [
            "cpr-down",
            "results-up",
            "roas-up",
            "target-met",
            "results-resumed",
          ].includes(s.key)),
    )
  )
    return "improving";
  if (c.signals.some((s) => s.tone === "warning")) return "review";
  return "neutral";
}
function recovered(old: PerformanceSignal, c: CampaignPerformance) {
  const a = c.current,
    b = c.previous;
  const ratio = (x: number | null | undefined, y: number | null | undefined) =>
    x != null && y != null && y > 0 ? x / y : null;
  if (!c.comparableResults && old.role === "primary") return false;
  if (old.key === "results-stopped")
    return a.results !== null && a.results > 0 && a.spend > 0;
  if (a.impressions < 1000 || b.impressions < 1000) return false;
  if (old.key === "ctr-down")
    return (
      (a.clicks ?? 0) >= 30 &&
      (b.clicks ?? 0) >= 30 &&
      (ratio(a.ctr, b.ctr) ?? 0) >= 0.9
    );
  if (old.key === "cpc-up")
    return (
      (a.clicks ?? 0) >= 30 &&
      (b.clicks ?? 0) >= 30 &&
      (ratio(a.cpc, b.cpc) ?? Infinity) <= 1.1
    );
  if (old.key === "cpr-up")
    return (
      (a.results ?? 0) >= 5 &&
      (b.results ?? 0) >= 10 &&
      (ratio(a.cpr, b.cpr) ?? Infinity) <= 1.1
    );
  if (old.key === "results-down")
    return (
      a.spend >= b.spend * 0.8 &&
      (b.results ?? 0) >= 10 &&
      (ratio(a.results, b.results) ?? 0) >= 0.85
    );
  if (old.key === "roas-down")
    return (
      (a.results ?? 0) >= 5 &&
      (b.results ?? 0) >= 5 &&
      (ratio(a.roas, b.roas) ?? 0) >= 0.9
    );
  return false;
}
export function applySignalLifecycle(
  facts: PerformanceFacts,
  prior: PerformanceSnapshot | null,
  now = new Date(),
) {
  if (
    !prior?.facts ||
    now.getTime() - Date.parse(prior.checkedAt) > 3 * 86400000
  )
    return facts;
  const span = (p: { startIso: string; endIso: string }) =>
    Date.parse(p.endIso) - Date.parse(p.startIso);
  if (
    span(prior.facts.periodA) !== span(facts.periodA) ||
    Math.abs(
      Date.parse(facts.periodA.endIso) - Date.parse(prior.facts.periodA.endIso),
    ) >
      3 * 86400000
  )
    return facts;
  for (const c of facts.campaigns) {
    const previous = prior.facts.campaigns.find(
      (p) => (c.id && p.id === c.id) || (!c.id && !p.id && p.name === c.name),
    );
    if (!previous || previous.objective !== c.objective) continue;
    for (const s of c.signals) {
      const old = previous.signals.find(
        (o) => o.key === s.key && o.tone === s.tone && o.state !== "recovered",
      );
      s.state = old ? "continuing" : "new";
      s.firstSeenAt = old?.firstSeenAt ?? prior.checkedAt;
      if (!old) s.firstSeenAt = now.toISOString();
    }
    if (!prior.error)
      for (const old of previous.signals.filter(
        (s) => s.tone === "critical" || s.tone === "warning",
      )) {
        if (c.signals.some((s) => s.key === old.key) || !recovered(old, c))
          continue;
        c.signals.push({
          key: `recovered:${old.key}`,
          metric: old.metric,
          tone: "positive",
          role: old.role,
          state: "recovered",
          change: null,
          message:
            old.key === "results-stopped"
              ? "Reported results resumed. Verify attribution and outcome quality before treating the campaign as healthy."
              : "This metric moved back inside its recovery threshold with sufficient evidence. Continue monitoring.",
          firstSeenAt: now.toISOString(),
        });
      }
  }
  return facts;
}

export function decisionAlertKey(
  clientId: string,
  endIso: string,
  startIso: string,
  kind: "critical" | "review",
) {
  return `performance-alert:${clientId}:${endIso}:${startIso}:${kind}`;
}
export function actionableSignals(c: CampaignPerformance) {
  const verdict = campaignVerdict(c);
  return c.signals.filter(
    (s) =>
      (s.tone === "critical" || s.tone === "warning") &&
      !(verdict === "improving" && s.role === "supporting"),
  );
}
