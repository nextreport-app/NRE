"use client";
import {
  performancePortfolioCard,
  performancePortfolioAction,
} from "./performance-portfolio-styles";
import type { OverviewRow } from "@/lib/agency-overview";
import {
  PORTFOLIO_LABELS,
  type PortfolioState,
} from "@/lib/performance-monitor/portfolio";
export const PORTFOLIO_FILTERS = [
  { key: "all", label: "All accounts" },
  { key: "critical", label: "Critical" },
  { key: "review", label: "Review" },
  { key: "positive", label: "Improvement" },
  { key: "setup", label: "Needs setup" },
] as const;
export function matchesPortfolio(row: OverviewRow, filter: string) {
  return (
    filter === "all" ||
    filter === row.portfolio.state ||
    (filter === "positive" && (row.counts?.improving ?? 0) > 0) ||
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
export function AccountStatusBadges({ client }: { client: OverviewRow }) {
  return (
    <div
      className="flex flex-wrap justify-end gap-2"
      aria-label="Account status"
    >
      <PortfolioBadge state={client.portfolio.state} />
      {(client.portfolio.state === "critical" ||
        client.portfolio.state === "review") &&
        (client.counts?.improving ?? 0) > 0 && (
          <PortfolioBadge state="positive" />
        )}
    </div>
  );
}
function money(value: number | null, currency: string) {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}
/** One account-level summary only; campaign details belong in the dashboard. */
function accountSummary(c: OverviewRow) {
  if (!c.linked) return "Choose which Meta ad account belongs to this client.";
  if (!c.performanceEnabled)
    return "Set up monitoring to view account performance.";
  if (c.unavailable)
    return "Saved data needs a fresh check. Open the account to refresh.";
  if (c.portfolio.state === "critical" || c.portfolio.state === "review")
    return "Performance needs attention. Open the account for details.";
  if (c.performanceFresh && !c.portfolio.coverage.total)
    return "No delivery was returned for either period.";
  return "Open the account to review performance.";
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
          className={`${performancePortfolioCard} flex flex-col ${c.linked && c.performanceEnabled ? "nre-performance-card-ready" : "border-dash-border"}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="break-words font-semibold">{c.name}</h2>
            <AccountStatusBadges client={c} />
          </div>
          <div className="mt-3 flex-1 text-sm text-dash-ink-secondary">
            {c.budgetAttention ? (
              <p>
                <span className="font-medium text-dash-ink">
                  Budget needs attention
                </span>
                {c.budget?.facts && (
                  <span className="mt-1 block">
                    Spent {money(c.budget.facts.spent, c.currency)} of{" "}
                    {money(c.budget.config.monthlyBudget, c.currency)}
                  </span>
                )}
              </p>
            ) : (
              <p>{accountSummary(c)}</p>
            )}
          </div>
          <button
            id={`open-account-${c.id}`}
            aria-expanded={selected === c.id}
            aria-controls={`account-${c.id}`}
            className={`${performancePortfolioAction} self-start ${c.linked && c.performanceEnabled ? "nre-performance-action-ready" : ""}`}
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
