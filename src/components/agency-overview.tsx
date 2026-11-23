"use client";
import Link from "next/link";
import { MetaPerformanceDashboard } from "./meta-performance-dashboard";
import { MetaMonitoringSetup } from "./meta-monitoring-setup";
import { OverviewNavigation } from "./overview-navigation";
import { useCallback, useEffect, useState } from "react";
import type { OverviewRow } from "@/lib/agency-overview";
import { DecisionSettingsPanel } from "./performance-decision-controls";
import {
  PortfolioBoard,
  PortfolioBadge,
  PORTFOLIO_FILTERS,
  matchesPortfolio,
} from "./portfolio-board";
import { PortfolioRefresh } from "./portfolio-refresh";
import { portfolioRank } from "@/lib/performance-monitor/portfolio";
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
    [activationBusy, setActivationBusy] = useState<string | null>(null),
    [bulkRunning, setBulkRunning] = useState(false),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [expanded, setExpanded] = useState(initialClientId);
  const busy = activationBusy ?? singleBusy ?? (bulkRunning ? "bulk" : null);
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
      if (!r.ok || result.snapshot?.error)
        throw Error(result.error ?? result.snapshot?.error ?? "Check failed.");
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
  async function enableAndLoad(client: OverviewRow, emailEnabled: boolean) {
    setActivationBusy(client.id);
    try {
      if (
        await action(client.id, "performance-monitor", {
          action: "settings",
          enabled: true,
          emailEnabled,
        })
      )
        await action(client.id, "performance-monitor", { action: "check" });
    } finally {
      setActivationBusy(null);
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
      Number(b.linked) - Number(a.linked) ||
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
  const date = (s: string, c: OverviewRow) =>
    new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: c.timezone,
    }).format(new Date(s));

  return (
    <div className="nre-meta-performance mx-auto w-full min-w-0 max-w-5xl text-dash-ink">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
        Meta Ads performance
      </h1>
      <p className="mt-2 text-sm text-dash-ink-secondary">
        Know what changed, what needs attention and where your ad budget is
        going.
      </p>
      <OverviewNavigation current="meta" />
      {clients?.length &&
      !expanded &&
      !clients.some((c) => c.performanceEnabled || c.budgetEnabled) ? (
        <section className="mt-5 rounded-2xl border border-dash-border bg-dash-card p-5">
          <h2 className="text-lg font-semibold">
            Load your client accounts to get started
          </h2>
          <p className="mt-2 text-sm text-dash-ink-secondary">
            {clients.filter((c) => c.linked).length} of {clients.length} clients
            have a linked Meta account. Choose a linked client below, then
            enable and load its performance.
          </p>
          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
            {[
              "1 · Link a Meta account",
              "2 · Enable & load performance",
              "3 · Review campaigns and budgets",
            ].map((step) => (
              <p
                key={step}
                className="rounded-xl border border-dash-border bg-dash-bg p-3"
              >
                {step}
              </p>
            ))}
          </div>
        </section>
      ) : null}
      {!expanded &&
        clients?.some((c) => c.performanceEnabled || c.budgetEnabled) && (
          <section
            className="mt-5 rounded-2xl border border-dash-border bg-dash-card p-5"
            aria-label="Agency priorities"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-dash-ink-secondary">
              Across your accounts
            </p>
            <h2 className="mt-2 text-xl font-semibold">
              {clients.filter((c) => matchesPortfolio(c, "critical")).length}{" "}
              critical ·{" "}
              {clients.filter((c) => matchesPortfolio(c, "review")).length} need
              review
            </h2>
            <p className="mt-2 text-sm text-dash-ink-secondary">
              Review priority accounts first. Each account uses its own
              comparison period and currency.
            </p>
            <nav
              aria-label="Account status"
              className="mt-4 flex flex-wrap gap-2"
            >
              {PORTFOLIO_FILTERS.map((f) => (
                <button
                  key={f.key}
                  aria-pressed={filter === f.key}
                  onClick={() => {
                    setFilter(f.key);
                    setExpanded("");
                  }}
                  className={`rounded-full border px-3 py-2 text-sm ${filter === f.key ? "border-dash-accent bg-dash-accent text-[#102033]" : "border-dash-border text-dash-ink-secondary"}`}
                >
                  {f.label}{" "}
                  <span className="ml-1 font-semibold">
                    {f.key === "all"
                      ? clients.length
                      : clients.filter((c) => matchesPortfolio(c, f.key))
                          .length}
                  </span>
                </button>
              ))}
            </nav>
          </section>
        )}
      {!expanded ? (
        <div className="mt-5 flex flex-wrap gap-3">
          <input
            aria-label="Search clients"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setExpanded("");
            }}
            placeholder="Find a client"
            className="w-full min-w-0 rounded-lg border border-dash-border bg-dash-bg px-3 py-2 sm:w-auto sm:flex-1"
          />
          <button
            disabled={!!busy}
            className={button}
            onClick={() => void load().catch((e) => setError(e.message))}
          >
            Reload overview
          </button>
        </div>
      ) : (
        <div className="mt-5">
          <label
            className="text-xs font-medium text-dash-ink-secondary"
            htmlFor="meta-client-switch"
          >
            Client account
          </label>
          <select
            id="meta-client-switch"
            value={expanded}
            className="mt-2 block w-full rounded-xl border border-dash-border bg-dash-card px-4 py-3 text-sm sm:max-w-md"
            onChange={(e) => {
              setFilter("all");
              setSearch("");
              setExpanded(e.target.value);
            }}
          >
            {clients?.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {!expanded &&
        clients?.some((c) => c.performanceEnabled || c.budgetEnabled) && (
          <PortfolioRefresh
            clients={clients}
            disabled={!!singleBusy || !!activationBusy}
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
            {(!c.linked || !c.performanceEnabled) && (
              <MetaMonitoringSetup
                key={c.id}
                client={c}
                busy={!!busy}
                onEnable={(emails) => void enableAndLoad(c, emails)}
              />
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className={button}
                aria-expanded={expanded === c.id}
                onClick={() => selectAccount(c.id)}
              >
                {expanded === c.id ? "← All accounts" : "View performance"}
              </button>
              <details className="relative">
                <summary className={`${button} cursor-pointer`}>
                  More options
                </summary>
                <div className="absolute left-0 z-20 mt-2 flex w-52 flex-col gap-1 rounded-xl border border-dash-border bg-dash-card p-2 shadow-xl">
                  <a
                    className="rounded-lg p-2 text-sm hover:bg-dash-bg"
                    href={`/clients/${c.id}`}
                  >
                    Client settings
                  </a>
                  <a
                    className="rounded-lg p-2 text-sm hover:bg-dash-bg"
                    href={`/clients/${c.id}#budget-monitor`}
                  >
                    Budget &amp; alerts
                  </a>
                  {c.adsManagerUrl && (
                    <a
                      className="rounded-lg p-2 text-sm hover:bg-dash-bg"
                      href={c.adsManagerUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open Ads Manager ↗
                    </a>
                  )}
                </div>
              </details>
              {c.performanceEnabled && (
                <button
                  disabled={!!busy}
                  className="rounded-xl bg-dash-accent px-4 py-2 text-sm font-semibold text-[#102033] disabled:opacity-50"
                  onClick={() =>
                    void action(c.id, "performance-monitor", {
                      action: "check",
                    })
                  }
                >
                  {busy === c.id ? "Refreshing…" : "Refresh performance"}
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
            {c.performance?.checkedAt && (
              <p className="mt-3 text-xs text-dash-ink-secondary">
                {c.performanceFresh ? "Last refreshed" : "Saved snapshot"}:{" "}
                {date(c.performance.checkedAt, c)}
              </p>
            )}
            {c.performance?.error && (
              <p role="alert" className="mt-3 text-sm text-amber-400">
                {c.performance.error}
              </p>
            )}
            {c.linked && (
              <div className="mt-4">
                <DecisionSettingsPanel
                  client={c}
                  busy={!!busy}
                  save={async (body) => {
                    setActivationBusy(c.id);
                    try {
                      const saved = await action(
                        c.id,
                        "performance-monitor",
                        body,
                      );
                      return saved && c.performanceEnabled
                        ? await action(c.id, "performance-monitor", {
                            action: "check",
                          })
                        : saved;
                    } finally {
                      setActivationBusy(null);
                    }
                  }}
                />
              </div>
            )}
            <MetaPerformanceDashboard client={c} />
            {c.budgetEnabled && (
              <div
                id={`meta-budget-${c.id}`}
                className="mt-4 grid scroll-mt-6 gap-4"
              >
                {c.budgetEnabled && (
                  <div className="rounded-xl border border-dash-border bg-dash-bg p-4">
                    <h3 className="text-lg font-semibold">
                      Monthly budget pacing
                    </h3>
                    <p className="mt-1 text-sm font-medium">{c.budgetLabel}</p>
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
                                {money(c.budget.facts.projectedShortfall, c)}
                                .{" "}
                              </>
                            ) : null}
                            Remaining daily allowance:{" "}
                            {money(c.dailyAllowance, c)} through month end,
                            including today. Planning guide; adjust budgets in
                            Ads Manager.
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
                )}
              </div>
            )}

            {expanded === c.id && c.linked && (
              <div className="mt-5 border-t border-dash-border pt-4">
                {c.performanceEnabled && (
                  <details className="mt-4 rounded-xl border border-dash-border p-4">
                    <summary className="cursor-pointer text-sm font-medium">
                      Monitoring &amp; email preferences
                    </summary>
                    <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
                      <label className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 accent-dash-accent"
                          checked={c.performanceEnabled}
                          disabled={!!busy}
                          onChange={(e) =>
                            void action(c.id, "performance-monitor", {
                              action: "settings",
                              enabled: e.target.checked,
                              emailEnabled: c.emailEnabled,
                            })
                          }
                        />
                        Keep performance updated
                      </label>
                      <label className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 accent-dash-accent"
                          checked={c.emailEnabled}
                          disabled={!!busy}
                          onChange={(e) =>
                            void action(c.id, "performance-monitor", {
                              action: "settings",
                              enabled: c.performanceEnabled,
                              emailEnabled: e.target.checked,
                            })
                          }
                        />
                        Email me about new issues
                      </label>
                    </div>
                    <p className="mt-3 text-xs text-dash-ink-secondary">
                      Rolling comparisons update daily. Custom dates refresh
                      manually. Budget alerts are managed in client settings.
                    </p>
                  </details>
                )}
                {c.performance?.emailError && (
                  <p className="mt-3 text-xs text-amber-400">
                    {c.performance.emailError}
                  </p>
                )}
              </div>
            )}
          </section>
        ))}
      {visible && !visible.some((c) => c.id === expanded) && (
        <PortfolioBoard
          rows={visible}
          selected={expanded}
          onOpen={selectAccount}
        />
      )}
    </div>
  );
}
