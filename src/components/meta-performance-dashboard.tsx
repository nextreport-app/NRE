"use client";
import { useState } from "react";
import type { OverviewRow } from "@/lib/agency-overview";
import type {
  CampaignPerformance,
  PeriodMetrics,
} from "@/lib/performance-monitor/facts";
import {
  campaignBrief,
  campaignRank,
} from "@/lib/performance-monitor/portfolio";
import {
  metricChange,
  type MetricDirection,
} from "@/lib/performance-monitor/metric-change";
import { PortfolioBadge } from "./portfolio-board";
import { CampaignTargetForm } from "./performance-decision-controls";

type Metric = {
  label: string;
  current: number | null | undefined;
  previous: number | null | undefined;
  unit?: "money" | "percent" | "multiple";
  direction: MetricDirection;
};
const words = (s: string) =>
  s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
function formatted(
  n: Metric["current"],
  unit: Metric["unit"],
  currency: string,
) {
  if (n == null) return "—";
  return (
    new Intl.NumberFormat(
      "en-US",
      unit === "money"
        ? { style: "currency", currency, maximumFractionDigits: 2 }
        : {
            maximumFractionDigits:
              unit === "percent" || unit === "multiple" ? 2 : 1,
          },
    ).format(n) + (unit === "percent" ? "%" : unit === "multiple" ? "×" : "")
  );
}
function Change({ metric, fresh }: { metric: Metric; fresh: boolean }) {
  const delta = metricChange(
    metric.current,
    metric.previous,
    metric.direction,
    fresh,
  );
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${delta.tone === "positive" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-400" : delta.tone === "negative" ? "border-red-400/30 bg-red-400/10 text-red-400" : "border-dash-border text-dash-ink-secondary"}`}
    >
      {delta.label}
    </span>
  );
}
function Tile({
  metric,
  currency,
  fresh,
}: {
  metric: Metric;
  currency: string;
  fresh: boolean;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-dash-border bg-dash-bg p-4">
      <dt className="text-xs font-medium text-dash-ink-secondary">
        {metric.label}
      </dt>
      <dd className="mt-2 break-words text-2xl font-semibold tracking-tight">
        {formatted(metric.current, metric.unit, currency)}
      </dd>
      <dd className="mt-2">
        <Change metric={metric} fresh={fresh} />
      </dd>
      <dd className="mt-2 text-xs text-dash-ink-secondary">
        Previous {formatted(metric.previous, metric.unit, currency)}
      </dd>
    </div>
  );
}
function delivery(a: PeriodMetrics, b: PeriodMetrics): Metric[] {
  return [
    {
      label: "Ad spend",
      current: a.spend,
      previous: b.spend,
      unit: "money",
      direction: "neutral",
    },
    {
      label: "Impressions",
      current: a.impressions,
      previous: b.impressions,
      direction: "neutral",
    },
    {
      label: "Clicks (all)",
      current: a.clicks,
      previous: b.clicks,
      direction: "neutral",
    },
    {
      label: "CTR (all)",
      current: a.ctr,
      previous: b.ctr,
      unit: "percent",
      direction: "higher",
    },
    {
      label: "CPC (all)",
      current: a.cpc,
      previous: b.cpc,
      unit: "money",
      direction: "lower",
    },
    {
      label: "CPM",
      current: a.impressions > 0 ? (a.spend / a.impressions) * 1000 : null,
      previous: b.impressions > 0 ? (b.spend / b.impressions) * 1000 : null,
      unit: "money",
      direction: "neutral",
    },
  ];
}
function outcomes(c: CampaignPerformance): Metric[] {
  const direction = c.comparableResults;
  return [
    {
      label: words(c.objective),
      current: c.current.results,
      previous: c.previous.results,
      direction: direction ? "higher" : "neutral",
    },
    {
      label: words(c.costLabel),
      current: c.current.cpr,
      previous: c.previous.cpr,
      unit: "money",
      direction: direction ? "lower" : "neutral",
    },
    ...(/purchase/i.test(c.objective)
      ? [
          {
            label: "Purchase ROAS",
            current: c.current.roas,
            previous: c.previous.roas,
            unit: "multiple" as const,
            direction: direction ? ("higher" as const) : ("neutral" as const),
          },
          {
            label: "Purchase value",
            current: c.current.purchaseValue,
            previous: c.previous.purchaseValue,
            unit: "money" as const,
            direction: direction ? ("higher" as const) : ("neutral" as const),
          },
        ]
      : []),
  ];
}
export function MetaPerformanceDashboard({
  client: c,
  busy,
  save,
}: {
  client: OverviewRow;
  busy: boolean;
  save: (body: object) => Promise<boolean>;
}) {
  const [showAll, setShowAll] = useState(false);
  const facts = c.performance?.facts;
  if (!facts) return null;
  const campaigns = [...facts.campaigns].sort(
    (a, b) => campaignRank(a) - campaignRank(b),
  );
  const signals = campaigns
    .flatMap((campaign, index) =>
      campaign.signals.map((signal) => ({ campaign, signal, index })),
    )
    .sort(
      (a, b) =>
        ({ critical: 0, warning: 1, positive: 2 })[a.signal.tone] -
        { critical: 0, warning: 1, positive: 2 }[b.signal.tone],
    );
  const urgent = signals.filter((s) => s.signal.tone === "critical").length;
  const review = signals.filter((s) => s.signal.tone === "warning").length;
  const positive = signals.filter((s) => s.signal.tone === "positive").length;
  return (
    <div className="mt-5 space-y-6">
      <section
        aria-label="Performance summary"
        className={`rounded-2xl border p-4 sm:p-5 ${!c.performanceFresh ? "border-dash-border bg-dash-bg" : urgent ? "border-red-400/40 bg-red-400/5" : review ? "border-amber-400/40 bg-amber-400/5" : "border-dash-border bg-dash-bg"}`}
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-dash-ink-secondary">
          Your performance brief
        </p>
        <h3 className="mt-2 text-xl font-semibold">
          {!c.performanceFresh
            ? "Refresh to assess current performance"
            : urgent
              ? `${urgent} critical signal${urgent === 1 ? " needs" : "s need"} attention`
              : review
                ? `${review} change${review === 1 ? "" : "s"} worth reviewing`
                : positive
                  ? "Improvements to review"
                  : facts.empty
                    ? "No delivery in these periods"
                    : "No warning thresholds crossed"}
        </h3>
        <p className="mt-2 text-sm text-dash-ink-secondary">
          {!c.performanceFresh
            ? "These are saved figures. Refresh before making decisions."
            : `${campaigns.length} campaign${campaigns.length === 1 ? "" : "s"} · ${urgent} critical · ${review} to review · ${positive} positive`}
        </p>
        {c.budgetAttention && (
          <a
            href={`#meta-budget-${c.id}`}
            className={`mt-3 block rounded-xl border border-dash-border bg-dash-card p-3 text-sm font-semibold ${c.budgetCritical ? "text-red-400" : "text-amber-400"}`}
          >
            Budget: {c.budgetLabel} · View pacing ↓
          </a>
        )}
        {!!signals.length && (
          <div className="mt-4 space-y-2">
            {(showAll ? signals : signals.slice(0, 3)).map(
              ({ campaign, signal, index }) => (
                <a
                  key={`${index}-${signal.key}`}
                  href={`#meta-campaign-${c.id}-${index}`}
                  className="block rounded-xl border border-dash-border bg-dash-card p-3 transition-colors hover:bg-dash-bg"
                >
                  <span
                    className={`text-sm font-semibold ${!c.performanceFresh ? "text-dash-ink-secondary" : signal.tone === "critical" ? "text-red-400" : signal.tone === "warning" ? "text-amber-400" : "text-emerald-400"}`}
                  >
                    {signal.metric}
                    {signal.change == null
                      ? ""
                      : ` ${signal.change > 0 ? "+" : "−"}${Math.abs(signal.change).toFixed(1)}%`}{" "}
                    ·{" "}
                    {signal.state === "continuing"
                      ? "Continuing"
                      : signal.state === "recovered"
                        ? "Recovered"
                        : "New"}
                  </span>
                  <span className="mt-1 block break-words text-sm">
                    {campaign.name}
                  </span>
                  <span className="mt-1 block text-xs text-dash-ink-secondary">
                    {signal.message}
                  </span>
                  <span className="mt-2 block text-xs font-medium text-dash-ink underline underline-offset-4">
                    View campaign ↓
                  </span>
                </a>
              ),
            )}
          </div>
        )}
        {signals.length > 3 && (
          <button
            type="button"
            className="mt-3 text-sm font-medium text-dash-accent"
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll
              ? "Show fewer changes"
              : `View all ${signals.length} changes`}
          </button>
        )}
        {!signals.length && !facts.empty && (
          <p className="mt-3 text-sm text-dash-ink-secondary">
            Check campaign results below. Low-volume or incomplete comparisons
            still need more data.
          </p>
        )}
      </section>
      <section aria-label="Account metrics">
        <div className="mb-4">
          <h3 className="text-lg font-semibold">Account performance</h3>
          <p className="mt-1 text-xs text-dash-ink-secondary">
            {facts.periodA.startIso} – {facts.periodA.endIso} vs{" "}
            {facts.periodB.startIso} – {facts.periodB.endIso} · {c.timezone}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {delivery(facts.current, facts.previous).map((metric) => (
            <Tile
              key={metric.label}
              metric={metric}
              currency={c.currency}
              fresh={c.performanceFresh}
            />
          ))}
        </dl>
        <p className="mt-3 text-xs text-dash-ink-secondary">
          Green shows favorable efficiency or outcome changes; red shows
          unfavorable changes. Spend and delivery volume stay neutral. Alerts
          also account for data volume.
        </p>
      </section>
      <section aria-label="Campaign results">
        <h3 className="text-lg font-semibold">Campaign results</h3>
        <p className="mt-1 text-sm text-dash-ink-secondary">
          Results and costs are shown by campaign goal. Campaigns needing
          attention appear first.
        </p>
        {facts.valueWarning && (
          <p className="mt-3 text-sm text-amber-400">
            Purchase values are incomplete. Refresh before assessing ROAS.
          </p>
        )}
        {campaigns.map((campaign, index) => (
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
                  {words(campaign.objective)}
                </p>
              </div>
              <PortfolioBadge
                state={
                  c.performanceFresh ? campaignBrief(campaign).state : "check"
                }
              />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3">
              {outcomes(campaign).map((metric) => (
                <Tile
                  key={metric.label}
                  metric={metric}
                  currency={c.currency}
                  fresh={c.performanceFresh}
                />
              ))}
            </dl>
            {!campaign.comparableResults && (
              <p className="mt-3 text-xs text-dash-ink-secondary">
                Results are not comparable across both periods; outcome changes
                stay neutral.
              </p>
            )}
            <p className="mt-3 text-sm text-dash-ink-secondary">
              {c.performanceFresh
                ? campaignBrief(campaign).reason
                : "Saved snapshot. Refresh before assessing this campaign."}
            </p>
            <details className="mt-4 border-t border-dash-border pt-3">
              <summary className="cursor-pointer text-sm font-medium">
                All metrics &amp; comparison
              </summary>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead>
                    <tr className="text-xs text-dash-ink-secondary">
                      <th className="py-2">Metric</th>
                      <th>Current</th>
                      <th>Previous</th>
                      <th>Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ...delivery(campaign.current, campaign.previous),
                      ...outcomes(campaign),
                    ].map((metric) => (
                      <tr
                        key={metric.label}
                        className="border-t border-dash-border"
                      >
                        <th className="py-3 pr-3 font-normal">
                          {metric.label}
                        </th>
                        <td className="pr-3">
                          {formatted(metric.current, metric.unit, c.currency)}
                        </td>
                        <td className="pr-3">
                          {formatted(metric.previous, metric.unit, c.currency)}
                        </td>
                        <td>
                          <Change metric={metric} fresh={c.performanceFresh} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/purchase/i.test(campaign.objective) && (
                <p className="mt-3 text-xs text-dash-ink-secondary">
                  ROAS uses matching purchase values and campaign-level spend:{" "}
                  {formatted(campaign.current.roasSpend, "money", c.currency)}{" "}
                  current,{" "}
                  {formatted(campaign.previous.roasSpend, "money", c.currency)}{" "}
                  previous. Attribution can revise recent results.
                </p>
              )}
              <CampaignTargetForm
                client={c}
                campaign={campaign}
                busy={busy}
                save={save}
              />
            </details>
          </article>
        ))}
      </section>
    </div>
  );
}
