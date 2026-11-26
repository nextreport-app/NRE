"use client";
import { BreakdownTotals, sumReported } from "./performance-presentation";
import { WebsitePaidTraffic } from "./website-paid-traffic";
import { WebsiteMetricChange } from "./website-metric-change";
import type { WebsiteMetric, WebsiteSnapshot } from "@/lib/website-dashboard/model";
import { channelComparisons } from "@/lib/website-dashboard/changes";
import { formatWebsiteMetric } from "./website-detail-table";
const columns: Array<[WebsiteMetric, string]> = [["totalUsers", "Users"], ["screenPageViews", "Page views"], ["engagementRate", "Engagement"], ["bounceRate", "Bounce rate"], ["keyEvents", "Key events"], ["averageSessionDuration", "Avg. session"]];
export function WebsiteChannelComparison({ data, fresh }: { data: WebsiteSnapshot; fresh: boolean }) {
  const rows = channelComparisons(data);
  return <section aria-label="Channel comparisons" className="nre-website-changes mt-5 min-w-0 rounded-2xl border border-dash-border bg-dash-card p-4 sm:p-5">
    <h2 className="text-lg font-semibold">Traffic by channel</h2>
    <p className="mt-1 text-xs text-dash-ink-secondary">Where visitors came from, how engaged they were and which channels drove key events. Change compares sessions with the previous period.</p>
    {!data.previousChannels && <p className="mt-3 text-sm text-amber-400">Refresh GA4 to add previous-period channel data to this saved report.</p>}
    {(!fresh || !!data.warnings.length) && <p className="mt-2 text-xs text-dash-ink-secondary">{!fresh ? "Saved comparison only; refresh before acting." : "GA4 data-quality notices apply to these comparisons."}</p>}
      <BreakdownTotals
        items={[
          <>
            <strong>{data.channels.length}</strong> current-period channels
          </>,
          <>
            <strong>
              {formatWebsiteMetric(
                "sessions",
                sumReported(data.channels.map((row) => row.sessions)),
              )}
            </strong>{" "}
            sessions in listed channels
          </>,
          <>
            <strong>
              {formatWebsiteMetric(
                "keyEvents",
                sumReported(data.channels.map((row) => row.keyEvents)),
              )}
            </strong>{" "}
            key events in listed channels
          </>,
        ]}
      />
    <WebsitePaidTraffic data={data}/>
    <p className="mt-3 text-xs text-dash-ink-secondary">Scroll horizontally to see all channel metrics →</p>
    <div className="mt-3 max-w-full overflow-x-auto"><table className="w-full text-left text-sm" style={{minWidth: 1050}}><thead><tr>{["Channel", "Sessions", "Previous", "Change", ...columns.map(([,name]) => name)].map(name => <th key={name} className="whitespace-nowrap pb-3 pr-4 text-xs font-medium text-dash-ink-secondary">{name}</th>)}</tr></thead><tbody>
      {rows.map(row => <tr key={row.name} className="border-t border-dash-border"><th className="py-4 pr-4 font-medium">{row.name}{row.availability && <span className="mt-1 block text-xs font-normal text-dash-ink-secondary">{row.availability}</span>}</th><td className="pr-4">{formatWebsiteMetric("sessions", row.current?.sessions)}</td><td className="pr-4">{formatWebsiteMetric("sessions", row.previous?.sessions)}</td><td className="pr-4"><WebsiteMetricChange metric="sessions" current={row.current?.sessions} previous={row.previous?.sessions} comparable={fresh && !data.warnings.length}/></td>{columns.map(([key]) => <td key={key} className="whitespace-nowrap py-3 pr-4">{formatWebsiteMetric(key,row.current?.[key])}</td>)}</tr>)}
    </tbody></table></div>
    {!rows.length && <p className="mt-3 text-sm text-dash-ink-secondary">No channel rows were reported for these periods.</p>}
    <p className="mt-3 text-xs text-dash-ink-secondary">Users can appear in more than one channel; adding channel users does not give unique period users. Missing values appear as —.</p>
  </section>;
}
