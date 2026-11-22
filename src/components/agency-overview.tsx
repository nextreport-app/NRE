"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { OverviewRow } from "@/lib/agency-overview";
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
    [busy, setBusy] = useState<string | null>(null),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [expanded, setExpanded] = useState(initialClientId);
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
    } catch (e) {
      await load().catch(() => {});
      setError(e instanceof Error ? e.message : "Check failed.");
    } finally {
      setBusy(null);
    }
  }
  const visible = clients?.filter(
    (c) =>
      (!search || c.name.toLowerCase().includes(search.toLowerCase())) &&
      (filter === "all" ||
        (filter === "attention" && c.needsAttention) ||
        (filter === "check" && c.unavailable)),
  );
  visible?.sort(
    (a, b) =>
      Number(b.id === initialClientId) - Number(a.id === initialClientId) ||
      Number(b.needsAttention) - Number(a.needsAttention) ||
      Number(b.unavailable) - Number(a.unavailable) ||
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
      <h1 className="text-2xl font-bold">Agency overview</h1>
      <p className="mt-2 text-sm text-dash-ink-secondary">
        Meta performance and approved budget pacing, across your clients.
      </p>
      <nav aria-label="Overview type" className="mt-4 flex flex-wrap gap-2"><span className={`${button} border-dash-accent text-dash-accent`} aria-current="page">Meta Ads</span><Link href="/websites" className={button}>Website traffic (GA4)</Link></nav>
      {clients && (
        <div className="mt-5 grid grid-cols-3 gap-3">
          {[
            ["Clients", clients.length],
            ["Need review", clients.filter((c) => c.needsAttention).length],
            ["Check needed", clients.filter((c) => c.unavailable).length],
          ].map(([label, count]) => (
            <div
              key={label}
              className="rounded-xl border border-dash-border bg-dash-card p-3"
            >
              <p className="text-xs text-dash-ink-secondary">{label}</p>
              <p className="mt-1 text-2xl font-semibold">{count}</p>
            </div>
          ))}
        </div>
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
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-lg border border-dash-border bg-dash-bg px-3 py-2"
        >
          <option value="all">All clients</option>
          <option value="attention">Need review</option>
          <option value="check">Check needed</option>
        </select>
        <button
          disabled={!!busy}
          className={button}
          onClick={() => void load().catch((e) => setError(e.message))}
        >
          Reload overview
        </button>
      </div>
      <p className="mt-2 text-xs text-dash-ink-secondary">
        Saved snapshots are shown without a live Meta request. Check Meta for
        fresh data. Budgets exclude tax. Each account uses its own currency and
        timezone; missing metrics appear as —.
      </p>
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
      {visible?.map((c) => (
        <section
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
            <span
              className={`rounded-full border px-2.5 py-1 text-xs ${c.needsAttention ? "border-amber-400 text-amber-400" : "border-dash-border text-dash-ink-secondary"}`}
            >
              {c.needsAttention
                ? "Review signals"
                : c.unavailable
                  ? "Check needed"
                  : !c.linked
                    ? "Meta account not linked"
                    : !c.performanceEnabled && !c.budgetEnabled
                      ? "Monitoring off"
                      : "No threshold signals"}
            </span>
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
                </p>
              )}
              {c.budget?.checkedAt && (
                <p className="mt-1 text-xs text-dash-ink-secondary">
                  {c.budgetFresh ? "Checked" : "Prior snapshot"}:{" "}
                  {date(c.budget.checkedAt, c)}
                </p>
              )}
              {c.budget?.error && (
                <p className="mt-1 text-xs text-amber-400">{c.budget.error}</p>
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
              onClick={() => setExpanded(expanded === c.id ? "" : c.id)}
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
                  void action(c.id, "performance-monitor", { action: "check" })
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
              <div className="flex flex-wrap gap-x-5 gap-y-3 text-sm">
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
                Daily background sweep plus Check Meta. At most one warning
                email per account/period ending date. Minimum delivery and
                result thresholds reduce small-sample noise. Budget
                notifications are managed on the client page.
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
                    Last 7 completed days
                    {!c.performanceFresh
                      ? " · Older snapshot, check Meta before acting"
                      : ""}
                  </p>
                  {c.performance.facts.empty ? (
                    <p className="text-sm">
                      Meta returned no delivery for either period.
                    </p>
                  ) : (
                    metrics(c.performance.facts.current, c)
                  )}
                  {c.performance.facts.campaigns.map((campaign) => (
                    <details
                      key={campaign.name}
                      className="mt-4 min-w-0 rounded-lg border border-dash-border p-3"
                    >
                      <summary className="cursor-pointer break-words text-sm font-medium">
                        {campaign.name}{" "}
                        <span className="text-xs text-dash-ink-secondary">
                          · {campaign.objective} ·{" "}
                          {
                            campaign.signals.filter((s) => s.tone === "warning")
                              .length
                          }{" "}
                          warning signals
                        </span>
                      </summary>
                      <p className="mt-2 text-xs text-dash-ink-secondary sm:hidden">
                        Swipe the table to compare both periods →
                      </p>
                      <div className="mt-3 max-w-full overflow-x-auto">
                        <table className="w-full min-w-[480px] text-left text-sm">
                          <thead>
                            <tr className="text-xs text-dash-ink-secondary">
                              <th className="pb-2 font-medium">Metric</th>
                              <th className="pb-2 font-medium">Last 7 days</th>
                              <th className="pb-2 font-medium">
                                Previous 7 days
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
                          className={`mt-3 text-sm ${signal.tone === "warning" ? "text-amber-400" : "text-dash-ink-secondary"}`}
                        >
                          <strong>
                            {signal.metric}: {signal.change > 0 ? "+" : ""}
                            {Math.round(signal.change)}%.
                          </strong>{" "}
                          {signal.message}
                        </p>
                      ))}
                      {!campaign.signals.length && (
                        <p className="mt-2 text-xs text-dash-ink-secondary">
                          No threshold signals. This is not a campaign health
                          guarantee; new or low-volume campaigns may need more
                          data.
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
