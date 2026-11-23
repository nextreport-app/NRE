"use client";
import { WebsiteChanges, WebsiteChannelComparison } from "./website-changes";
import { WebsiteSessionsTrend } from "./website-sessions-trend";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type WebsiteSnapshot,
  type WebsiteMetric,
} from "@/lib/website-dashboard/model";
interface Client {
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
    days: 7 | 30;
    data: WebsiteSnapshot | null;
    error: string | null;
    fresh: boolean;
    refreshing: boolean;
  }>;
}
const button =
  "rounded-lg border border-dash-border px-3 py-2 text-sm disabled:opacity-50";
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
const primaryMetrics: WebsiteMetric[] = ["sessions", "totalUsers", "engagementRate", "keyEvents", "sessionKeyEventRate"];
const rates = new Set(["engagementRate", "bounceRate", "sessionKeyEventRate"]);
export function WebsiteDashboard({
  initialClientId = "",
}: {
  initialClientId?: string;
}) {
  const [view, setView] = useState<View | null>(null),
    [clientId, setClientId] = useState(initialClientId),
    [days, setDays] = useState<7 | 30>(7),
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
      (c) => c.id === (clientId || view.selectedClientId),
    ),
    entry =
      view?.selectedClientId === (clientId || view?.selectedClientId)
        ? view?.snapshots.find((s) => s.days === days)
        : undefined,
    data = entry?.data;
  async function refresh() {
    if (!selected || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `/api/clients/${selected.id}/website-overview`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ days }),
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
          ? `${num(value)} sec`
          : num(value);
  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl text-dash-ink">
      <h1 className="text-2xl font-bold">
        Website performance{" "}
        <span className="text-xs font-normal text-dash-ink-secondary">
          Beta
        </span>
      </h1>
      <p className="mt-2 text-sm text-dash-ink-secondary">
        All website traffic reported by GA4, separate from Meta ad delivery.
      </p>
      <nav aria-label="Overview type" className="mt-4 flex flex-wrap gap-2">
        <Link href="/overview" className={button}>
          Meta Ads
        </Link>
        <span
          className={`${button} border-dash-accent text-dash-accent`}
          aria-current="page"
        >
          Website traffic (GA4)
        </span>
      </nav>
      {view && (
        <div className="mt-5 flex flex-wrap items-end gap-3">
          <label className="w-full text-sm sm:w-auto sm:flex-1">
            Client
            <select
              aria-label="Website client"
              disabled={busy}
              className="mt-1 block w-full rounded-lg border border-dash-border bg-dash-bg px-3 py-2"
              value={selected?.id ?? ""}
              onChange={(e) => {
                setView(null);
                setError("");
                setNotice("");
                setClientId(e.target.value);
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
          <div className="flex gap-2" role="group" aria-label="Website period">
            {([7, 30] as const).map((n) => (
              <button
                key={n}
                className={`${button} ${days === n ? "border-dash-accent bg-dash-accent text-black" : ""}`}
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
          </div>
          <button
            className={button}
            disabled={busy || !view.connected || !selected?.propertyId}
            onClick={() => void refresh()}
          >
            {busy ? "Refreshing GA4…" : "Refresh GA4"}
          </button>
        </div>
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
        <p role="alert" className="mt-4 text-sm text-amber-400">
          {error || entry?.error}
        </p>
      )}
      {view && !view.connected && (
        <section className="mt-5 rounded-xl border border-dash-border bg-dash-card p-5">
          <p className="text-sm">
            Connect Google Analytics, then link the website property to the
            right client.
          </p>
          <Link
            className="mt-3 inline-block text-sm text-dash-accent"
            href="/account#ga4"
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
          <p className="mt-3 text-xs text-dash-ink-secondary">
            {data?.property.displayName ??
              selected.propertyName ??
              "GA4 property"}{" "}
            · Property {selected.propertyId} ·{" "}
            <Link
              className="underline"
              href={`/clients/${selected.id}#website-analytics`}
            >
              Change property
            </Link>
          </p>
          {!data && (
            <p className="mt-5 text-sm">
              Click Refresh GA4 to load the last {days} completed days and
              compare with the previous {days} days.
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
                <p>{new Date(data.currentPeriod.startIso + "T12:00:00Z").toLocaleDateString("en", {month:"short", day:"numeric", timeZone:"UTC"})} – {new Date(data.currentPeriod.endIso + "T12:00:00Z").toLocaleDateString("en", {month:"short", day:"numeric", year:"numeric", timeZone:"UTC"})} <span className="text-dash-ink-secondary">· compared with previous {days} days</span></p>
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
                  <p className="mt-2 text-sm text-dash-ink-secondary">GA4 returned no rows for the last {days} completed days. Check the selected property and its collection setup in Analytics. This does not confirm whether the tag is working.</p>
                  <div className="mt-4 flex flex-wrap gap-3 text-sm text-dash-accent">
                    {days === 7 && <button onClick={() => { setDays(30); setError(""); }}>View last 30 days</button>}
                    <a href={`https://analytics.google.com/analytics/web/#/p${data.property.propertyId}/reports/intelligenthome`} target="_blank" rel="noreferrer">Open GA4</a>
                  </div>
                </section>
              ) : <>
              <WebsiteChanges data={data} fresh={!!entry?.fresh} />
              <section aria-label="Website summary" className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
                {primaryMetrics.map((key) => (
                  <div
                    key={key}
                    className="rounded-xl border border-dash-border bg-dash-card p-3"
                  >
                    <p className="text-xs text-dash-ink-secondary">
                      {labels[key]}
                    </p>
                    <p className="mt-2 text-xl font-semibold">
                      {metric(key, data.current[key])}
                    </p>
                    <p className="mt-1 text-xs text-dash-ink-secondary">
                      Previous: {metric(key, data.previous[key])}
                    </p>
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
                    <p className="mt-1 text-xs text-dash-ink-secondary">Previous: {metric(key, data.previous[key])}</p>
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
                  Dates without a GA4 row are omitted. Users are counted uniquely across the whole period.
                </p>
                <div className="mt-3 max-w-full overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr>
                        <th className="pb-2">Date</th>
                        <th className="pb-2">Sessions</th>
                        <th className="pb-2">Key events</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.trend.map((d) => (
                        <tr
                          key={d.date}
                          className="border-t border-dash-border"
                        >
                          <td className="py-2">
                            {d.date.replace(
                              /^(\d{4})(\d{2})(\d{2})$/,
                              "$1-$2-$3",
                            )}
                          </td>
                          <td>{num(d.sessions)}</td>
                          <td>{num(d.keyEvents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
              <details className="mt-5 min-w-0 rounded-xl border border-dash-border bg-dash-card p-4">
                <summary className="cursor-pointer font-semibold">
                  Top 10 landing pages
                </summary>
                <div className="mt-3 max-w-full overflow-x-auto">
                  <table
                    className="w-full text-left text-sm"
                    style={{ minWidth: 400 }}
                  >
                    <thead>
                      <tr>
                        <th className="pb-2">Landing page</th>
                        <th>Sessions</th>
                        <th>Engagement</th>
                        <th>Key events</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.pages.map((p) => (
                        <tr
                          key={p.name}
                          className="border-t border-dash-border"
                        >
                          <td className="max-w-xs break-all py-2 pr-3">
                            {p.name}
                          </td>
                          <td>{num(p.sessions)}</td>
                          <td>
                            {p.engagementRate === null
                              ? "—"
                              : `${num(p.engagementRate * 100)}%`}
                          </td>
                          <td>{num(p.keyEvents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
              </>}
            </>
          )}
        </>
      )}
    </div>
  );
}
