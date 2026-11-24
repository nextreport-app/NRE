"use client";
import { useState } from "react";
import type { OverviewRow } from "@/lib/agency-overview";
import type {
  CampaignPerformance,
  PerformanceSignal,
} from "@/lib/performance-monitor/facts";
import {
  campaignRank,
  signalObservation,
} from "@/lib/performance-monitor/portfolio";
import { metricChange } from "@/lib/performance-monitor/metric-change";
import {
  deliveryMetrics,
  outcomeMetrics,
  additionalMetrics,
  comparisonCampaignState,
  type DashboardMetric,
} from "@/lib/performance-monitor/dashboard-metrics";
import { PortfolioBadge } from "./portfolio-board";
import { formatMetaPeriod } from "@/lib/performance-monitor/format-period";

function formatted(
  n: DashboardMetric["current"],
  unit: DashboardMetric["unit"],
  currency: string,
) {
  if (n == null) return "—";
  return (
    new Intl.NumberFormat(
      "en-US",
      unit === "money"
        ? {
            style: "currency",
            currency,
            maximumFractionDigits: n > 0 && n < 0.1 ? 4 : 2,
          }
        : {
            maximumFractionDigits:
              unit === "percent" || unit === "multiple" ? 2 : 1,
          },
    ).format(n) + (unit === "percent" ? "%" : unit === "multiple" ? "×" : "")
  );
}
function Change({
  metric,
  fresh,
}: {
  metric: DashboardMetric;
  fresh: boolean;
}) {
  const delta = metricChange(
    metric.current,
    metric.previous,
    metric.key,
    metric.label,
    fresh && metric.comparable !== false,
  );
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full border px-2 py-1 text-xs font-semibold ${delta.tone === "positive" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-400" : delta.tone === "negative" ? "border-red-400/30 bg-red-400/10 text-red-400" : "border-dash-border text-dash-ink-secondary"}`}
    >
      {delta.label}
    </span>
  );
}
function MetricsTable({
  metrics,
  currency,
  fresh,
}: {
  metrics: DashboardMetric[];
  currency: string;
  fresh: boolean;
}) {
  return (
    <div className="mt-3 max-w-full overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead>
          <tr className="text-xs text-dash-ink-secondary">
            <th className="py-3 pr-3 font-medium">Metric</th>
            <th className="px-3 font-medium">Selected period</th>
            <th className="px-3 font-medium">Previous period</th>
            <th className="pl-3 font-medium">Change</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map((metric) => (
            <tr key={metric.key} className="border-t border-dash-border">
              <th
                className={`py-3 pr-3 ${metric.key === "results" || metric.key === "cpr" ? "font-semibold" : "font-normal"}`}
              >
                {metric.label}
              </th>
              <td className="px-3 font-semibold tabular-nums">
                {formatted(metric.current, metric.unit, currency)}
              </td>
              <td className="px-3 tabular-nums text-dash-ink-secondary">
                {formatted(metric.previous, metric.unit, currency)}
              </td>
              <td className="pl-3">
                <Change metric={metric} fresh={fresh} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Issue({
  campaign,
  signal,
  href,
  fresh,
}: {
  campaign: CampaignPerformance;
  signal: PerformanceSignal;
  href: string;
  fresh: boolean;
}) {
  const observation = signalObservation(campaign, signal);
  const delta = observation
    ? metricChange(
        observation.current,
        observation.previous,
        signal.key.startsWith("cpr") || signal.key === "cost-above-target"
          ? "cpr"
          : signal.key.startsWith("cpc")
            ? "cpc_all"
            : signal.key.startsWith("ctr")
              ? "ctr"
              : signal.key.startsWith("roas")
                ? "roas"
                : "results",
        signal.metric,
        fresh,
      )
    : null;
  return (
    <a
      href={href}
      className="block rounded-xl border border-dash-border bg-dash-bg p-4 hover:bg-dash-card"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full border px-2 py-1 text-xs font-semibold ${!fresh ? "border-dash-border text-dash-ink-secondary" : signal.tone === "critical" ? "border-red-400/40 text-red-400" : signal.tone === "warning" ? "border-amber-400/40 text-amber-400" : "border-emerald-400/40 text-emerald-400"}`}
        >
          {!fresh
            ? "Saved change"
            : signal.tone === "critical"
              ? "Urgent review"
              : signal.tone === "warning"
                ? "Review"
                : "Improvement"}
        </span>
        <span className="text-sm font-semibold">{signal.metric}</span>
        {delta && (
          <span
            className={`text-sm font-semibold ${delta.tone === "positive" ? "text-emerald-400" : delta.tone === "negative" ? "text-red-400" : "text-dash-ink-secondary"}`}
          >
            {delta.label}
            {observation?.reference === "target" ? " vs target" : ""}
          </span>
        )}
        {signal.state === "continuing" && (
          <span className="text-xs text-dash-ink-secondary">Ongoing</span>
        )}
      </div>
      <p className="mt-2 break-words text-sm font-semibold">{campaign.name}</p>
      <p className="mt-1 text-sm text-dash-ink-secondary">{signal.message}</p>
      <span className="mt-2 block text-xs font-medium underline underline-offset-4">
        Review campaign ↓
      </span>
    </a>
  );
}
export function MetaPerformanceDashboard({
  client: c,
}: {
  client: OverviewRow;
}) {
  const [showAll, setShowAll] = useState(false);
  const facts = c.performance?.facts;
  if (!facts) return null;
  const campaigns = [...facts.campaigns].sort(
    (a, b) =>
      ({
        critical: 0,
        review: 1,
        positive: 2,
        neutral: 3,
        insufficient: 4,
        "no-delivery": 5,
      })[comparisonCampaignState(a)] -
        {
          critical: 0,
          review: 1,
          positive: 2,
          neutral: 3,
          insufficient: 4,
          "no-delivery": 5,
        }[comparisonCampaignState(b)] || campaignRank(a) - campaignRank(b),
  );
  const changes = campaigns.flatMap((campaign, index) =>
    campaign.signals.map((signal) => ({ campaign, signal, index })),
  );
  const issues = changes
    .filter((s) => s.signal.tone !== "positive")
    .sort(
      (a, b) =>
        Number(b.signal.tone === "critical") -
        Number(a.signal.tone === "critical"),
    );
  const improvements = changes.filter((s) => s.signal.tone === "positive");
  const urgent = issues.filter((s) => s.signal.tone === "critical").length;
  const issueCard = ({ campaign, signal, index }: (typeof changes)[number]) => (
    <Issue
      key={`${index}-${signal.key}`}
      campaign={campaign}
      signal={signal}
      href={`#meta-campaign-${c.id}-${index}`}
      fresh={c.performanceFresh}
    />
  );
  return (
    <div className="mt-5 space-y-6">
      <div className="grid gap-3 sm:grid-cols-2" aria-label="Comparison dates">
        {[
          { label: "Selected period", period: facts.periodA },
          { label: "Previous period", period: facts.periodB },
        ].map(({ label, period }) => (
          <div
            key={label}
            className="rounded-xl border border-dash-border bg-dash-bg px-4 py-3"
          >
            <p className="text-xs font-medium text-dash-ink-secondary">
              {label}
            </p>
            <p className="mt-1 text-sm font-semibold">
              {formatMetaPeriod(period.startIso, period.endIso)}
            </p>
          </div>
        ))}
      </div>
      <section
        aria-label="Performance summary"
        className="rounded-2xl border border-dash-border bg-dash-bg p-4 sm:p-5"
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-dash-ink-secondary">
          Comparison summary
        </p>
        <h3 className="mt-2 text-xl font-semibold">
          {!c.performanceFresh
            ? "Refresh to review current changes"
            : urgent
              ? `${urgent} urgent issue${urgent === 1 ? "" : "s"} to review`
              : issues.length
                ? `${issues.length} change${issues.length === 1 ? "" : "s"} need${issues.length === 1 ? "s" : ""} review`
                : facts.empty
                  ? "No delivery in these periods"
                  : "No significant issues detected"}
        </h3>
        {!c.performanceFresh && (
          <p className="mt-2 text-sm text-dash-ink-secondary">
            These are saved figures. Refresh before making decisions.
          </p>
        )}
        {c.budgetAttention && (
          <a
            href={`#meta-budget-${c.id}`}
            className="mt-3 block text-sm font-semibold underline"
          >
            Budget: {c.budgetLabel} · Review pacing ↓
          </a>
        )}
        {!!issues.length && (
          <div className="mt-4 space-y-3">
            {(showAll ? issues : issues.slice(0, 3)).map(issueCard)}
          </div>
        )}
        {issues.length > 3 && (
          <button
            type="button"
            className="mt-3 text-sm underline"
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll ? "Show fewer issues" : `Show all ${issues.length} issues`}
          </button>
        )}
        {!issues.length && !facts.empty && (
          <p className="mt-2 text-sm text-dash-ink-secondary">
            Review results and costs below. Campaigns with limited data are
            marked separately.
          </p>
        )}
        {!!improvements.length && (
          <details className="mt-4 border-t border-dash-border pt-4">
            <summary className="cursor-pointer text-sm font-medium">
              Improvements ({improvements.length})
            </summary>
            <div className="mt-3 space-y-3">{improvements.map(issueCard)}</div>
          </details>
        )}
      </section>
      <section aria-label="Account metrics">
        <div className="mb-3">
          <h3 className="text-lg font-semibold">Account comparison</h3>
          <p className="mt-1 text-sm text-dash-ink-secondary">
            Actual figures for both periods. Campaign results are compared by
            goal below.
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {deliveryMetrics(facts.current, facts.previous)
            .filter((m) =>
              ["spend", "reach", "impressions", "link_clicks"].includes(m.key),
            )
            .map((metric) => (
              <div
                key={metric.key}
                className="min-w-0 rounded-xl border border-dash-border bg-dash-bg p-4"
              >
                <dt className="text-xs text-dash-ink-secondary">
                  {metric.label}
                </dt>
                <dd className="mt-2 break-words text-2xl font-semibold tabular-nums">
                  {formatted(metric.current, metric.unit, c.currency)}
                </dd>
                <dd className="mt-2">
                  <Change metric={metric} fresh={c.performanceFresh} />
                </dd>
                <dd className="mt-2 text-xs text-dash-ink-secondary">
                  Previous {formatted(metric.previous, metric.unit, c.currency)}
                </dd>
              </div>
            ))}
        </dl>
        <details className="mt-4 rounded-xl border border-dash-border px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium">
            All account metrics
          </summary>
          <MetricsTable
            metrics={deliveryMetrics(facts.current, facts.previous)}
            currency={c.currency}
            fresh={c.performanceFresh}
          />
        </details>
      </section>
      <section aria-label="Campaign results">
        <h3 className="text-lg font-semibold">Campaign comparisons</h3>
        <p className="mt-1 text-sm text-dash-ink-secondary">
          Results follow each campaign’s detected goal, including leads,
          purchases, traffic, video views, app installs and custom events.
        </p>
        {(facts.valueWarning || facts.metricsWarning) && (
          <p className="mt-3 text-sm text-dash-ink-secondary">
            Some metrics are unavailable. Refresh to retry; missing data is
            shown as —.
          </p>
        )}
        {campaigns.map((campaign, index) => {
          const state = comparisonCampaignState(campaign);
          return (
            <article
              id={`meta-campaign-${c.id}-${index}`}
              key={campaign.id ?? campaign.name}
              className="mt-4 scroll-mt-6 rounded-2xl border border-dash-border bg-dash-bg p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h4 className="break-words text-base font-semibold">
                    {campaign.name}
                  </h4>
                  <p className="mt-1 text-xs text-dash-ink-secondary">
                    Goal: {campaign.objective.toLowerCase()}
                  </p>
                </div>
                <PortfolioBadge state={c.performanceFresh ? state : "check"} />
              </div>
              {!campaign.comparableResults && (
                <p className="mt-3 text-sm text-dash-ink-secondary">
                  The goal or result evidence differs across periods. Results
                  are shown without a favorable/unfavorable rating.
                </p>
              )}
              <MetricsTable
                metrics={[
                  ...outcomeMetrics(campaign),
                  ...deliveryMetrics(campaign.current, campaign.previous),
                ]}
                currency={c.currency}
                fresh={c.performanceFresh}
              />
              <p className="mt-2 text-xs text-dash-ink-secondary sm:hidden">
                Swipe the comparison table to see all columns →
              </p>
              <details className="mt-4 border-t border-dash-border pt-3">
                <summary className="cursor-pointer text-sm font-medium">
                  Additional reported metrics
                </summary>
                <MetricsTable
                  metrics={additionalMetrics(campaign)}
                  currency={c.currency}
                  fresh={c.performanceFresh}
                />
                {/purchase/i.test(campaign.objective) && (
                  <p className="mt-3 text-xs text-dash-ink-secondary">
                    Purchase ROAS uses matching purchase value and campaign
                    spend. Attribution can revise recent results.
                  </p>
                )}
              </details>
            </article>
          );
        })}
      </section>
    </div>
  );
}
