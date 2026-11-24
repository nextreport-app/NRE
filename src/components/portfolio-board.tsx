"use client";
import Link from "next/link";
import { metricChange } from "@/lib/performance-monitor/metric-change";
import type { OverviewRow } from "@/lib/agency-overview";
import {
  PORTFOLIO_LABELS,
  type PortfolioState,
  type Observation,
} from "@/lib/performance-monitor/portfolio";
export const PORTFOLIO_FILTERS = [
  { key: "all", label: "All accounts" },
  { key: "critical", label: "Critical" },
  { key: "review", label: "Review" },
  { key: "positive", label: "Positive" },
  { key: "neutral", label: "Neutral" },
  { key: "data", label: "Needs data" },
  { key: "setup", label: "Needs setup" },
] as const;
export function matchesPortfolio(row: OverviewRow, filter: string) {
  return (
    filter === "all" ||
    filter === row.portfolio.state ||
    (filter === "data" &&
      ["check", "insufficient", "no-delivery"].includes(row.portfolio.state))
  );
}
export function PortfolioBadge({ state }: { state: PortfolioState }) {
  return (
    <span
      className={`inline-block rounded-full border px-2 py-1 text-xs ${state === "critical" ? "border-red-400 text-red-400" : state === "review" ? "border-amber-400 text-amber-400" : state === "positive" ? "border-emerald-400 text-emerald-400" : "border-dash-border text-dash-ink-secondary"}`}
    >
      {PORTFOLIO_LABELS[state]}
    </span>
  );
}
function format(n: number | null, unit: Observation["unit"], currency: string) {
  if (n === null) return "—";
  return unit === "money"
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }).format(n)
    : new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n) +
        (unit === "percent" ? "%" : unit === "multiple" ? "×" : "");
}
export function ObservationLine({
  observation: o,
  currency,
}: {
  observation: Observation;
  currency: string;
}) {
  const delta = metricChange(
    o.current,
    o.previous,
    /cost|cpc|cpl|cpr/i.test(o.metric)
      ? "cpr"
      : /ctr/i.test(o.metric)
        ? "ctr"
        : /roas/i.test(o.metric)
          ? "roas"
          : "results",
    o.metric,
  );
  return (
    <p className="mt-1 text-sm">
      <strong>
        {o.metric}: {format(o.current, o.unit, currency)}
      </strong>
      {" · "}
      {o.reference === "target" ? "Target" : "Previous"}{" "}
      {format(o.previous, o.unit, currency)}
      {o.change !== null && (
        <span
          className={`ml-2 inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${delta.tone === "positive" ? "border-emerald-400/30 text-emerald-400" : delta.tone === "negative" ? "border-red-400/30 text-red-400" : "border-dash-border text-dash-ink-secondary"}`}
        >
          {delta.label}
          {o.reference === "target" ? " vs target" : ""}
        </span>
      )}
    </p>
  );
}
export function PortfolioBoard({
  rows,
  selected,
  onOpen,
}: {
  rows: OverviewRow[];
  selected: string;
  onOpen: (id: string) => void;
}) {
  return (
    <div
      className="mt-4 grid gap-3 md:grid-cols-2"
      aria-label="Account performance list"
    >
      {rows.map((c) => (
        <article
          key={c.id}
          className={`min-w-0 rounded-xl border bg-dash-card p-4 ${selected === c.id ? "border-dash-accent" : "border-dash-border"}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="break-words font-semibold">{c.name}</h2>
            <PortfolioBadge state={c.portfolio.state} />
          </div>
          {c.budgetAttention && (
            <p className="mt-2 text-sm font-medium">
              Monthly budget · {c.budgetLabel}.
              {c.budget?.facts && (
                <span className="mt-1 block font-normal">
                  Spent {format(c.budget.facts.spent, "money", c.currency)} of{" "}
                  {format(c.budget.config.monthlyBudget, "money", c.currency)}
                  {c.budget.facts.projected === null
                    ? ""
                    : ` · Forecast ${format(c.budget.facts.projected, "money", c.currency)}`}
                </span>
              )}
            </p>
          )}
          {c.performanceFresh && c.portfolio.lead && (
            <div className="mt-2 min-w-0">
              <p className="break-words text-sm">
                <strong>{c.portfolio.lead.name}</strong> ·{" "}
                {c.portfolio.lead.reason}
              </p>
              {c.portfolio.lead.observation && (
                <ObservationLine
                  observation={c.portfolio.lead.observation}
                  currency={c.currency}
                />
              )}
            </div>
          )}
          {c.portfolio.state === "setup" && (
            <p className="mt-2 text-sm">
              {c.linked
                ? "Ready to load campaign performance."
                : "No Meta ad account linked yet."}
            </p>
          )}
          {c.unavailable && (
            <p className="mt-2 text-xs text-amber-400">
              {!c.performanceFresh && c.performanceEnabled
                ? "Performance needs a fresh check. "
                : ""}
              {!c.budgetFresh && c.budgetEnabled
                ? "Budget needs a fresh check."
                : ""}{" "}
              Prior data does not establish current performance.
            </p>
          )}
          {c.performanceFresh && !c.portfolio.coverage.total && (
            <p className="mt-2 text-sm">
              No delivery was returned for either period.
            </p>
          )}
          {!c.linked ? (
            <Link
              id={`open-account-${c.id}`}
              href={`/clients/${c.id}/reports/new`}
              className="mt-3 inline-flex rounded-xl border border-dash-border px-3 py-2 text-sm font-medium text-dash-accent"
            >
              Link Meta account<span className="sr-only"> for {c.name}</span>
            </Link>
          ) : (
            <button
              id={`open-account-${c.id}`}
              aria-expanded={selected === c.id}
              aria-controls={`account-${c.id}`}
              className="mt-3 rounded-lg border border-dash-border px-3 py-2 text-sm"
              onClick={() => onOpen(c.id)}
            >
              {selected === c.id
                ? "Close account"
                : c.performanceEnabled
                  ? "View performance"
                  : "Set up monitoring"}
              <span className="sr-only"> {c.name}</span>
            </button>
          )}
        </article>
      ))}
    </div>
  );
}
