"use client";
import { useState } from "react";
import { isMeaningfulImprovement } from "@/lib/performance-monitor/meaningful-improvement";
import { hasComparisonActivity } from "@/lib/performance-monitor/campaign-activity";
import type { OverviewRow } from "@/lib/agency-overview";
import type {
  CampaignPerformance,
  PerformanceSignal,
} from "@/lib/performance-monitor/facts";
import {
  campaignRank,
  signalObservation,
} from "@/lib/performance-monitor/portfolio";
import { evaluatePerformanceFacts } from "@/lib/performance-monitor/decision";
import {
  budgetAlertPresentation,
  budgetWindow,
} from "@/lib/budget-monitor-facts";
import { metricChange } from "@/lib/performance-monitor/metric-change";
import {
  remainingAccountMetrics,
  accountHighlightMetrics,
  campaignComparisonMetrics,
  campaignHighlightMetrics,
  duplicateAccountTotals,
  comparisonCampaignState,
  type DashboardMetric,
} from "@/lib/performance-monitor/dashboard-metrics";
import { PortfolioBadge } from "./portfolio-board";
import { signalSummaryLine } from "@/lib/performance-monitor/summary-line";
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
    metric.key.split(":")[0],
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
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{signal.metric}</span>
          {delta && (
            <span className="text-sm font-semibold text-dash-ink-secondary">
              {delta.label}
              {observation?.reference === "target" ? " vs target" : ""}
            </span>
          )}
          <span className="text-xs text-dash-ink-secondary">
            {observation?.reference === "target"
              ? "Compared to saved target"
              : "Compared to previous period"}
          </span>
        </div>
        <span
          className={`ml-auto shrink-0 rounded-full border px-2 py-1 text-xs font-semibold ${!fresh ? "border-dash-border text-dash-ink-secondary" : signal.tone === "critical" ? "border-red-400/40 text-red-400" : signal.tone === "warning" ? "border-amber-400/40 text-amber-400" : "border-emerald-400/40 text-emerald-400"}`}
        >
          {!fresh
            ? "Saved change"
            : signal.tone === "critical"
              ? "Urgent review"
              : signal.tone === "warning"
                ? "Review"
                : "Improvement"}
        </span>
      </div>
      <p className="mt-2 break-words text-sm font-semibold text-dash-ink">
        {campaign.name}{" "}
        <span className="text-xs font-normal text-dash-ink-secondary">
          [Campaign]
        </span>
      </p>
      <p className="mt-1 text-sm text-dash-ink-secondary">
        {signalSummaryLine(campaign, signal)}
      </p>
      <span className="mt-2 block text-xs font-medium underline underline-offset-4">
        Review campaign ↓
      </span>
    </a>
  );
}
function MetricHighlights({
  metrics,
  currency,
  fresh,
}: {
  metrics: DashboardMetric[];
  currency: string;
  fresh: boolean;
}) {
  return (
    <dl
      className={`grid grid-cols-2 gap-3 ${metrics.length % 3 === 0 ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}
    >
      {metrics.map((metric) => (
        <div
          key={metric.key}
          className="min-w-0 rounded-xl border border-dash-border bg-dash-card p-4"
        >
          <dt className="text-xs text-dash-ink-secondary">{metric.label}</dt>
          <dd className="mt-2 break-words text-2xl font-semibold tabular-nums">
            {formatted(metric.current, metric.unit, currency)}
          </dd>
          <dd className="mt-2">
            <Change metric={metric} fresh={fresh} />
          </dd>
          <dd className="mt-2 text-xs text-dash-ink-secondary">
            Previous {formatted(metric.previous, metric.unit, currency)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function MetaPerformanceDashboard({
  client: c,
}: {
  client: OverviewRow;
}) {
  const [showAll, setShowAll] = useState(false);
  const facts = c.performance?.facts
    ? evaluatePerformanceFacts({
        ...c.performance.facts,
        empty: !c.performance.facts.campaigns.some(hasComparisonActivity),
        campaigns: c.performance.facts.campaigns.filter(hasComparisonActivity),
      })
    : undefined;
  if (!facts) return null;
  const highlights = accountHighlightMetrics(facts);
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
  const improvements = c.performanceFresh
    ? changes.filter(({ campaign, signal }) =>
        isMeaningfulImprovement(campaign, signal),
      )
    : [];
  const urgent = new Set(
    issues.filter((s) => s.signal.tone === "critical").map((s) => s.index),
  ).size;
  const budgetWindowNow = budgetWindow(c.timezone);
  const budgetAlert =
    c.budgetFresh && c.budget?.facts && c.budget.config.monthlyBudget
      ? budgetAlertPresentation(
          c.budget.facts,
          c.budget.config.monthlyBudget,
          c.currency,
          budgetWindowNow.days - budgetWindowNow.completedDays,
        )
      : null;
  const budgetCritical = budgetAlert?.tone === "critical";
  const unassessed = campaigns.some((c) =>
    ["insufficient", "no-delivery"].includes(comparisonCampaignState(c)),
  );
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
        className={`rounded-2xl border p-4 sm:p-5 ${budgetCritical || (urgent && c.performanceFresh) ? "border-dash-border border-l-4 border-l-red-400 bg-dash-bg" : (issues.length && c.performanceFresh) || budgetAlert?.tone === "warning" ? "border-dash-border border-l-4 border-l-amber-400 bg-dash-bg" : "border-dash-border bg-dash-bg"}`}
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-dash-ink-secondary">
          Comparison summary
        </p>
        <h3 className="mt-2 text-xl font-semibold">
          {budgetAlert &&
          budgetAlert.tone !== "neutral" &&
          (!c.performanceFresh || (budgetCritical ? !urgent : !issues.length))
            ? budgetAlert!.title
            : !c.performanceFresh
              ? "Refresh to review current changes"
              : urgent
                ? `${urgent} campaign${urgent === 1 ? " needs" : "s need"} urgent review${budgetCritical ? " · budget alert" : ""}`
                : issues.length
                  ? `${issues.length} change${issues.length === 1 ? "" : "s"} need${issues.length === 1 ? "s" : ""} review`
                  : facts.empty
                    ? "No delivery in these periods"
                    : unassessed
                      ? "Review the comparison below"
                      : improvements.length
                        ? `${improvements.length} significant improvement${improvements.length === 1 ? "" : "s"}`
                        : "No material changes detected"}
        </h3>
        {!c.performanceFresh && (
          <p className="mt-2 text-sm text-dash-ink-secondary">
            These are saved figures. Refresh before making decisions.
          </p>
        )}
        {budgetAlert && budgetAlert.tone !== "neutral" && (
          <a
            href={`#meta-budget-${c.id}`}
            role="alert"
            className={`mt-4 block rounded-xl border p-4 ${budgetCritical ? "border-red-400/30 border-l-4 border-l-red-400 bg-dash-bg" : "border-amber-400/30 border-l-4 border-l-amber-400 bg-dash-bg"}`}
          >
            <p
              className={`font-semibold ${budgetCritical ? "text-red-400" : "text-amber-400"}`}
            >
              {budgetCritical
                ? "Critical budget alert"
                : c.budgetAttention
                  ? "Budget warning"
                  : "Budget notice"}{" "}
              · {budgetAlert.title}
            </p>
            <p className="mt-2 text-sm">{budgetAlert.description}</p>
            <span className="mt-2 block text-xs underline">
              Review budget ↓
            </span>
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
            Review results and costs below.
          </p>
        )}
        {!!improvements.length && (
          <details className="mt-4 border-t border-dash-border pt-4">
            <summary className="cursor-pointer text-sm font-medium">
              Improvements ({improvements.length})
            </summary>
            <p className="mt-2 text-xs text-dash-ink-secondary">
              Substantial gains in campaign results or efficiency compared to
              the previous period.
            </p>
            <div className="mt-3 space-y-3">{improvements.map(issueCard)}</div>
          </details>
        )}
      </section>
      <details
        key={`${c.id}:${campaigns.length === 1}`}
        open={campaigns.length !== 1}
        aria-label="Account metrics"
        className="rounded-2xl border border-blue-400/25 bg-dash-bg p-4 sm:p-5"
      >
        <summary className="cursor-pointer text-lg font-semibold text-blue-400">
          Account totals
        </summary>
        {duplicateAccountTotals(facts) && (
          <p className="mt-2 text-xs text-dash-ink-secondary">
            These totals match the single campaign below.
          </p>
        )}
        <div className="mt-4">
          <MetricHighlights
            metrics={highlights}
            currency={c.currency}
            fresh={c.performanceFresh}
          />
          <div className="mt-4">
            <MetricsTable
              metrics={remainingAccountMetrics(facts)}
              currency={c.currency}
              fresh={c.performanceFresh}
            />
          </div>
        </div>
      </details>
      <section
        aria-label="Campaign results"
        className="rounded-2xl border border-dash-border bg-dash-bg p-4 sm:p-5"
      >
        <h3 className="text-lg font-semibold text-blue-400">
          Campaign comparisons
        </h3>
        {(facts.valueWarning || facts.metricsWarning) && (
          <p className="mt-3 text-sm text-dash-ink-secondary">
            Some metrics are unavailable. Refresh to retry; missing data is
            shown as —.
          </p>
        )}
        {campaigns.map((campaign, index) => {
          const state = comparisonCampaignState(campaign);
          const cards = campaignHighlightMetrics(campaign);
          const cardKeys = new Set(cards.map((m) => m.key));
          return (
            <article
              id={`meta-campaign-${c.id}-${index}`}
              key={campaign.id ?? campaign.name}
              className="mt-4 scroll-mt-6 rounded-2xl border border-dash-border bg-dash-bg p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h4 className="break-words text-base font-semibold text-blue-400">
                    {campaign.name}{" "}
                    <span className="text-xs font-normal text-dash-ink-secondary">
                      [Campaign]
                    </span>
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
              <div className="mt-4">
                <MetricHighlights
                  metrics={cards}
                  currency={c.currency}
                  fresh={c.performanceFresh}
                />
              </div>
              {campaign.current.spend === 0 &&
                campaign.current.impressions === 0 && (
                  <p className="mt-3 text-xs text-dash-ink-secondary">
                    No delivery in the selected period · shown for
                    previous-period activity.
                  </p>
                )}
              <MetricsTable
                metrics={campaignComparisonMetrics(campaign).filter(
                  (m) => !cardKeys.has(m.key),
                )}
                currency={c.currency}
                fresh={c.performanceFresh}
              />
              <p className="mt-2 text-xs text-dash-ink-secondary sm:hidden">
                Swipe the comparison table to see all columns →
              </p>
            </article>
          );
        })}
      </section>
    </div>
  );
}
