"use client";

import { isWebsiteRangeFailure } from "@/lib/website-dashboard/refresh-messages";
import { performancePortfolioCard, performancePortfolioAction } from "./performance-portfolio-styles";
import { ComparisonPeriod, BreakdownTotals, CountryLabel, DeviceLabel, ExternalDashboardLink, sumReported } from "./performance-presentation";
import { PerformanceBackLink } from "./performance-back-link";
import { OverviewNavigation } from "./overview-navigation";
import { WizardDatePicker } from "./report-upload-wizard/ui/wizard-date-picker";
import { reportCalendarYesterday } from "@/lib/nre/report-period-selection";
import { WebsiteMetricChange } from "./website-metric-change";
import { WebsiteDetailTable, formatWebsiteMetric } from "./website-detail-table";
import { customWebsiteRangeSchema } from "@/lib/website-dashboard/range";
import { WebsiteChannelComparison } from "./website-changes";
import { WebsiteSessionsTrend } from "./website-sessions-trend";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type WebsiteSnapshot,
  type WebsiteMetric,
} from "@/lib/website-dashboard/model";
const deviceColumns: Array<[WebsiteMetric, string]> = [
  ["sessions", "Sessions"], ["activeUsers", "Active users"], ["totalUsers", "Users"], ["newUsers", "New users"],
  ["screenPageViews", "Page views"], ["engagedSessions", "Engaged sessions"], ["engagementRate", "Engagement rate"],
  ["bounceRate", "Bounce rate"], ["eventCount", "Event count"], ["keyEvents", "Key events"],
  ["sessionKeyEventRate", "Key event rate"], ["averageSessionDuration", "Avg. session"],
];
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
  activeUsers: "Active users",
  eventCount: "Event count",
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
const primaryMetrics: WebsiteMetric[] = ["newUsers", "activeUsers", "eventCount", "keyEvents", "sessions", "averageSessionDuration", "screenPageViews", "bounceRate", "totalUsers", "engagementRate"];
const rates = new Set(["engagementRate", "bounceRate", "sessionKeyEventRate"]);
export function WebsiteDashboard({
  initialClientId = "",
}: {
  initialClientId?: string;
}) {
  const clientId = initialClientId;
  const [view, setView] = useState<View | null>(null),
    [search, setSearch] = useState(""),
    [days, setDays] = useState<7 | 30 | "custom">(30),
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
  const timeframeLabel = data ? `${data.rangeMode === "custom" ? "Custom period · " : "Last "}${data.days} ${data.days === 1 ? "day" : "days"}` : "";
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
  const metric = (key: WebsiteMetric, value: number | null | undefined) =>
    value == null
      ? "—"
      : rates.has(key)
        ? `${num(value * 100)}%`
        : key === "averageSessionDuration"
          ? formatWebsiteMetric(key, value)
          : num(value);
  return (
    <div className="nre-website-performance mx-auto w-full min-w-0 max-w-5xl text-dash-ink">
      {clientId && <PerformanceBackLink view="website" />}
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
                <article key={c.id} className={`${performancePortfolioCard} ${linked ? "nre-performance-card-ready" : "border-dash-border"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="font-semibold">{c.name}</h3>
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs ${linked ? "nre-performance-linked-badge" : "border-dash-border text-dash-ink-secondary"}`}>
                      {linked && <svg aria-hidden="true" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 8 3 3 7-7" /></svg>}
                      {!connected ? "Connect GA4" : linked ? "Property linked" : "Needs setup"}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-dash-ink-secondary">{c.propertyId ? (c.propertyName || `GA4 property ${c.propertyId}`) : "No GA4 property linked yet."}</p>
                  <Link href={linked ? `/performance/google-analytics?client=${encodeURIComponent(c.id)}` : `/clients/${c.id}#website-analytics`} className={`${performancePortfolioAction} ${linked ? "nre-performance-action-ready" : ""}`}>
                    {!connected ? "Connect GA4 →" : linked ? "View website performance →" : "Choose GA4 property →"}
                  </Link>
                </article>
              );
            })}
          </div>
          {!!view.clients.length && !view.clients.some(c => c.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())) && <p className="mt-4 text-sm text-dash-ink-secondary">No clients match your search.</p>}
        </section>
      )}
      {view && clientId && (
        <section aria-label="Website filters" className="mt-5 rounded-2xl border border-dash-border bg-dash-card p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-end gap-3">
          <div className="w-full min-w-0 lg:w-auto lg:flex-1">
            <p className="text-xs font-medium text-dash-ink-secondary">Website / client</p>
            <h2 className="mt-2 break-words text-lg font-semibold text-dash-ink">{selected?.name ?? "Loading client…"}</h2>
          </div>
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
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-dash-accent px-5 py-3 text-sm font-semibold text-[#102033] shadow-sm transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dash-accent disabled:opacity-50"
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
              <ComparisonPeriod
                current={data.currentPeriod}
                previous={data.previousPeriod}
                custom={data.rangeMode === "custom"}
              />
              <p className="mt-2 text-xs text-dash-ink-secondary">
                GA4 can take 24–48 hours to settle.
              </p>
              {!entry?.fresh && !error && !entry?.error && <p className="mt-2 text-xs text-amber-400">Saved data is older, refresh once before analyzing.</p>}
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
              <div className="mt-6 flex flex-wrap items-center justify-between gap-2"><div><p className="nre-ga4-eyebrow text-xs font-medium uppercase tracking-wider text-dash-accent">Website overview</p><h2 className="mt-1 text-xl font-semibold">Audience &amp; engagement</h2></div></div>
              <section aria-label="Website summary" className="nre-ga4-summary mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
                {primaryMetrics.map((key) => (
                  <div
                    key={key}
                    className="nre-ga4-summary-card nre-ga4-metric-card relative min-w-0 overflow-hidden rounded-2xl border border-dash-border bg-dash-card p-4 shadow-sm"
                  >
                    <p className="text-xs font-medium text-dash-ink-secondary">{labels[key]}</p>
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
              {(data.current.activeUsers === undefined || data.current.eventCount === undefined) && <p className="mt-3 text-xs text-dash-ink-secondary">Refresh GA4 to add active users and event count to this saved report.</p>}
              <p className="mt-3 text-xs text-dash-ink-secondary">Key events are actions marked as important in GA4. Event count includes all recorded events.</p>
              <WebsiteSessionsTrend data={data} />
              <WebsiteChannelComparison
                key={`${selected.id}:${days}:${data.property.propertyId}`}
                data={data}
                fresh={!!entry?.fresh}
              />

              <div className="mt-5 grid min-w-0 gap-4 lg:grid-cols-2">
                <section
                      aria-label="Top countries"
                      className="min-w-0 rounded-2xl border border-dash-border bg-dash-card p-5"
                    >
                      <h2 className="text-lg font-semibold">
                        Where your visitors are
                      </h2>
                      <p className="mt-1 text-xs text-dash-ink-secondary">
                        Top 10 countries by active users · {timeframeLabel}
                      </p>
                      {data.countries?.length ? (
                        <>
                          <BreakdownTotals
                            items={[
                              <>
                                <strong>{data.countries.length}</strong>{" "}
                                countries shown
                              </>,
                              <>
                                <strong>{num(data.current.activeUsers)}</strong>{" "}
                                active users across site
                              </>,
                            ]}
                          />
                          <ol className="mt-4 space-y-3">
                            {data.countries.map((row) => (
                              <li key={row.name}>
                                <div className="flex justify-between gap-3 text-sm">
                                  <span className="break-words">
                                    <CountryLabel country={row.name} />
                                  </span>
                                  <strong>{num(row.activeUsers)}</strong>
                                </div>
                                <div className="mt-2 h-1.5 rounded-full bg-dash-bg">
                                  <div
                                    className="h-full rounded-full bg-dash-accent"
                                    style={{
                                      width: `${row.activeUsers == null ? 0 : (row.activeUsers / Math.max(1, ...data.countries!.map((r) => r.activeUsers ?? 0))) * 100}%`,
                                    }}
                                  />
                                </div>
                              </li>
                            ))}
                          </ol>
                        </>
                      ) : (
                        <p className="mt-4 text-sm text-dash-ink-secondary">
                          {data.countries
                            ? "No country rows reported for these dates."
                            : "Refresh GA4 to load countries for this saved report."}
                        </p>
                      )}
                    </section>
                <section
                      aria-label="Top page titles"
                      className="min-w-0 rounded-2xl border border-dash-border bg-dash-card p-5"
                    >
                      <h2 className="text-lg font-semibold">
                        Most viewed pages
                      </h2>
                      <p className="mt-1 text-xs text-dash-ink-secondary">
                        Top 10 page titles by views · includes repeat views ·{" "}
                        {timeframeLabel}
                      </p>
                      {data.pageTitles?.length ? (
                        <>
                          <BreakdownTotals
                            items={[
                              <>
                                <strong>{data.pageTitles.length}</strong> pages
                                shown
                              </>,
                              <>
                                <strong>
                                  {num(
                                    sumReported(
                                      data.pageTitles.map(
                                        (row) => row.screenPageViews,
                                      ),
                                    ),
                                  )}
                                </strong>{" "}
                                views in listed pages
                              </>,
                            ]}
                          />
                          <ol className="mt-4 divide-y divide-dash-border">
                            {data.pageTitles.map((row) => (
                              <li
                                key={row.name}
                                className="flex items-start justify-between gap-3 py-3 text-sm"
                              >
                                <span className="min-w-0 break-words">
                                  {row.name || "(not set)"}
                                </span>
                                <strong className="shrink-0">
                                  {num(row.screenPageViews)}
                                </strong>
                              </li>
                            ))}
                          </ol>
                        </>
                      ) : (
                        <p className="mt-4 text-sm text-dash-ink-secondary">
                          {data.pageTitles
                            ? "No page views reported for these dates."
                            : "Refresh GA4 to load page titles for this saved report."}
                        </p>
                      )}
                    </section>
              </div>

<section
                    aria-label="Devices"
                    className="mt-5 min-w-0 rounded-2xl border border-dash-border bg-dash-card p-5"
                  >
                    <h2 className="text-lg font-semibold">Devices</h2>
                    <p className="mt-1 text-xs text-dash-ink-secondary">
                      Website activity by device · {timeframeLabel}
                    </p>
                    {data.devices?.some(row=>row.eventCount === undefined) && <p className="mt-3 text-xs text-dash-ink-secondary">Refresh GA4 to load the additional device metrics. Missing values appear as —.</p>}
                    {data.devices?.length ? (
                      <>
                        <BreakdownTotals
                          items={[
                            <>
                              <strong>{data.devices.length}</strong> device
                              types shown
                            </>,
                            <>
                              <strong>
                                {num(
                                  sumReported(
                                    data.devices.map((row) => row.sessions),
                                  ),
                                )}
                              </strong>{" "}
                              sessions in listed devices
                            </>,
                          ]}
                        />
                        <div className="mt-4 max-w-full overflow-x-auto">
                          <table
                            className="w-full text-left text-sm"
                            style={{ minWidth: 1400 }}
                          >
                            <thead>
                              <tr>
                                {["Device", ...deviceColumns.map(([,label])=>label)].map(label => <th key={label} className="whitespace-nowrap pb-3 pr-4 text-xs text-dash-ink-secondary">{label}</th>)}
                              </tr>
                            </thead>
                            <tbody>
                              {data.devices.map((row) => (
                                <tr
                                  key={row.name}
                                  className="border-t border-dash-border"
                                >
                                  <th className="py-3 pr-4 font-normal">
                                    <DeviceLabel device={row.name} />
                                  </th>
                                  {deviceColumns.map(([key])=><td key={key} className="whitespace-nowrap py-3 pr-4">{formatWebsiteMetric(key, row[key])}</td>)}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    ) : (
                      <p className="mt-4 text-sm text-dash-ink-secondary">
                        {data.devices
                          ? "No device rows reported for these dates."
                          : "Refresh GA4 to load devices for this saved report."}
                      </p>
                    )}
                  </section>

              <section className="mt-5 min-w-0 rounded-xl border border-dash-border bg-dash-card p-4">
                <h2 className="font-semibold">
                  Daily data
                </h2>
                <p className="mt-2 text-xs text-dash-ink-secondary">
                  Daily users are unique per day; adding them does not give unique period users.
                </p>
                {data.trend.some(row => row.bounceRate === undefined) && <p className="mt-2 text-xs text-dash-ink-secondary">Refresh GA4 to load the additional daily metrics.</p>}
                <BreakdownTotals
                      items={[
                        <>
                          <strong>{data.trend.length}</strong> daily rows shown
                        </>,
                        <>
                          <strong>
                            {num(
                              sumReported(
                                data.trend.map((row) => row.sessions),
                              ),
                            )}
                          </strong>{" "}
                          sessions in listed days
                        </>,
                        <>
                          <strong>
                            {num(
                              sumReported(
                                data.trend.map((row) => row.keyEvents),
                              ),
                            )}
                          </strong>{" "}
                          key events in listed days
                        </>,
                      ]}
                    />
                    <WebsiteDetailTable rows={data.trend} kind="date" />
              </section>
              </>}
              <ExternalDashboardLink href={`https://analytics.google.com/analytics/web/#/p${data.property.propertyId}/reports/intelligenthome`}>Open this property in Google Analytics</ExternalDashboardLink>
            </>
          )}
        </>
      )}
    </div>
  );
}
