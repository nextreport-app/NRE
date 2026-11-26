"use client";
import {
  performancePortfolioCard,
  performancePortfolioAction,
} from "./performance-portfolio-styles";
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
  if (state === "insufficient" || state === "neutral") return null;
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
        <span className="ml-2 inline-block text-xs font-medium text-dash-ink-secondary">
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
      className="mt-4 grid gap-4 sm:grid-cols-2"
      aria-label="Account performance list"
    >
      {rows.map((c) => (
        <article
          key={c.id}
          className={`${performancePortfolioCard} ${selected === c.id ? "border-dash-accent" : "border-dash-border"}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="break-words font-semibold">{c.name}</h2>
            <PortfolioBadge state={c.portfolio.state} />
          </div>
          {c.budgetAttention && (
            <p className="mt-2 text-sm font-medium">
              <span>Budget needs attention</span>
              {c.budget?.facts && (
                <span className="mt-1 block font-normal">
                  Spent {format(c.budget.facts.spent, "money", c.currency)} of{" "}
                  {format(c.budget.config.monthlyBudget, "money", c.currency)}
                </span>
              )}
            </p>
          )}
          {c.performanceFresh && c.portfolio.lead && (
            <div className="mt-2 min-w-0">
              <p className="break-words text-sm">
                <strong className="text-dash-ink">
                  {c.portfolio.lead.name}
                </strong>{" "}
                <span className="text-xs text-dash-ink-secondary">
                  [Campaign]
                </span>
                {!c.portfolio.lead.observation && (
                  <> · {c.portfolio.lead.reason}</>
                )}
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
                : "Choose which Meta ad account belongs to this client."}
            </p>
          )}
          {c.unavailable && (
            <p className="mt-2 text-xs text-dash-ink-secondary">
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
          <button
            id={`open-account-${c.id}`}
            aria-expanded={selected === c.id}
            aria-controls={`account-${c.id}`}
            className={performancePortfolioAction}
            onClick={() => onOpen(c.id)}
          >
            {!c.linked
              ? "Choose ad account"
              : selected === c.id
                ? "Close account"
                : c.performanceEnabled
                  ? "View performance"
                  : "Set up monitoring"}
            <span className="sr-only"> {c.name}</span>
            <span aria-hidden="true">→</span>
          </button>
        </article>
      ))}
    </div>
  );
}
