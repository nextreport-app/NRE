"use client";

import { isWebsiteRangeFailure } from "@/lib/website-dashboard/refresh-messages";
import { OverviewNavigation } from "./overview-navigation";
import { WizardDatePicker } from "./report-upload-wizard/ui/wizard-date-picker";
import { reportCalendarYesterday } from "@/lib/nre/report-period-selection";
import { WebsiteMetricChange } from "./website-metric-change";
import { WebsiteDetailTable, formatWebsiteMetric } from "./website-detail-table";
import { customWebsiteRangeSchema } from "@/lib/website-dashboard/range";
import { WebsiteChannelComparison } from "./website-changes";
import { WebsiteSessionsTrend } from "./website-sessions-trend";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type WebsiteSnapshot,
  type WebsiteMetric,
} from "@/lib/website-dashboard/model";
interface Client {
  connected?: boolean;
  id: string;
  name: string;
  propertyId: string | null;
  propertyName: string | null;
}
interface View {
  clients: Client[];
  selectedClientId: string | null;
  connected: boolean;
  connectedEmail: string | null;
  snapshots: Array<{
    days: 0 | 7 | 30;
    data: WebsiteSnapshot | null;
    error: string | null;
    fresh: boolean;
    refreshing: boolean;
  }>;
}
const periodButton = "min-h-10 whitespace-nowrap rounded-lg px-2 py-2 text-xs font-medium sm:px-3 sm:text-sm transition-colors focus-visible:outline-2 focus-visible:outline-dash-accent disabled:opacity-50";
const labels: Record<WebsiteMetric, string> = {
  sessions: "Sessions",
  totalUsers: "Total users",
  newUsers: "New users",
  engagedSessions: "Engaged sessions",
  engagementRate: "Engagement rate",
  bounceRate: "Bounce rate",
  screenPageViews: "Page views",
  keyEvents: "Key events",
  sessionKeyEventRate: "Key event rate",
  averageSessionDuration: "Avg. session duration",
};
const primaryMetrics: WebsiteMetric[] = ["sessions", "totalUsers", "engagementRate", "bounceRate", "keyEvents", "sessionKeyEventRate"];
const rates = new Set(["engagementRate", "bounceRate", "sessionKeyEventRate"]);
export function WebsiteDashboard({
  initialClientId = "",
}: {
  initialClientId?: string;
}) {
  const router = useRouter();
  const clientId = initialClientId;
  const [view, setView] = useState<View | null>(null),
    [search, setSearch] = useState(""),
    [days, setDays] = useState<7 | 30 | "custom">(7),
    [customStart, setCustomStart] = useState(""),
    [customEnd, setCustomEnd] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const version = useRef(0);
  const invalidate = useCallback(() => {
    version.current++;
  }, []);
  const load = useCallback(async () => {
    const request = ++version.current;
    const response = await fetch(
      `/api/website-overview${clientId ? `?clientId=${encodeURIComponent(clientId)}` : ""}`,
      { cache: "no-store" },
    );
    const data = await response.json();
    if (!response.ok)
      throw Error(data.error ?? "Website dashboard could not load.");
    if (request === version.current) {
      setView(data);
      setError("");
    }
  }, [clientId]);
  useEffect(() => {
    let active = true;
    const refresh = () =>
      void load().catch((e) => {
        if (active) setError(e.message);
      });
    refresh();
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      invalidate();
      window.removeEventListener("focus", refresh);
    };
  }, [load, invalidate]);
  const selected = view?.clients.find(
      (c) => !!clientId && c.id === clientId,
    ),
    entry =
      view?.selectedClientId === (clientId || view?.selectedClientId)
        ? view?.snapshots.find((s) => days !== "custom" ? s.days === days : s.days === 0 && s.data?.currentPeriod.startIso === customStart && s.data?.currentPeriod.endIso === customEnd)
        : undefined,
    data = entry?.data;
  const rangeFailure = isWebsiteRangeFailure(error || entry?.error);
  const propertyTimezone = view?.snapshots.find(s => s.data?.property.propertyId === selected?.propertyId)?.data?.property.timezone;
  const latestCompletedDate = propertyTimezone ? reportCalendarYesterday(new Date(), propertyTimezone) : undefined;
  async function refresh() {
    if (!selected || busy) return;
    if (days === "custom" && !customWebsiteRangeSchema.safeParse({startIso:customStart,endIso:customEnd}).success) { setError("Choose a valid custom range of 1–90 completed days."); return; }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `/api/clients/${selected.id}/website-overview`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(days === "custom" ? { customRange: {startIso:customStart,endIso:customEnd} } : { days }),
        },
      );
      const result = await response.json();
      await load();
      if (!response.ok) throw Error(result.error ?? "GA4 refresh failed.");
      if (result.cached)
        setNotice("Using the snapshot refreshed within the last five minutes.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "GA4 refresh failed.");
    } finally {
      setBusy(false);
    }
  }
  const num = (n: number | null | undefined) =>
    n === null || n === undefined
      ? "—"
      : new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(n);
  const metric = (key: WebsiteMetric, value: number | null) =>
    value === null
      ? "—"
      : rates.has(key)
        ? `${num(value * 100)}%`
        : key === "averageSessionDuration"
          ? formatWebsiteMetric(key, value)
          : num(value);
  return (
    <div className="nre-website-performance mx-auto w-full min-w-0 max-w-5xl text-dash-ink">
      <h1 className="text-2xl font-bold">
        Website performance{" "}
        <span className="text-xs font-normal text-dash-ink-secondary">
          Beta
        </span>
      </h1>
      <p className="mt-2 text-sm text-dash-ink-secondary">
        All website traffic reported by GA4, separate from Meta ad delivery.
      </p>
      <OverviewNavigation current="website" clientId={clientId || undefined} />
      {view && !clientId && (
        <section aria-label="All website clients" className="mt-5">
          <div className="rounded-2xl border border-dash-border bg-dash-card p-5">
            <h2 className="text-lg font-semibold">Across your websites</h2>
            <p className="mt-2 text-sm text-dash-ink-secondary">{view.clients.length} clients · {view.clients.filter(c => c.propertyId).length} with a linked GA4 property</p>
            <p className="mt-2 text-sm text-dash-ink-secondary">Choose a client to compare website traffic and engagement.</p>
          </div>
          {!!view.clients.length && <label className="mt-5 block"><span className="sr-only">Find a website client</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Find a client" className="min-h-11 w-full rounded-xl border border-dash-border bg-dash-bg px-4 py-3 text-sm" /></label>}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {view.clients
              .filter(c => c.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
              .sort((a, b) => Number(!!b.propertyId) - Number(!!a.propertyId) || a.name.localeCompare(b.name))
              .map(c => {
              const connected = c.connected ?? view.connected;
              const linked = connected && !!c.propertyId;
              return (
                <article key={c.id} className={`rounded-2xl border bg-dash-card p-5 ${linked ? "nre-ga4-property-linked" : "border-dash-border"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="font-semibold">{c.name}</h3>
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs ${linked ? "nre-ga4-property-linked__badge" : "border-dash-border text-dash-ink-secondary"}`}>
                      {linked && <svg aria-hidden="true" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 8 3 3 7-7" /></svg>}
                      {!connected ? "Connect GA4" : linked ? "Property linked" : "Needs setup"}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-dash-ink-secondary">{c.propertyId ? (c.propertyName || `GA4 property ${c.propertyId}`) : "No GA4 property linked yet."}</p>
                  <Link href={linked ? `/performance/google-analytics?client=${encodeURIComponent(c.id)}` : `/clients/${c.id}#website-analytics`} className={`mt-4 inline-flex min-h-11 items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-dash-accent ${linked ? "nre-ga4-property-linked__action" : "border-dash-border bg-dash-bg hover:border-dash-accent"}`}>
                    {!connected ? "Connect GA4 →" : linked ? "View website performance →" : "Choose GA4 property →"}
                  </Link>
                </article>
              );
            })}
          </div>
          {!!view.clients.length && !view.clients.some(c => c.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())) && <p className="mt-4 text-sm text-dash-ink-secondary">No clients match your search.</p>}
        </section>
      )}
      {selected && <Link href="/performance/google-analytics" className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-dash-border px-4 py-2 text-sm font-medium hover:bg-dash-card">← All websites</Link>}
      {view && clientId && (
        <section aria-label="Website filters" className="mt-5 rounded-2xl border border-dash-border bg-dash-card p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-end gap-3">
          <label className="w-full text-xs font-medium text-dash-ink-secondary lg:w-auto lg:flex-1">
            Website / client
            <select
              aria-label="Website client"
              disabled={busy}
              className="mt-2 block min-h-11 w-full rounded-xl border border-dash-border bg-dash-bg px-4 py-2.5 text-sm text-dash-ink focus-visible:outline-2 focus-visible:outline-dash-accent"
              value={selected?.id ?? ""}
              onChange={(e) => {
                router.push(`/performance/google-analytics?client=${encodeURIComponent(e.target.value)}`);
              }}
            >
              <option value="" disabled>
                Select a client
              </option>
              {view.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex max-w-full gap-1 rounded-xl border border-dash-border bg-dash-bg p-1" role="group" aria-label="Website period">
            {([7, 30] as const).map((n) => (
              <button
                key={n}
                className={`${periodButton} ${days === n ? "bg-dash-card text-dash-ink ring-1 ring-inset ring-dash-ink-secondary" : "text-dash-ink-secondary hover:text-dash-ink"}`}
                aria-pressed={days === n}
                disabled={busy}
                onClick={() => {
                  setNotice("");
                  setError("");
                  setDays(n);
                }}
              >
                Last {n} days
              </button>
            ))}
            <button className={`${periodButton} ${days === "custom" ? "bg-dash-card text-dash-ink ring-1 ring-inset ring-dash-ink-secondary" : "text-dash-ink-secondary hover:text-dash-ink"}`} aria-pressed={days === "custom"} disabled={busy} onClick={() => {setDays("custom");setError("");setNotice("");if(!customStart) {setCustomStart(data?.currentPeriod.startIso ?? "");setCustomEnd(data?.currentPeriod.endIso ?? "");}}}>Custom dates</button>
          </div>
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-dash-border bg-dash-bg px-4 py-2.5 text-sm font-semibold text-dash-ink transition-colors hover:border-dash-accent disabled:opacity-50"
            disabled={busy || !view.connected || !selected?.propertyId}
            onClick={() => void refresh()}
          >
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={busy ? "animate-spin" : ""}><path d="M20 11a8 8 0 1 0-2 6M20 4v7h-7"/></svg>
            {busy ? "Refreshing GA4…" : "Refresh GA4"}
          </button>
          </div>
          {days === "custom" && <div role="group" aria-label="Custom website dates" className="mt-4 border-t border-dash-border pt-4">
            <div className="grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
              <WizardDatePicker showYear label="From" placeholder="Select start date" disabled={busy} value={customStart} maxIso={latestCompletedDate} onChange={value=>{setCustomStart(value);setError("");}} />
              <WizardDatePicker showYear label="To" placeholder="Select end date" disabled={busy} value={customEnd} maxIso={latestCompletedDate} onChange={value=>{setCustomEnd(value);setError("");}} />
            </div>
            <p className="mt-3 text-xs text-dash-ink-secondary">Up to 90 completed days · compared with the preceding equal-length period.</p>
          </div>}
          {selected?.propertyId && view.connected && <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-dash-border pt-3 text-xs text-dash-ink-secondary">
            <span>{data?.property.displayName ?? selected.propertyName ?? "GA4 property"} · {selected.propertyId}</span>
            <Link className="font-medium text-dash-accent hover:underline" href={`/clients/${selected.id}#website-analytics`}>Change property</Link>
          </div>}
        </section>
      )}
      {!view && !error && (
        <p className="mt-5 text-sm">Loading website dashboard…</p>
      )}
      {notice && (
        <p role="status" className="mt-3 text-sm text-dash-ink-secondary">
          {notice}
        </p>
      )}
      {(error || entry?.error) && (
        <section role="alert" className="mt-4 rounded-xl border border-amber-500/30 bg-dash-card p-4 text-sm">
          <p className="font-semibold text-dash-ink">{rangeFailure ? "Couldn’t load website data for these dates" : error ? "Website data could not be refreshed" : "Last GA4 refresh failed"}</p>
          {rangeFailure ? <>
            <p className="mt-2 text-dash-ink-secondary">Try {days === 30 ? "Custom dates" : "Last 30 days or Custom dates"} to check a different period, then click Refresh GA4. Your property link is saved.</p>
            {data && <p className="mt-2 text-dash-ink-secondary">Prior figures are not a fresh check.</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {days !== 30 && <button type="button" disabled={busy} onClick={() => {setDays(30);setError("");setNotice("");}} className="min-h-11 rounded-lg border border-dash-border px-3 font-medium hover:border-dash-accent disabled:opacity-50">Try last 30 days</button>}
              <button type="button" disabled={busy} onClick={() => {setDays("custom");setError("");setNotice("");}} className="min-h-11 rounded-lg border border-dash-border px-3 font-medium hover:border-dash-accent disabled:opacity-50">Choose custom dates</button>
            </div>
          </> : <>
            {selected?.propertyId && <p className="mt-2 text-dash-ink-secondary">Your property link is saved. You do not need to save the property again.</p>}
            <p className="mt-2 text-dash-ink-secondary">{error || entry?.error}</p>
            {selected && <Link href={`/clients/${selected.id}#website-analytics`} className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-dash-border px-3 font-medium hover:border-dash-accent">Review GA4 connection &amp; property →</Link>}
          </>}
        </section>
      )}
      {view && !view.connected && (
        <section className="mt-5 rounded-xl border border-dash-border bg-dash-card p-5">
          <p className="text-sm">
            Connect Google Analytics, then link the website property to the
            right client.
          </p>
          <Link
            className="mt-3 inline-block text-sm text-dash-accent"
            href={selected ? `/clients/${selected.id}#website-analytics` : "/account#ga4"}
          >
            Connect GA4 →
          </Link>
        </section>
      )}
      {view && !view.clients.length && (
        <p className="mt-5 text-sm">
          Add a client for your website first.{" "}
          <Link href="/clients/new" className="text-dash-accent">
            Add client →
          </Link>
        </p>
      )}
      {selected && view?.connected && !selected.propertyId && (
        <section className="mt-5 rounded-xl border border-dash-border p-5">
          <p className="text-sm">
            Link the GA4 property that belongs to {selected.name}.
          </p>
          <Link
            href={`/clients/${selected.id}#website-analytics`}
            className="mt-3 inline-block text-sm text-dash-accent"
          >
            Choose website property →
          </Link>
        </section>
      )}
      {selected?.propertyId && view?.connected && (
        <>
          {!data && !error && !entry?.error && (
            <p className="mt-5 text-sm">
              Click Refresh GA4 to load {days === "custom" ? "your selected dates" : `the last ${days} completed days`} and compare with the previous equal-length period.
            </p>
          )}
          {entry?.refreshing && !busy && (
            <p className="mt-3 text-sm">
              A refresh is in progress. Reload this page shortly to see the
              result.
            </p>
          )}
          {data && (
            <>
              <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <p>{new Date(data.currentPeriod.startIso + "T12:00:00Z").toLocaleDateString("en", {month:"short", day:"numeric", timeZone:"UTC"})} – {new Date(data.currentPeriod.endIso + "T12:00:00Z").toLocaleDateString("en", {month:"short", day:"numeric", year:"numeric", timeZone:"UTC"})} <span className="text-dash-ink-secondary">· compared with previous {data.days} days</span></p>
                <details className="text-xs text-dash-ink-secondary">
                  <summary className="cursor-pointer">Dates &amp; data details</summary>
                  <p className="mt-2">Current: {data.currentPeriod.startIso} – {data.currentPeriod.endIso}</p>
                  <p>Previous: {data.previousPeriod.startIso} – {data.previousPeriod.endIso}</p>
                  <p>Timezone: {data.property.timezone}</p>
                  <p>Updated: {new Intl.DateTimeFormat("en", {dateStyle:"medium", timeStyle:"short",timeZone:data.property.timezone}).format(new Date(data.checkedAt))}</p>
                  <p className="mt-2">GA4 can take 24–48 hours to settle. Website attribution differs from Meta ad results.</p>
                </details>
              </div>
              {!entry?.fresh && <p className="mt-2 text-xs text-amber-400">Saved data is older or the last refresh failed. Refresh before acting.</p>}
              {data.warnings.map((w) => (
                <p key={w} className="mt-2 text-sm text-amber-400">
                  {w}
                </p>
              ))}
              {data.empty ? (
                <section className="mt-5 rounded-xl border border-dash-border bg-dash-card p-5">
                  <h2 className="font-semibold">No website data reported for these dates</h2>
                  <p className="mt-2 text-sm text-dash-ink-secondary">Your property is linked, but GA4 reported no website activity for these {data.days} completed days. Try {days === 30 ? "Custom dates" : "Last 30 days or Custom dates"} to check a different period.</p>
                  <div className="mt-4 flex flex-wrap gap-3 text-sm text-dash-accent">
                    {days === 7 && <button type="button" className="min-h-11 rounded-lg border border-dash-border px-3" onClick={() => { setDays(30); setError(""); setNotice(""); }}>View last 30 days</button>}
                    <button type="button" className="min-h-11 rounded-lg border border-dash-border px-3" onClick={() => {setDays("custom");setError("");setNotice("");}}>Choose custom dates</button>
                    <a href={`https://analytics.google.com/analytics/web/#/p${data.property.propertyId}/reports/intelligenthome`} target="_blank" rel="noreferrer">Open GA4</a>
                  </div>
                </section>
              ) : <>
              <section aria-label="Website summary" className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
                {primaryMetrics.map((key) => (
                  <div
                    key={key}
                    className="rounded-2xl border border-dash-border bg-dash-card p-4 shadow-sm"
                  >
                    <p className="text-xs text-dash-ink-secondary">
                      {labels[key]}
                    </p>
                    <p className="mt-3 text-3xl font-semibold tracking-tight">
                      {metric(key, data.current[key])}
                    </p>
                    <p className="mt-1 text-xs text-dash-ink-secondary">
                      Previous: {metric(key, data.previous[key])}
                    </p>
                    <div className="mt-3"><WebsiteMetricChange metric={key} current={data.current[key]} previous={data.previous[key]} comparable={!!entry?.fresh && !data.warnings.length} /></div>
                  </div>
                ))}
              </section>
              <WebsiteSessionsTrend data={data} />
              <details className="mt-5 rounded-xl border border-dash-border bg-dash-card p-4">
                <summary className="cursor-pointer font-semibold">More metrics</summary>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {(Object.keys(labels) as WebsiteMetric[]).filter(key => !primaryMetrics.includes(key)).map(key => <div key={key} className="rounded-lg border border-dash-border p-3">
                    <p className="text-xs text-dash-ink-secondary">{labels[key]}</p>
                    <p className="mt-2 text-lg font-semibold">{metric(key, data.current[key])}</p>
                    <p className="mt-1 text-xs text-dash-ink-secondary">Previous: {metric(key, data.previous[key])}</p><div className="mt-2"><WebsiteMetricChange metric={key} current={data.current[key]} previous={data.previous[key]} comparable={!!entry?.fresh && !data.warnings.length} /></div>
                  </div>)}
                </div>
                <p className="mt-3 text-xs text-dash-ink-secondary">Key events are actions marked as important in GA4. They are not automatically leads or purchases. Key event rate is the percentage of sessions with a key event.</p>
              </details>
              <WebsiteChannelComparison
                key={`${selected.id}:${days}:${data.property.propertyId}`}
                data={data}
                fresh={!!entry?.fresh}
              />

              <details className="mt-5 min-w-0 rounded-xl border border-dash-border bg-dash-card p-4">
                <summary className="cursor-pointer font-semibold">
                  Daily data
                </summary>
                <p className="mt-2 text-xs text-dash-ink-secondary">
                  Daily users are unique per day; adding them does not give unique period users.
                </p>
                {data.trend.some(row => row.bounceRate === undefined) && <p className="mt-2 text-xs text-dash-ink-secondary">Refresh GA4 to load the additional daily metrics.</p>}
                <WebsiteDetailTable rows={data.trend} kind="date" />
              </details>
              <details className="mt-5 min-w-0 rounded-xl border border-dash-border bg-dash-card p-4">
                <summary className="cursor-pointer font-semibold">
                  Top 10 landing pages
                </summary>
                {data.pages.some(row => row.bounceRate === undefined) && <p className="mt-2 text-xs text-dash-ink-secondary">Refresh GA4 to load the additional page metrics.</p>}
                <WebsiteDetailTable rows={data.pages} kind="page" />
              </details>
              </>}
            </>
          )}
        </>
      )}
    </div>
  );
}
