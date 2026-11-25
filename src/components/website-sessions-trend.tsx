"use client";
import { useId, useState } from "react";
import { formatWebsiteMetric } from "./website-detail-table";
import type { WebsiteMetric, WebsiteSnapshot } from "@/lib/website-dashboard/model";

export function WebsiteSessionsTrend({ data }: { data: WebsiteSnapshot }) {
  const [metric, setMetric] = useState<WebsiteMetric>("sessions");
  const [focusedDate, setFocusedDate] = useState("");
  const gradient = useId().replace(/:/g, "");
  const choices: Array<[WebsiteMetric, string]> = [["sessions", "Sessions"], ["totalUsers", "Total users"], ["newUsers", "New users"], ["screenPageViews", "Page views"], ["engagementRate", "Engagement rate"], ["bounceRate", "Bounce rate"], ["keyEvents", "Key events"]];
  const label = choices.find(([key]) => key === metric)![1];
  const start = Date.parse(data.currentPeriod.startIso + "T12:00:00Z");
  const points = data.trend.filter(row => row[metric] != null).map(row => {
    const iso = row.date.replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3");
    return { iso, day: (Date.parse(iso + "T12:00:00Z") - start) / 86400000, value: row[metric]! };
  }).sort((a, b) => a.day - b.day);
  const max = Math.max(metric.endsWith("Rate") ? .01 : 1, ...points.map(p => p.value));
  const x = (day: number) => 64 + day / Math.max(1, data.days - 1) * 700;
  const y = (value: number) => 214 - value / max * 168;
  const dateLabel = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" });
  const focused = points.find(p => p.iso === focusedDate) ?? points[points.length - 1];
  const segments: typeof points[] = [];
  points.forEach(p => {
    const last = segments[segments.length - 1];
    if (!last || p.day !== last[last.length - 1].day + 1) segments.push([p]);
    else last.push(p);
  });
  const ticks = Array.from(new Set([0, Math.round((data.days - 1) / 4), Math.round((data.days - 1) / 2), Math.round(3 * (data.days - 1) / 4), data.days - 1]));
  return <section aria-label="Daily traffic chart" className="mt-5 min-w-0 overflow-hidden rounded-2xl border border-dash-border bg-dash-card p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs font-medium uppercase tracking-wider text-dash-ink-secondary">Traffic over time</p><h2 className="mt-1 text-lg font-semibold">Daily {label.toLowerCase()}</h2><p className="mt-1 text-xs text-dash-ink-secondary">{dateLabel(data.currentPeriod.startIso)} – {dateLabel(data.currentPeriod.endIso)} · current period</p></div>
      <label className="text-xs text-dash-ink-secondary">Chart metric<select aria-label="Trend metric" value={metric} onChange={e => {setMetric(e.target.value as WebsiteMetric);setFocusedDate("");}} className="mt-1 block min-h-11 rounded-lg border border-dash-border bg-dash-bg px-3 py-2 text-sm text-dash-ink">{choices.map(([key, title]) => <option key={key} value={key}>{title}</option>)}</select></label>
    </div>
    {points.length ? <>
      <div aria-live="polite" className="mt-4 flex flex-wrap items-baseline gap-2 rounded-xl border border-dash-border bg-dash-bg px-4 py-3"><span className="h-2 w-2 rounded-full bg-dash-accent" aria-hidden="true"/><span className="text-sm text-dash-ink-secondary">{focused && dateLabel(focused.iso)}</span><strong className="text-xl">{formatWebsiteMetric(metric, focused?.value)}</strong><span className="text-xs text-dash-ink-secondary">{label.toLowerCase()}</span></div>
      <div className="mt-3 max-w-full overflow-x-auto">
        <svg className="nre-ga4-trend-chart block w-full text-dash-accent" style={{ minWidth: 560 }} viewBox="0 0 800 254" role="group" aria-label={`Daily ${label.toLowerCase()} with dates and values. Focus a point for details.`}>
          <defs><linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity=".18"/><stop offset="100%" stopColor="currentColor" stopOpacity="0"/></linearGradient></defs>
          {[0, .25, .5, .75, 1].map(fraction => <g key={fraction}><line x1="64" x2="764" y1={y(max * fraction)} y2={y(max * fraction)} stroke="var(--nre-dash-border)" strokeDasharray={fraction ? "3 5" : undefined}/><text x="54" y={y(max * fraction) + 4} textAnchor="end" fill="var(--nre-dash-ink-secondary)" fontSize="11">{formatWebsiteMetric(metric, max * fraction)}</text></g>)}
          {ticks.map(day => <text key={day} x={x(day)} y="242" textAnchor={day === 0 ? "start" : day === data.days - 1 ? "end" : "middle"} fill="var(--nre-dash-ink-secondary)" fontSize="11">{dateLabel(new Date(start + day * 86400000).toISOString().slice(0, 10))}</text>)}
          {segments.map((segment, index) => {
            const path = segment.map((p, i) => `${i ? "L" : "M"}${x(p.day)},${y(p.value)}`).join(" ");
            return <g key={index}><path d={`${path} L${x(segment[segment.length - 1].day)},214 L${x(segment[0].day)},214 Z`} fill={`url(#${gradient})`}/><path d={path} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/></g>;
          })}
          {points.map(p => <g key={p.iso}><circle cx={x(p.day)} cy={y(p.value)} r={focused?.iso === p.iso ? 5 : 3} fill="var(--nre-dash-card)" stroke="currentColor" strokeWidth="2"/><circle role="button" tabIndex={0} aria-label={`${dateLabel(p.iso)}: ${formatWebsiteMetric(metric, p.value)} ${label.toLowerCase()}`} cx={x(p.day)} cy={y(p.value)} r="11" fill="transparent" className="cursor-pointer focus:outline-dash-accent" onMouseEnter={() => setFocusedDate(p.iso)} onFocus={() => setFocusedDate(p.iso)} onClick={() => setFocusedDate(p.iso)} onKeyDown={e => {if(e.key === "Enter" || e.key === " "){e.preventDefault();setFocusedDate(p.iso);}}}><title>{dateLabel(p.iso)}: {formatWebsiteMetric(metric, p.value)}</title></circle></g>)}
        </svg>
      </div>
      <p className="mt-2 text-xs text-dash-ink-secondary">Hover, tap or focus a point for its daily value. Gaps mean GA4 returned no row; they are not assumed to be zero. Swipe the chart on smaller screens.</p>
    </> : <p className="mt-4 text-sm text-dash-ink-secondary">Daily {label.toLowerCase()} are unavailable. Refresh GA4 to load the latest metrics.</p>}
  </section>;
}
