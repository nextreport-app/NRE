"use client";
import { WebsitePaidTraffic } from "./website-paid-traffic";
import { Fragment, useState } from "react";
import { WebsiteMetricChange } from "./website-metric-change";
import type { WebsiteSnapshot } from "@/lib/website-dashboard/model";
import { channelComparisons } from "@/lib/website-dashboard/changes";
import { WEBSITE_DETAIL_COLUMNS, formatWebsiteMetric } from "./website-detail-table";
const number = (n: number | null | undefined) =>
  n == null
    ? "—"
    : new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);
export function WebsiteChannelComparison({
  data,
  fresh,
}: {
  data: WebsiteSnapshot;
  fresh: boolean;
}) {
  const [expanded, setExpanded] = useState("");
  const rows = channelComparisons(data);
  return (
    <section
      aria-label="Channel comparisons"
      className="nre-website-changes mt-5 min-w-0 rounded-xl border border-dash-border bg-dash-card p-4"
    >
      <h2 className="font-semibold">Traffic by channel</h2>
      <p className="mt-1 text-xs text-dash-ink-secondary">
        Current versus previous {data.days} days. Open a channel for engagement
        and key-event comparisons.
      </p>
      {!data.previousChannels && (
        <p className="mt-3 text-sm text-amber-400">
          Refresh GA4 to add the previous-period channel data to this saved
          snapshot.
        </p>
      )}
      {(!fresh || !!data.warnings.length) && (
        <p className="mt-2 text-xs text-dash-ink-secondary">
          {!fresh
            ? "Saved comparison only; refresh before acting."
            : "GA4 data-quality notices apply to these comparisons."}
        </p>
      )}
      <p className="mt-2 text-xs text-dash-ink-secondary sm:hidden">
        Swipe to see both periods →
      </p>
      <WebsitePaidTraffic data={data} />
      <div className="mt-3 max-w-full overflow-x-auto">
        <table className="w-full text-left text-sm" style={{ minWidth: 460 }}>
          <thead>
            <tr>
              {["Channel", "Sessions", "Previous", "Change"].map((label) => (
                <th
                  key={label}
                  className="pb-2 pr-3 text-xs font-medium text-dash-ink-secondary"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <Fragment key={row.name}>
                <tr className="border-t border-dash-border">
                  <th className="py-3 pr-3 font-normal">
                    <button
                      aria-label={`Compare ${row.name}`}
                      aria-expanded={expanded === row.name}
                      className="text-left underline"
                      onClick={() =>
                        setExpanded(expanded === row.name ? "" : row.name)
                      }
                    >
                      {row.name} <span aria-hidden="true">{expanded === row.name ? "▴" : "▾"}</span>
                    </button>
                    {row.availability && (
                      <span className="mt-1 block text-xs text-dash-ink-secondary">
                        {row.availability}
                      </span>
                    )}
                  </th>
                  <td className="py-3 pr-3">{number(row.current?.sessions)}</td>
                  <td className="py-3 pr-3">
                    {number(row.previous?.sessions)}
                  </td>
                  <td className="py-3"><WebsiteMetricChange metric="sessions" current={row.current?.sessions} previous={row.previous?.sessions} comparable={fresh && !data.warnings.length} /></td>
                </tr>
                {expanded === row.name && (
                  <tr>
                    <td colSpan={4} className="pb-4">
                      <div className="rounded-lg border border-dash-border p-3">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <strong>{row.name}</strong>
                        </div>
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr>
                              <th className="pb-2">Metric</th>
                              <th>Current</th>
                              <th>Previous</th>
                              <th>Change</th>
                            </tr>
                          </thead>
                          <tbody>
                            {WEBSITE_DETAIL_COLUMNS.map(([key, label]) => (
                              <tr key={key} className="border-t border-dash-border">
                                <th className="py-2 pr-2 font-normal">{label}</th>
                                <td>{formatWebsiteMetric(key, row.current?.[key])}</td>
                                <td>{formatWebsiteMetric(key, row.previous?.[key])}</td>
                                <td><WebsiteMetricChange metric={key} current={row.current?.[key]} previous={row.previous?.[key]} comparable={fresh && !data.warnings.length} /></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && (
        <p className="mt-3 text-sm">
          No channel rows were reported for these periods.
        </p>
      )}
      <p className="mt-3 text-xs text-dash-ink-secondary">
        Channel attribution comes from GA4. Missing values are shown as —.
      </p>
    </section>
  );
}
