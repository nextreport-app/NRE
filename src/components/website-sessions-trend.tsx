"use client";
import { useState } from "react";
import { formatWebsiteMetric } from "./website-detail-table";
import type { WebsiteMetric } from "@/lib/website-dashboard/model";
import type { WebsiteSnapshot } from "@/lib/website-dashboard/model";
export function WebsiteSessionsTrend({ data }: { data: WebsiteSnapshot }) {
  const [metric, setMetric] = useState<WebsiteMetric>("sessions");
  const choices: Array<[WebsiteMetric,string]> = [["sessions","Sessions"],["totalUsers","Users"],["screenPageViews","Views"],["engagementRate","Engagement rate"],["bounceRate","Bounce rate"],["keyEvents","Key events"]];
  const label = choices.find(([key])=>key===metric)![1];
  const points = data.trend.filter((d) => d[metric] != null),
    max = Math.max(metric.endsWith("Rate") ? .01 : 1, ...points.map((d) => d[metric]!));
  const start = Date.parse(data.currentPeriod.startIso + "T12:00:00Z");
  return (
    <section className="mt-5 min-w-0 rounded-xl border border-dash-border bg-dash-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Daily {label.toLowerCase()}</h2>
        <select aria-label="Trend metric" value={metric} onChange={e=>setMetric(e.target.value as WebsiteMetric)} className="rounded-lg border border-dash-border bg-dash-bg px-3 py-2 text-sm">{choices.map(([key,title])=><option key={key} value={key}>{title}</option>)}</select>
      </div>
      {points.length ? (
        <svg
          className="mt-3 block w-full text-dash-accent"
          viewBox="0 0 600 125"
          role="img"
          aria-label={`Daily ${label.toLowerCase()} reported by Google Analytics`}
        >
          <line
            x1="0"
            x2="600"
            y1="120"
            y2="120"
            stroke="currentColor"
            opacity=".25"
          />
          {points.map((p) => {
            const iso = p.date.replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3"),
              index = (Date.parse(iso + "T12:00:00Z") - start) / 86400000,
              width = 600 / data.days;
            return (
              <rect
                key={p.date}
                x={index * width + 2}
                y={120 - (p[metric]! / max) * 108}
                width={Math.max(1, width - 4)}
                height={(p[metric]! / max) * 108}
                fill="currentColor"
                rx="2"
              >
                <title>
                  {iso}: {formatWebsiteMetric(metric, p[metric])} {label.toLowerCase()}
                </title>
              </rect>
            );
          })}
        </svg>
      ) : (
        <p className="mt-3 text-sm text-dash-ink-secondary">
          Daily {label.toLowerCase()} are unavailable. Refresh GA4 to load the latest metrics.
        </p>
      )}
      <div className="mt-1 flex justify-between text-xs text-dash-ink-secondary">
        <span>{data.currentPeriod.startIso}</span>
        <span>{data.currentPeriod.endIso}</span>
      </div>
      <p className="mt-2 text-xs text-dash-ink-secondary">
        Hover a bar for its value. Gaps mean GA4 returned no daily row.
      </p>
    </section>
  );
}
