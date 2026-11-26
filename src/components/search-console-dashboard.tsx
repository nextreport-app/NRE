"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PerformanceBackLink } from "./performance-back-link";
import { OverviewNavigation } from "./overview-navigation";
import { WizardDatePicker } from "./report-upload-wizard/ui/wizard-date-picker";
import {
  GSC_LABELS,
  GSC_TIMEZONE,
  formatGscMetric,
  type GscSnapshot,
  type GscMetric,
} from "@/lib/search-console/model";
interface Client {
  id: string;
  name: string;
  siteUrl: string | null;
  connected: boolean;
}
interface View {
  clients: Client[];
  selectedClientId: string | null;
  minDate: string;
  maxDate: string;
  snapshots: Array<{
    days: number;
    data: GscSnapshot | null;
    error: string | null;
    fresh: boolean;
    refreshing: boolean;
  }>;
}
const button =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-dash-border px-4 py-2 text-sm font-medium hover:border-dash-accent focus-visible:outline-2 focus-visible:outline-dash-accent disabled:opacity-50";
const metrics: GscMetric[] = ["clicks", "impressions", "ctr", "position"];
export function GscMetricChange({
  metric,
  current,
  previous,
}: {
  metric: GscMetric;
  current: number | null;
  previous: number | null;
}) {
  if (current === null || previous === null)
    return (
      <span className="text-xs text-dash-ink-secondary">
        No comparable data
      </span>
    );
  const delta = current - previous,
    rate = metric === "ctr";
  const text =
    delta === 0
      ? "No change"
      : metric === "position"
        ? `${delta > 0 ? "+" : ""}${delta.toFixed(2)} positions`
        : rate
          ? `${delta > 0 ? "+" : ""}${(delta * 100).toFixed(2)} pp`
          : previous === 0
            ? "From zero"
            : `${delta > 0 ? "+" : ""}${((delta / previous) * 100).toFixed(1)}%`;
  return (
    <span
      title="Compared with the previous equal-length period. Lower average position is better."
      className={`inline-flex rounded-full border border-current px-2 py-1 text-xs font-semibold ${delta === 0 ? "text-dash-ink-secondary" : (metric === "position" ? delta < 0 : delta > 0) ? "text-emerald-400" : "text-red-400"}`}
    >
      {text}
    </span>
  );
}
function SearchTrend({ data }: { data: GscSnapshot }) {
  const [metric, setMetric] = useState<GscMetric>("clicks"),
    [date, setDate] = useState("");
  const rows = data.trend.filter((r) => r[metric] !== null),
    max = Math.max(
      metric === "ctr" ? 0.001 : 1,
      ...rows.map((r) => r[metric]!),
    ),
    start = Date.parse(data.currentPeriod.startIso + "T12:00:00Z");
  const x = (name: string) =>
      55 +
      ((Date.parse(name + "T12:00:00Z") - start) /
        86400000 /
        Math.max(1, data.days - 1)) *
        690,
    y = (value: number) => 205 - (value / max) * 165;
  const selected = rows.find((r) => r.name === date) ?? rows[rows.length - 1];
  return (
    <section
      className="mt-5 min-w-0 rounded-2xl border border-dash-border bg-dash-card p-5"
      aria-label="Search performance trend"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Search performance over time</h2>
        <select
          aria-label="Search chart metric"
          value={metric}
          onChange={(e) => setMetric(e.target.value as GscMetric)}
          className="min-h-11 rounded-lg border border-dash-border bg-dash-bg px-3 text-sm"
        >
          {metrics.map((key) => (
            <option key={key} value={key}>
              {GSC_LABELS[key]}
            </option>
          ))}
        </select>
      </div>
      <p aria-live="polite" className="mt-3 text-sm text-dash-ink-secondary">
        {selected
          ? `${selected.name} · ${formatGscMetric(metric, selected[metric])}`
          : "No daily rows reported for these dates."}
      </p>
      {rows.length > 0 && (
        <div className="mt-3 max-w-full overflow-x-auto">
          <svg
            className="nre-ga4-trend-chart block w-full text-dash-accent"
            style={{ minWidth: 550 }}
            viewBox="0 0 800 245"
            role="group"
            aria-label={`Daily ${GSC_LABELS[metric].toLowerCase()}. Focus or tap a point for its date and value.`}
          >
            {[0, 0.5, 1].map((f) => (
              <g key={f}>
                <line
                  x1="55"
                  x2="745"
                  y1={y(max * f)}
                  y2={y(max * f)}
                  stroke="var(--nre-dash-border)"
                  strokeDasharray="4 5"
                />
                <text
                  x="45"
                  y={y(max * f) + 4}
                  textAnchor="end"
                  fill="var(--nre-dash-ink-secondary)"
                  fontSize="11"
                >
                  {formatGscMetric(metric, max * f)}
                </text>
              </g>
            ))}
            {rows.map((row, index) => {
              const prior = rows[index - 1];
              return (
                <g key={row.name}>
                  {prior &&
                    Date.parse(row.name) - Date.parse(prior.name) ===
                      86400000 && (
                      <line
                        x1={x(prior.name)}
                        x2={x(row.name)}
                        y1={y(prior[metric]!)}
                        y2={y(row[metric]!)}
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                    )}
                  <circle
                    cx={x(row.name)}
                    cy={y(row[metric]!)}
                    r="4"
                    fill="currentColor"
                  />
                  <circle
                    cx={x(row.name)}
                    cy={y(row[metric]!)}
                    r="11"
                    fill="transparent"
                    role="button"
                    tabIndex={0}
                    aria-label={`${row.name}: ${formatGscMetric(metric, row[metric])}`}
                    onMouseEnter={() => setDate(row.name)}
                    onFocus={() => setDate(row.name)}
                    onClick={() => setDate(row.name)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setDate(row.name);
                      }
                    }}
                  />
                </g>
              );
            })}
            <text
              x="55"
              y="235"
              fill="var(--nre-dash-ink-secondary)"
              fontSize="11"
            >
              {data.currentPeriod.startIso}
            </text>
            <text
              x="745"
              y="235"
              textAnchor="end"
              fill="var(--nre-dash-ink-secondary)"
              fontSize="11"
            >
              {data.currentPeriod.endIso}
            </text>
          </svg>
        </div>
      )}
      <p className="mt-2 text-xs text-dash-ink-secondary">
        Current period · hover, tap or focus a point. Missing days are gaps, not
        assumed zeros. Dates use Pacific time.
      </p>
    </section>
  );
}
function SearchTable({
  title,
  description,
  rows,
  kind,
}: {
  title: string;
  description: string;
  rows: GscSnapshot["queries"];
  kind: "query" | "page" | "country" | "device";
}) {
  return (
    <section className="mt-5 min-w-0 rounded-2xl border border-dash-border bg-dash-card p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-xs text-dash-ink-secondary">{description}</p>
      <p className="mt-2 text-xs text-dash-ink-secondary sm:hidden">
        Swipe horizontally to see all metrics →
      </p>
      {!rows.length ? (
        <p className="mt-4 text-sm text-dash-ink-secondary">
          No rows reported for these dates.
        </p>
      ) : (
        <div className="mt-4 max-h-[480px] max-w-full overflow-auto">
          <table
            className="w-full text-left text-sm"
            style={{
              minWidth: kind === "country" || kind === "device" ? 440 : 680,
            }}
          >
            <thead className="sticky top-0 bg-dash-card">
              <tr>
                {[
                  kind === "query"
                    ? "Search query"
                    : kind === "page"
                      ? "Page"
                      : kind === "country"
                        ? "Country code"
                        : "Device",
                  "Clicks",
                  "Impressions",
                  "CTR",
                  "Position",
                ].map((label) => (
                  <th
                    key={label}
                    className="whitespace-nowrap pb-3 pr-4 text-xs text-dash-ink-secondary"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.name} className="border-t border-dash-border">
                  <th className="max-w-md break-all py-3 pr-4 font-normal">
                    {kind === "country" ? row.name.toUpperCase() : row.name}
                  </th>
                  {metrics.map((key) => (
                    <td key={key} className="whitespace-nowrap py-3 pr-4">
                      {formatGscMetric(key, row[key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
export function SearchConsoleDashboard({
  initialClientId = "",
}: {
  initialClientId?: string;
}) {
  const [view, setView] = useState<View | null>(null),
    [days, setDays] = useState<7 | 30 | "custom">(30),
    [search, setSearch] = useState(""),
    [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const version = useRef(0);
  const invalidate = useCallback(() => {
    version.current++;
  }, []);
  const load = useCallback(async () => {
    const request = ++version.current,
      response = await fetch(
        `/api/search-console-overview${initialClientId ? `?clientId=${encodeURIComponent(initialClientId)}` : ""}`,
        { cache: "no-store" },
      );
    const result = await response.json();
    if (!response.ok)
      throw Error(result.error ?? "Search Console could not load.");
    if (request === version.current) setView(result);
  }, [initialClientId]);
  useEffect(() => {
    void load().catch((e) => setError(e.message));
    return invalidate;
  }, [load, invalidate]);
  const selected = view?.clients.find((c) => c.id === initialClientId),
    entry = view?.snapshots.find((s) =>
      days === "custom"
        ? s.days === 0 &&
          s.data?.currentPeriod.startIso === start &&
          s.data?.currentPeriod.endIso === end
        : s.days === days,
    ),
    data = entry?.data;
  async function refresh() {
    if (!selected || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `/api/clients/${selected.id}/search-console`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            days === "custom"
              ? { customRange: { startIso: start, endIso: end } }
              : { days },
          ),
        },
      );
      const result = await response.json();
      await load();
      if (!response.ok)
        throw Error(result.error ?? "Search Console refresh failed.");
      setNotice(
        result.cached
          ? "Using the report checked within the last five minutes."
          : "Search Console data refreshed.",
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Search Console could not refresh.",
      );
    } finally {
      setBusy(false);
    }
  }
  const failure = error || entry?.error || "";
  const needsSetup =
    /authorization|credentials|permission|Connect Search Console|Choose this client|GSC_HTTP_(401|404)/i.test(
      failure,
    ) ||
    (failure.includes("GSC_HTTP_403") && !failure.includes("disabled"));
  const chooseDays = (value: typeof days) => {
    setDays(value);
    setError("");
    setNotice("");
  };
  return (
    <div className="nre-search-console mx-auto w-full min-w-0 max-w-5xl text-dash-ink">
      {initialClientId && <PerformanceBackLink view="seo" />}
      <h1 className="text-2xl font-bold">SEO performance</h1>
      <p className="mt-2 text-sm text-dash-ink-secondary">
        Google Search Console · organic Google Web Search clicks, visibility and
        rankings.
      </p>
      <OverviewNavigation
        current="seo"
        clientId={initialClientId || undefined}
      />
      {!view && !error && (
        <p className="mt-5 text-sm">Loading Search Console…</p>
      )}
      {view && !initialClientId && (
        <section aria-label="All Search Console clients" className="mt-5">
          <div className="rounded-2xl border border-dash-border bg-dash-card p-5">
            <h2 className="text-lg font-semibold">
              Across your search properties
            </h2>
            <p className="mt-2 text-sm text-dash-ink-secondary">
              {view.clients.length} clients ·{" "}
              {view.clients.filter((c) => c.siteUrl).length} with a linked
              Search Console site
            </p>
            <p className="mt-2 text-sm text-dash-ink-secondary">
              Choose a client to see how its website appears in Google Search.
            </p>
          </div>
          {view.clients.length > 0 && (
            <input
              aria-label="Find a Search Console client"
              placeholder="Find a client"
              className="mt-5 min-h-11 w-full rounded-xl border border-dash-border bg-dash-bg px-4 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          )}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {view.clients
              .filter((c) =>
                c.name
                  .toLocaleLowerCase()
                  .includes(search.trim().toLocaleLowerCase()),
              )
              .sort(
                (a, b) =>
                  Number(!!b.siteUrl) - Number(!!a.siteUrl) ||
                  a.name.localeCompare(b.name),
              )
              .map((c) => (
                <article
                  key={c.id}
                  className={`min-w-0 rounded-2xl border bg-dash-card p-5 ${c.connected && c.siteUrl ? "nre-ga4-property-linked" : "border-dash-border"}`}
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <h3 className="font-semibold">{c.name}</h3>
                    <span
                      className={`rounded-full border px-2 py-1 text-xs ${c.connected && c.siteUrl ? "nre-ga4-property-linked__badge" : "border-dash-border text-dash-ink-secondary"}`}
                    >
                      {!c.connected
                        ? "Connect Search Console"
                        : c.siteUrl
                          ? "✓ Site linked"
                          : "Needs setup"}
                    </span>
                  </div>
                  <p className="mt-3 break-all text-sm text-dash-ink-secondary">
                    {c.siteUrl ?? "No Search Console site linked yet."}
                  </p>
                  <Link
                    href={
                      c.connected && c.siteUrl
                        ? `/performance/search-console?client=${encodeURIComponent(c.id)}`
                        : `/clients/${c.id}#search-console`
                    }
                    className={`${button} mt-4 ${c.connected && c.siteUrl ? "nre-ga4-property-linked__action" : ""}`}
                  >
                    {!c.connected
                      ? "Connect Search Console →"
                      : c.siteUrl
                        ? "View SEO performance →"
                        : "Choose Search Console site →"}
                  </Link>
                </article>
              ))}
          </div>
          {!view.clients.length ? (
            <Link
              href="/clients/new?task=search-console"
              className={`${button} mt-4`}
            >
              Add your first client
            </Link>
          ) : (
            !view.clients.some((c) =>
              c.name
                .toLocaleLowerCase()
                .includes(search.trim().toLocaleLowerCase()),
            ) && <p className="mt-4 text-sm">No clients match your search.</p>
          )}
        </section>
      )}
      {selected && (
        <>
          <section className="mt-5 rounded-2xl border border-dash-border bg-dash-card p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-dash-ink-secondary">
                  Website / client
                </p>
                <h2 className="mt-1 break-words text-lg font-semibold">
                  {selected.name}
                </h2>
              </div>
              <div
                className="flex flex-wrap gap-2"
                role="group"
                aria-label="Search Console period"
              >
                {([7, 30] as const).map((n) => (
                  <button
                    key={n}
                    disabled={busy}
                    aria-pressed={days === n}
                    className={`${button} ${days === n ? "bg-dash-bg ring-1 ring-inset ring-dash-ink-secondary" : ""}`}
                    onClick={() => chooseDays(n)}
                  >
                    Last {n} days
                  </button>
                ))}
                <button
                  disabled={busy}
                  aria-pressed={days === "custom"}
                  className={`${button} ${days === "custom" ? "bg-dash-bg ring-1 ring-inset ring-dash-ink-secondary" : ""}`}
                  onClick={() => chooseDays("custom")}
                >
                  Custom dates
                </button>
              </div>
              {selected.connected && selected.siteUrl && (
                <button
                  disabled={busy}
                  className={button}
                  onClick={() => void refresh()}
                >
                  {busy ? "Refreshing…" : "Refresh Search Console"}
                </button>
              )}
            </div>
            {days === "custom" && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <WizardDatePicker
                  label="From"
                  showYear
                  placeholder="Choose start date"
                  value={start}
                  minIso={view?.minDate}
                  maxIso={view?.maxDate}
                  disabled={busy}
                  onChange={(value) => {
                    setStart(value);
                    setError("");
                  }}
                />
                <WizardDatePicker
                  label="To"
                  showYear
                  placeholder="Choose end date"
                  value={end}
                  minIso={start || view?.minDate}
                  maxIso={view?.maxDate}
                  disabled={busy}
                  onChange={(value) => {
                    setEnd(value);
                    setError("");
                  }}
                />
              </div>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-dash-border pt-3 text-xs text-dash-ink-secondary">
              <span className="break-all">
                {selected.siteUrl ?? "No site selected"}
              </span>
              <Link
                href={`/clients/${selected.id}#search-console`}
                className="font-medium text-dash-accent hover:underline"
              >
                {selected.siteUrl ? "Change site" : "Choose site"}
              </Link>
            </div>
            <p className="mt-3 text-xs text-dash-ink-secondary">
              Latest selectable date: {view?.maxDate} · {GSC_TIMEZONE}. Search
              Console data arrives later than GA4. Custom comparisons support
              1–90 days within the last 16 months, including the previous
              comparison period.
            </p>
          </section>
          {(!selected.connected || !selected.siteUrl) && (
            <section className="mt-5 rounded-xl border border-dash-border bg-dash-card p-5">
              <h2 className="font-semibold">
                {!selected.connected
                  ? "Connect Search Console for this client"
                  : "Choose this client’s Search Console site"}
              </h2>
              <p className="mt-2 text-sm text-dash-ink-secondary">
                Use Connections in Client settings to select the right Google
                login and domain or URL-prefix property.
              </p>
              <Link
                href={`/clients/${selected.id}#search-console`}
                className={`${button} mt-3`}
              >
                Set up Search Console →
              </Link>
            </section>
          )}
        </>
      )}
      {(error || entry?.error) && (
        <section
          role="alert"
          className="mt-4 rounded-xl border border-amber-500/30 bg-dash-card p-4"
        >
          <h2 className="font-semibold">
            {error
              ? "Search Console data could not be refreshed"
              : "Last Search Console refresh failed"}
          </h2>
          <p className="mt-2 text-sm text-dash-ink-secondary">{failure}</p>
          {selected?.siteUrl && (
            <p className="mt-2 text-xs text-dash-ink-secondary">
              Your site selection is saved. A failed refresh does not unlink the
              site.
            </p>
          )}
          {selected && needsSetup && (
            <Link
              href={`/clients/${selected.id}#search-console`}
              className={`${button} mt-3`}
            >
              Review Search Console connection →
            </Link>
          )}
        </section>
      )}
      {notice && (
        <p role="status" className="mt-3 text-sm text-dash-ink-secondary">
          {notice}
        </p>
      )}
      {entry?.refreshing && !busy && (
        <p className="mt-3 text-sm">
          A refresh is running. Reload shortly to see the result.
        </p>
      )}
      {selected?.connected &&
        selected.siteUrl &&
        !data &&
        !error &&
        !entry?.error && (
          <p className="mt-5 text-sm text-dash-ink-secondary">
            Your site is linked. Click Refresh Search Console to load the
            selected dates.
          </p>
        )}
      {selected && data && (
        <>
          <div className="mt-5 text-sm">
            <p>
              {data.currentPeriod.startIso} – {data.currentPeriod.endIso} ·
              previous {data.previousPeriod.startIso} –{" "}
              {data.previousPeriod.endIso}
            </p>
            <p className="mt-1 text-xs text-dash-ink-secondary">
              Checked{" "}
              {new Date(data.checkedAt).toLocaleString("en", {
                timeZone: GSC_TIMEZONE,
              })}{" "}
              Pacific time · Google Web Search
            </p>
          </div>
          {!entry?.fresh && (
            <p className="mt-2 text-sm text-amber-400">
              Saved data is older or the last refresh failed. Refresh before
              acting.
            </p>
          )}
          <section
            aria-label="Search Console summary"
            className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4"
          >
            {metrics.map((key) => (
              <article
                key={key}
                className="nre-ga4-metric-card relative overflow-hidden rounded-2xl border border-dash-border bg-dash-card p-5"
              >
                <h2 className="text-xs font-medium text-dash-ink-secondary">
                  {GSC_LABELS[key]}
                </h2>
                <p className="mt-3 text-3xl font-semibold">
                  {formatGscMetric(key, data.current[key])}
                </p>
                <p className="mt-1 text-xs text-dash-ink-secondary">
                  Previous: {formatGscMetric(key, data.previous[key])}
                </p>
                <div className="mt-3">
                  {entry?.fresh ? (
                    <GscMetricChange
                      metric={key}
                      current={data.current[key]}
                      previous={data.previous[key]}
                    />
                  ) : (
                    <span className="text-xs text-dash-ink-secondary">
                      Refresh for a current comparison
                    </span>
                  )}
                </div>
              </article>
            ))}
          </section>
          {data.empty && (
            <section className="mt-5 rounded-xl border border-dash-border bg-dash-card p-5">
              <h2 className="font-semibold">
                No Google Search impressions reported for these dates
              </h2>
              <p className="mt-2 text-sm text-dash-ink-secondary">
                The request succeeded and your site remains linked. Try another
                date range; a new or low-traffic site may not have search data
                yet.
              </p>
              <button
                className={`${button} mt-3`}
                onClick={() => chooseDays("custom")}
              >
                Choose custom dates
              </button>
            </section>
          )}
          <SearchTrend key={`${data.rangeKey}:${data.checkedAt}`} data={data} />
          <p className="mt-4 text-xs leading-relaxed text-dash-ink-secondary">
            Search Console clicks are not GA4 sessions. Average position is not
            a fixed ranking; lower is better. Google withholds some queries for
            privacy and returns top rows, so query/page totals may differ from
            the headline totals. Tables below show the current period.
          </p>
          <SearchTable
            title="Top 20 search queries"
            description="Search terms returned by Google, ranked by clicks. Anonymized queries are omitted by Google."
            rows={data.queries}
            kind="query"
          />
          <SearchTable
            title="Top 20 pages in search"
            description="Your search landing pages, ranked by Google Search clicks."
            rows={data.pages}
            kind="page"
          />
          <div className="grid min-w-0 gap-4 lg:grid-cols-2">
            <SearchTable
              title="Top 10 countries"
              description="Country codes as reported by Google, ranked by clicks."
              rows={data.countries}
              kind="country"
            />
            <SearchTable
              title="Devices"
              description="Search clicks and visibility across device types."
              rows={data.devices}
              kind="device"
            />
          </div>
          <a
            href={`https://search.google.com/search-console/performance/search-analytics?resource_id=${encodeURIComponent(data.siteUrl)}`}
            target="_blank"
            rel="noopener noreferrer"
            className={`${button} mt-5`}
          >
            Open this site in Search Console ↗
          </a>
        </>
      )}
    </div>
  );
}
