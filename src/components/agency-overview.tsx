"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { OverviewRow } from "@/lib/agency-overview";
import {
  DecisionSettingsPanel,
  CampaignTargetForm,
} from "./performance-decision-controls";
import {
  PortfolioBoard,
  PortfolioBadge,
  PORTFOLIO_FILTERS,
  matchesPortfolio,
} from "./portfolio-board";
import { PortfolioRefresh } from "./portfolio-refresh";
import {
  campaignBrief,
  campaignRank,
  portfolioRank,
} from "@/lib/performance-monitor/portfolio";
import type { PeriodMetrics } from "@/lib/performance-monitor/facts";
const button =
  "rounded-lg border border-dash-border px-3 py-2 text-sm disabled:opacity-50";
export function AgencyOverview({
  initialClientId = "",
}: {
  initialClientId?: string;
}) {
  const [clients, setClients] = useState<OverviewRow[] | null>(null),
    [error, setError] = useState(""),
    [singleBusy, setBusy] = useState<string | null>(null),
    [bulkRunning, setBulkRunning] = useState(false),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [expanded, setExpanded] = useState(initialClientId);
  const busy = singleBusy ?? (bulkRunning ? "bulk" : null);
  const loaded = clients !== null;
  useEffect(() => {
    const panel =
      expanded && loaded
        ? document.getElementById(`account-${expanded}`)
        : null;
    if (panel) {
      panel.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "start",
      });
      panel.focus({ preventScroll: true });
    }
  }, [expanded, loaded]);
  function selectAccount(id: string) {
    const closing = expanded === id;
    setExpanded(closing ? "" : id);
    if (closing)
      requestAnimationFrame(() =>
        document.getElementById(`open-account-${id}`)?.focus(),
      );
  }
  const load = useCallback(async () => {
    const r = await fetch("/api/agency-overview", { cache: "no-store" });
    const data = await r.json();
    if (!r.ok) throw Error(data.error ?? "Overview could not load.");
    setClients(data.clients);
    setError("");
  }, []);
  useEffect(() => {
    const refresh = () => void load().catch((e) => setError(e.message));
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [load]);
  async function action(
    id: string,
    kind: "performance-monitor" | "budget-monitor",
    body: object,
  ) {
    setBusy(id);
    setError("");
    if (
      kind === "performance-monitor" &&
      "enabled" in body &&
      "emailEnabled" in body
    ) {
      const enabled = !!body.enabled,
        emailEnabled = !!body.emailEnabled;
      setClients(
        (previous) =>
          previous?.map((c) =>
            c.id === id
              ? { ...c, performanceEnabled: enabled, emailEnabled }
              : c,
          ) ?? null,
      );
    }
    try {
      const r = await fetch(`/api/clients/${encodeURIComponent(id)}/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await r.json();
      if (!r.ok) throw Error(result.error ?? "Check failed.");
      await load();
      return true;
    } catch (e) {
      await load().catch(() => {});
      setError(e instanceof Error ? e.message : "Check failed.");
      return false;
    } finally {
      setBusy(null);
    }
  }
  const visible = clients?.filter(
    (c) =>
      (!search || c.name.toLowerCase().includes(search.toLowerCase())) &&
      matchesPortfolio(c, filter),
  );
  visible?.sort(
    (a, b) =>
      Number(b.id === initialClientId) - Number(a.id === initialClientId) ||
      portfolioRank[a.portfolio.state] - portfolioRank[b.portfolio.state] ||
      a.name.localeCompare(b.name),
  );
  const money = (n: number | null | undefined, c: OverviewRow) =>
    n === null || n === undefined
      ? "—"
      : new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: c.currency,
          maximumFractionDigits: 2,
        }).format(n);
  const value = (n: number | null | undefined, digits = 0) =>
    n === null || n === undefined
      ? "—"
      : new Intl.NumberFormat("en-US", {
          maximumFractionDigits: digits,
        }).format(n);
  const date = (s: string, c: OverviewRow) =>
    new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: c.timezone,
    }).format(new Date(s));
  function metrics(m: PeriodMetrics, c: OverviewRow) {
    return (
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        {[
          ["Ad spend", money(m.spend, c)],
          ["Impressions", value(m.impressions)],
          ["CTR (all)", m.ctr === null ? "—" : `${value(m.ctr, 2)}%`],
          ["CPC (all)", money(m.cpc, c)],
        ].map(([label, text]) => (
          <div key={label}>
            <dt className="text-xs text-dash-ink-secondary">{label}</dt>
            <dd className="mt-1 font-semibold">{text}</dd>
          </div>
        ))}
      </dl>
    );
  }
  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl text-dash-ink">
      <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-bold">Agency overview</h1><Link className={button} href="/reports">Report inbox →</Link></div>
      <p className="mt-2 text-sm text-dash-ink-secondary">
        Meta performance and approved budget pacing, across your clients.
      </p>
      <nav aria-label="Overview type" className="mt-4 flex flex-wrap gap-2">
        <span
          className={`${button} border-dash-accent text-dash-accent`}
          aria-current="page"
        >
          Meta Ads
        </span>
        <Link href="/websites" className={button}>
          Website traffic (GA4)
        </Link>
      </nav>
      {clients && (
        <nav
          aria-label="Account status"
          className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3"
        >
          {PORTFOLIO_FILTERS.filter((f) => f.key !== "all").map((f) => (
            <button
              key={f.key}
              aria-pressed={filter === f.key}
              className={`rounded-xl border bg-dash-card p-3 text-left ${filter === f.key ? "border-dash-accent" : "border-dash-border"}`}
              onClick={() => {
                setFilter(f.key);
                setExpanded("");
              }}
            >
              <span className="text-xs text-dash-ink-secondary">{f.label}</span>
              <span className="mt-1 block text-2xl font-semibold">
                {clients.filter((c) => matchesPortfolio(c, f.key)).length}
              </span>
            </button>
          ))}
        </nav>
      )}
      <div className="mt-5 flex flex-wrap gap-3">
        <input
          aria-label="Search clients"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Find a client"
          className="w-full min-w-0 rounded-lg border border-dash-border bg-dash-bg px-3 py-2 sm:w-auto sm:flex-1"
        />
        <select
          aria-label="Filter accounts"
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setExpanded("");
          }}
          className="rounded-lg border border-dash-border bg-dash-bg px-3 py-2"
        >
          {PORTFOLIO_FILTERS.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
        </select>
        <button
          disabled={!!busy}
          className={button}
          onClick={() => void load().catch((e) => setError(e.message))}
        >
          Reload overview
        </button>
      </div>
      <details className="mt-3 text-xs text-dash-ink-secondary">
        <summary className="cursor-pointer">How statuses work</summary>
        <p className="mt-2">
          Sorted by urgency using saved snapshots. Positive means an observed
          improvement or a saved target met. Neutral requires sufficient
          comparable outcomes. Needs data includes stale, low-volume and
          no-delivery accounts. Check timestamps before acting. Each account
          uses its own currency and timezone; budgets exclude tax.
        </p>
      </details>
      {clients && (
        <PortfolioRefresh
          clients={clients}
          disabled={!!singleBusy}
          onActivity={setBulkRunning}
          onComplete={load}
        />
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-amber-400">
          {error}
        </p>
      )}
      {!clients && !error && <p className="mt-5">Loading accounts…</p>}
      {clients?.length === 0 && (
        <div className="mt-6 rounded-xl border border-dash-border p-5">
          <p>Add a client to begin.</p>
          <Link
            className="mt-3 inline-block text-dash-accent"
            href="/clients/new"
          >
            Add client →
          </Link>
        </div>
      )}
      {clients && clients.length > 0 && visible?.length === 0 && (
        <p className="mt-5 text-sm">No clients match this view.</p>
      )}
      {visible && (
        <PortfolioBoard
          rows={visible}
          selected={expanded}
          onOpen={selectAccount}
        />
      )}
      {visible
        ?.filter((c) => c.id === expanded)
        .map((c) => (
          <section
            id={`account-${c.id}`}
            tabIndex={-1}
            aria-label={`${c.name} performance and settings`}
            key={c.id}
            className="mt-4 min-w-0 rounded-xl border border-dash-border bg-dash-card p-4 sm:p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{c.name}</h2>
                <p className="mt-1 text-xs text-dash-ink-secondary">
                  {c.currency} · {c.timezone}
                </p>
              </div>
              <PortfolioBadge state={c.portfolio.state} />
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm font-medium">{c.budgetLabel}</p>
                {c.budget?.facts && (
                  <p
                    className={`mt-1 text-sm ${c.budgetFresh ? "" : "text-dash-ink-secondary"}`}
                  >
                    {money(c.budget.facts.spent, c)} spent of{" "}
                    {money(c.budget.config.monthlyBudget, c)} · Projected{" "}
                    {money(c.budget.facts.projected, c)}
                    {c.budgetFresh && (
                      <span className="mt-1 block text-xs">
                        {(c.budget.facts.projectedOver ?? 0) >
                        c.budget.facts.tolerance ? (
                          <>
                            Projected over budget by{" "}
                            {money(c.budget.facts.projectedOver, c)}.{" "}
                          </>
                        ) : (c.budget.facts.projectedShortfall ?? 0) >
                          c.budget.facts.tolerance ? (
                          <>
                            Projected underspend of{" "}
                            {money(c.budget.facts.projectedShortfall, c)}.{" "}
                          </>
                        ) : null}
                        Remaining daily allowance: {money(c.dailyAllowance, c)}{" "}
                        through month end, including today. Planning guide;
                        adjust budgets in Ads Manager.
                      </span>
                    )}
                  </p>
                )}
                {c.budget?.checkedAt && (
                  <p className="mt-1 text-xs text-dash-ink-secondary">
                    {c.budgetFresh ? "Checked" : "Prior snapshot"}:{" "}
                    {date(c.budget.checkedAt, c)}
                  </p>
                )}
                {c.budget?.error && (
                  <p className="mt-1 text-xs text-amber-400">
                    {c.budget.error}
                  </p>
                )}
              </div>
              <div>
                <p className="text-sm font-medium">
                  {c.performanceFresh
                    ? `${c.warnings} performance signal${c.warnings === 1 ? "" : "s"} to review`
                    : c.performanceEnabled
                      ? "Performance check needed"
                      : "Performance monitoring off"}
                </p>
                {c.performance?.facts && (
                  <p className="mt-1 text-xs text-dash-ink-secondary">
                    {c.performance.facts.periodA.startIso} –{" "}
                    {c.performance.facts.periodA.endIso} vs{" "}
                    {c.performance.facts.periodB.startIso} –{" "}
                    {c.performance.facts.periodB.endIso}
                  </p>
                )}
                {c.performance?.checkedAt && (
                  <p className="mt-1 text-xs text-dash-ink-secondary">
                    {c.performanceFresh ? "Checked" : "Prior snapshot"}:{" "}
                    {date(c.performance.checkedAt, c)}
                  </p>
                )}
                {c.performance?.error && (
                  <p className="mt-1 text-xs text-amber-400">
                    {c.performance.error}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className={button}
                aria-expanded={expanded === c.id}
                onClick={() => selectAccount(c.id)}
              >
                {expanded === c.id ? "Hide details" : "Performance & settings"}
              </button>
              <a className={button} href={`/clients/${c.id}`}>
                Manage client
              </a>
              {c.adsManagerUrl && (
                <a
                  className={button}
                  href={c.adsManagerUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ads Manager
                </a>
              )}
              {c.performanceEnabled && (
                <button
                  disabled={!!busy}
                  className={button}
                  onClick={() =>
                    void action(c.id, "performance-monitor", {
                      action: "check",
                    })
                  }
                >
                  {busy === c.id ? "Checking…" : "Check Meta"}
                </button>
              )}
              {c.budgetEnabled && (
                <button
                  disabled={!!busy}
                  className={button}
                  onClick={() =>
                    void action(c.id, "budget-monitor", { action: "check" })
                  }
                >
                  Check budget
                </button>
              )}
            </div>
            {expanded === c.id && (
              <div className="mt-5 border-t border-dash-border pt-4">
                <DecisionSettingsPanel
                  client={c}
                  busy={!!busy}
                  save={(body) => action(c.id, "performance-monitor", body)}
                />
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-3 text-sm">
                  <label className="flex gap-2">
                    <input
                      type="checkbox"
                      checked={c.performanceEnabled}
                      disabled={!!busy || !c.linked}
                      onChange={(e) =>
                        void action(c.id, "performance-monitor", {
                          action: "settings",
                          enabled: e.target.checked,
                          emailEnabled: c.emailEnabled,
                        })
                      }
                    />
                    Monitor Meta performance
                  </label>
                  <label className="flex gap-2">
                    <input
                      type="checkbox"
                      checked={c.emailEnabled}
                      disabled={!!busy || !c.performanceEnabled}
                      onChange={(e) =>
                        void action(c.id, "performance-monitor", {
                          action: "settings",
                          enabled: c.performanceEnabled,
                          emailEnabled: e.target.checked,
                        })
                      }
                    />
                    Email agency owner about warning signals
                  </label>
                </div>
                <p className="mt-2 text-xs text-dash-ink-secondary">
                  Daily background sweep for rolling periods plus Check Meta.
                  New issues only: at most one review and one critical email per
                  account/comparison/ending date. Continuing issues stay here.
                  Minimum delivery and result thresholds reduce small-sample
                  noise. Budget notifications are managed on the client page.
                </p>
                {!c.linked && (
                  <p className="mt-3 text-sm">
                    Link a Meta account in Client settings first. CSV reporting
                    remains available.
                  </p>
                )}
                {c.performance?.emailError && (
                  <p className="mt-3 text-xs text-amber-400">
                    {c.performance.emailError}
                  </p>
                )}
                {c.performance?.facts && (
                  <div className="mt-5">
                    <p className="mb-3 text-sm font-medium">
                      Current completed period
                      {!c.performanceFresh
                        ? " · Older snapshot, check Meta before acting"
                        : ""}
                    </p>
                    {c.performance.facts.valueWarning && (
                      <p className="mb-3 text-sm text-amber-400">
                        Purchase value lookup was incomplete. Available delivery
                        metrics remain visible; refresh before assessing ROAS.
                      </p>
                    )}
                    {c.performance.facts.empty ? (
                      <p className="text-sm">
                        Meta returned no delivery for either period.
                      </p>
                    ) : (
                      metrics(c.performance.facts.current, c)
                    )}
                    {[...c.performance.facts.campaigns]
                      .sort((a, b) => {
                        return campaignRank(a) - campaignRank(b);
                      })
                      .map((campaign) => (
                        <details
                          key={campaign.name}
                          className="mt-4 min-w-0 rounded-lg border border-dash-border p-3"
                        >
                          <summary className="cursor-pointer break-words text-sm font-medium">
                            {campaign.name}{" "}
                            <span className="text-xs text-dash-ink-secondary">
                              {" "}
                              · {campaign.objective} ·{" "}
                            </span>
                            <PortfolioBadge
                              state={
                                c.performanceFresh
                                  ? campaignBrief(campaign).state
                                  : "check"
                              }
                            />
                          </summary>
                          <p className="mt-2 text-xs text-dash-ink-secondary sm:hidden">
                            Swipe the table to compare both periods →
                          </p>
                          <div className="mt-3 max-w-full overflow-x-auto">
                            <table className="w-full min-w-[480px] text-left text-sm">
                              <thead>
                                <tr className="text-xs text-dash-ink-secondary">
                                  <th className="pb-2 font-medium">Metric</th>
                                  <th className="pb-2 font-medium">
                                    Current period
                                  </th>
                                  <th className="pb-2 font-medium">
                                    Previous period
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {[
                                  [
                                    "Ad spend",
                                    money(campaign.current.spend, c),
                                    money(campaign.previous.spend, c),
                                  ],
                                  [
                                    "Impressions",
                                    value(campaign.current.impressions),
                                    value(campaign.previous.impressions),
                                  ],
                                  [
                                    "CTR (all)",
                                    campaign.current.ctr === null
                                      ? "—"
                                      : `${value(campaign.current.ctr, 2)}%`,
                                    campaign.previous.ctr === null
                                      ? "—"
                                      : `${value(campaign.previous.ctr, 2)}%`,
                                  ],
                                  [
                                    "CPC (all)",
                                    money(campaign.current.cpc, c),
                                    money(campaign.previous.cpc, c),
                                  ],
                                  [
                                    campaign.objective,
                                    value(campaign.current.results, 2),
                                    value(campaign.previous.results, 2),
                                  ],
                                  [
                                    campaign.costLabel,
                                    money(campaign.current.cpr, c),
                                    money(campaign.previous.cpr, c),
                                  ],
                                  ...(/purchase/i.test(campaign.objective)
                                    ? [
                                        [
                                          "Purchase ROAS",
                                          campaign.current.roas == null
                                            ? "—"
                                            : `${value(campaign.current.roas, 2)}×`,
                                          campaign.previous.roas == null
                                            ? "—"
                                            : `${value(campaign.previous.roas, 2)}×`,
                                        ],
                                        [
                                          "Purchase value",
                                          money(
                                            campaign.current.purchaseValue,
                                            c,
                                          ),
                                          money(
                                            campaign.previous.purchaseValue,
                                            c,
                                          ),
                                        ],
                                        [
                                          "ROAS spend basis (campaign)",
                                          money(campaign.current.roasSpend, c),
                                          money(campaign.previous.roasSpend, c),
                                        ],
                                      ]
                                    : []),
                                ].map(([label, a, b]) => (
                                  <tr
                                    key={label}
                                    className="border-t border-dash-border"
                                  >
                                    <th className="py-2 pr-3 font-normal">
                                      {label}
                                    </th>
                                    <td className="py-2 pr-3">{a}</td>
                                    <td className="py-2">{b}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {!campaign.comparableResults && (
                            <p className="mt-2 text-xs text-dash-ink-secondary">
                              Result trends need comparable goals and reported
                              results in both periods.
                            </p>
                          )}
                          {campaign.signals.map((signal) => (
                            <p
                              key={signal.key}
                              className={`mt-3 text-sm ${!c.performanceFresh ? "text-dash-ink-secondary" : signal.tone === "critical" ? "text-red-400" : signal.tone === "warning" ? "text-amber-400" : "text-emerald-400"}`}
                            >
                              <strong>
                                {signal.metric}
                                {signal.change === null
                                  ? ""
                                  : `: ${signal.change > 0 ? "+" : ""}${Math.round(signal.change)}%`}
                                .{" "}
                                {signal.state === "continuing"
                                  ? "Continuing"
                                  : signal.state === "recovered"
                                    ? "Recovered"
                                    : "New"}
                                {signal.role === "supporting"
                                  ? " · Supporting metric"
                                  : ""}
                                .
                              </strong>{" "}
                              {signal.message}
                            </p>
                          ))}
                          {/purchase/i.test(campaign.objective) && (
                            <p className="mt-2 text-xs text-dash-ink-secondary">
                              ROAS uses matching purchase values and
                              campaign-level period spend. Other metrics use the
                              ad-set delivery source. Attribution can revise
                              recent results.
                            </p>
                          )}
                          <CampaignTargetForm
                            client={c}
                            campaign={campaign}
                            busy={!!busy}
                            save={(body) =>
                              action(c.id, "performance-monitor", body)
                            }
                          />
                          {!campaign.signals.length && (
                            <p className="mt-2 text-xs text-dash-ink-secondary">
                              {c.performanceFresh
                                ? campaignBrief(campaign).reason
                                : "Prior snapshot only. Refresh before assessing current performance."}
                            </p>
                          )}
                        </details>
                      ))}
                  </div>
                )}
              </div>
            )}
          </section>
        ))}
    </div>
  );
}
