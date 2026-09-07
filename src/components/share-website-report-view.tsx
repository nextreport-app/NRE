import type { ShareWebsiteReportData } from "@/lib/nre/share-website-report";
import type { WebsiteBreakdownOptions } from "@/lib/nre/website-report-data";

function shareBreakdowns(data: ShareWebsiteReportData): WebsiteBreakdownOptions {
  if (data.breakdowns) return data.breakdowns;
  // Legacy Phase 1 reports — channels + top pages only
  return { device: false, geoCities: false, channels: true, topPages: true };
}

function MetricCardGrid({ title, metrics }: { title: string; metrics: ShareWebsiteReportData["overviewMetrics"] }) {
  if (metrics.length === 0) return null;
  return (
    <section className="print-slide mb-8 break-inside-avoid rounded-xl border border-slate-700/60 bg-[#0f172a] p-6">
      <h2 className="mb-4 text-lg font-semibold text-amber-400">{title}</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {metrics.map((m) => (
          <div key={`${title}-${m.label}`} className="rounded-lg border border-slate-700 bg-[#111f35] p-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{m.label}</p>
            <p className="mt-1 text-xl font-semibold text-white">{m.value}</p>
            {m.changeLabel ? <p className="mt-1 text-xs text-emerald-400">{m.changeLabel}</p> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function SimpleTable({
  title,
  columns,
  rows,
}: {
  title: string;
  columns: string[];
  rows: string[][];
}) {
  return (
    <section className="print-slide mb-8 break-inside-avoid rounded-xl border border-slate-700/60 bg-[#0f172a] p-6">
      <h2 className="mb-4 text-lg font-semibold text-amber-400">{title}</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse text-sm">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col} className="border-b border-slate-700 px-3 py-2 text-left text-xs uppercase text-slate-400">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-slate-800/80">
                {row.map((cell, j) => (
                  <td key={j} className="px-3 py-2 text-slate-200">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * Public share page for Website Traffic (GA4) reports.
 */
export function ShareWebsiteReportView({
  data,
  shareToken,
  isPrint = false,
}: {
  data: ShareWebsiteReportData;
  shareToken?: string;
  isPrint?: boolean;
}) {
  const breakdowns = shareBreakdowns(data);

  return (
    <div
      id={isPrint ? "share-report-print" : "share-report-page"}
      className="min-h-screen bg-[#0b1220] text-slate-100"
    >
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <section className="print-slide mb-8 break-inside-avoid rounded-xl border border-slate-700/60 bg-[#0f172a] p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Website Traffic Report</p>
          <h1 className="mt-2 text-3xl font-bold text-white">{data.accountName}</h1>
          <p className="mt-2 text-slate-300">{data.propertyName}</p>
          <p className="mt-4 text-sm text-slate-400">{data.dateRangeLabel}</p>
          {data.comparisonRangeLabel ? (
            <p className="text-sm text-slate-500">Compared to {data.comparisonRangeLabel}</p>
          ) : null}
          {data.agencyName ? <p className="mt-6 text-sm text-slate-400">Prepared by {data.agencyName}</p> : null}
        </section>

        <MetricCardGrid title="Traffic Overview" metrics={data.overviewMetrics} />
        <MetricCardGrid title="Conversions & Engagement" metrics={data.conversionMetrics} />

        {breakdowns.device ? (
          <SimpleTable
            title="Device Breakdown"
            columns={["Device", "Sessions", "Engagement", "Conversions"]}
            rows={(data.devices ?? []).length
              ? (data.devices ?? []).map((d) => [d.device, d.sessionsLabel, d.engagementRateLabel, d.conversionsLabel])
              : [["No device data", "—", "—", "—"]]}
          />
        ) : null}

        {breakdowns.channels ? (
          <SimpleTable
            title="Traffic Sources"
            columns={["Channel", "Sessions", "Engagement", "Conversions"]}
            rows={data.channels.map((c) => [c.channel, c.sessionsLabel, c.engagementRateLabel, c.conversionsLabel])}
          />
        ) : null}

        {breakdowns.geoCities ? (
          <SimpleTable
            title="Top Cities"
            columns={["City", "Sessions", "% of Total", "Conversions", "Conv. Rate"]}
            rows={(data.geoCities ?? []).length
              ? (data.geoCities ?? []).map((g) => [
                  g.location,
                  g.sessionsLabel,
                  g.shareLabel,
                  g.conversionsLabel,
                  g.conversionRateLabel,
                ])
              : [["No location data", "—", "—", "—", "—"]]}
          />
        ) : null}

        {breakdowns.topPages && data.topPages.length > 0 ? (
          <SimpleTable
            title="Top Landing Pages"
            columns={["Page", "Sessions", "Engagement"]}
            rows={data.topPages.map((p) => [p.page, p.sessionsLabel, p.engagementRateLabel])}
          />
        ) : null}

        <p className="text-xs leading-relaxed text-slate-500">{data.attributionNote}</p>

        {!isPrint && shareToken ? (
          <p className="mt-8 text-center text-xs text-slate-600">Shared via NextReport · {shareToken.slice(0, 6)}…</p>
        ) : null}
      </main>
    </div>
  );
}

export function websiteReportTypeLabel(): string {
  return "Website Traffic Report";
}
