"use client";

import Link from "next/link";
import {
  loadMetaOverview,
  openMetaDashboard,
} from "@/lib/performance-monitor/dashboard-entry";
import { useRouter } from "next/navigation";
import { PerformanceBackLink } from "./performance-back-link";
import { MetaBudgetPanel } from "./meta-budget-panel";
import { MetaPerformanceDashboard } from "./meta-performance-dashboard";
import { MetaMonitoringSetup } from "./meta-monitoring-setup";
import { OverviewNavigation } from "./overview-navigation";
import { useCallback, useEffect, useRef, useState } from "react";
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
    [filter, setFilter] = useState("all");
  const expanded = initialClientId;
  const router = useRouter();
  const [budgetBusy, setBudgetBusy] = useState(false);
  const busy =
    activationBusy ??
    singleBusy ??
    (bulkRunning ? "bulk" : budgetBusy ? "budget" : null);
  const loaded = clients !== null;
  useEffect(() => {
    const panel =
      expanded && loaded
        ? document.getElementById(`account-${expanded}`)
        : null;
    if (
      panel &&
      window.location.hash ===
        `#${encodeURIComponent(`meta-budget-${expanded}`)}`
    ) {
      const budgetId = `meta-budget-${expanded}`;
      const target = document.getElementById(budgetId) ?? panel;
      target.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "start",
      });
      target.focus({ preventScroll: true });
    }
  }, [expanded, loaded]);
  function selectAccount(id: string) {
    router.push(`/performance/meta-ads?client=${encodeURIComponent(id)}`);
  }
  const opening = useRef<Promise<OverviewRow[]> | null>(null);
  const opened = useRef(false);
  const load = useCallback(async () => {
    let rows: OverviewRow[];
    if (!opened.current) {
      opening.current ??= openMetaDashboard(initialClientId);
      try {
        rows = await opening.current;
        opened.current = true;
      } catch (error) {
        opening.current = null;
        throw error;
      }
    } else {
      rows = await loadMetaOverview();
    }
    setClients(rows);
    setError("");
  }, [initialClientId]);
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
  const date = (s: string, c: OverviewRow) =>
    new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: c.timezone,
    }).format(new Date(s));

  return (
    <div className="nre-meta-performance mx-auto w-full min-w-0 max-w-5xl text-dash-ink">
      {expanded && <PerformanceBackLink view="meta" />}
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
        Meta Ads Performance Comparisons
      </h1>
      <p className="mt-2 text-sm text-dash-ink-secondary">
        See what’s improving, what’s declining, and what needs attention
        compared with the previous period.
      </p>
      <OverviewNavigation current="meta" clientId={expanded} />
      {clients?.length &&
      !expanded &&
      !clients.some((c) => c.performanceEnabled || c.budgetEnabled) ? (
        <section className="mt-5 rounded-2xl border border-dash-border bg-dash-card p-5">
          <h2 className="text-lg font-semibold">
            Load your client accounts to get started
          </h2>
          <p className="mt-2 text-sm text-dash-ink-secondary">
            {clients.filter((c) => c.linked).length} of {clients.length} clients
            have an ad account selected. Choose a client below, select its ad
            account if needed, then load performance.
          </p>
          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
            {[
              "1 · Choose the client’s ad account",
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
              Start with the accounts that need your attention.
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
      {!expanded && (
        <div className="mt-5 flex flex-wrap gap-3">
          <input
            aria-label="Search clients"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find a client"
            className="w-full min-w-0 rounded-lg border border-dash-border bg-dash-bg px-3 py-2 sm:w-auto sm:flex-1"
          />
        </div>
      )}
      {expanded && clients && !clients.some((c) => c.id === expanded) && (
        <p className="mt-5 text-sm text-dash-ink-secondary">
          This client is unavailable. Return to all Meta ad accounts to choose
          another.
        </p>
      )}
      {clients?.some((c) => c.performanceEnabled || c.budgetEnabled) && (
        <PortfolioRefresh
          clients={clients}
          scopeId={expanded}
          disabled={!!singleBusy || !!activationBusy || budgetBusy}
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
              </div>
              <PortfolioBadge state={c.portfolio.state} />
            </div>
            {(!c.linked || !c.performanceEnabled) && (
              <MetaMonitoringSetup
                key={c.id}
                client={c}
                busy={!!busy}
                onEnable={(emails) => void enableAndLoad(c, emails)}
                onLinked={load}
                onActivity={(value) => setActivationBusy(value ? c.id : null)}
              />
            )}
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
            <MetaBudgetPanel
              onActivity={setBudgetBusy}
              revision={`${c.budget?.checkedAt ?? ""}:${c.budget?.error ?? ""}`}
              key={c.id}
              clientId={c.id}
              disabled={!!busy}
              onUpdated={load}
            />

            {expanded === c.id && c.linked && (
              <div className="mt-5 border-t border-dash-border pt-4">
                {c.performanceEnabled && (
                  <section
                    aria-label="Performance alerts"
                    className="mt-4 rounded-xl border border-dash-border p-4"
                  >
                    <h3 className="text-sm font-medium">Performance alerts</h3>
                    <p className="mt-2 text-xs text-dash-ink-secondary">
                      Critical issues and early warnings from your campaign
                      comparisons.
                    </p>
                    <div className="mt-4 text-sm">
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
                        Email me about performance alerts
                      </label>
                    </div>
                  </section>
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
      {visible && !expanded && (
        <PortfolioBoard
          rows={visible}
          selected={expanded}
          onOpen={selectAccount}
        />
      )}
    </div>
  );
}
