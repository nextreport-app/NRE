import type { ShareWebsiteReportData } from "@/lib/nre/share-website-report";
import { shareBreakdowns } from "@/lib/nre/share-website-report";
import { geoColumnHeader, geoSlideTitle } from "@/lib/nre/website-report-config";

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
  footnote,
}: {
  title: string;
  columns: string[];
  rows: string[][];
  footnote?: string;
}) {
  return (
    <section className="print-slide mb-8 break-inside-avoid rounded-xl border border-slate-700/60 bg-[#0f172a] p-6">
      <h2 className="mb-4 text-lg font-semibold text-amber-400">{title}</h2>
      {footnote ? <p className="mb-3 text-xs text-slate-500">{footnote}</p> : null}
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

function metricTableRows(
  rows: Array<{ label: string; sessionsLabel: string; engagementRateLabel: string; conversionsLabel: string }>,
  emptyLabel: string,
): string[][] {
  if (rows.length === 0) return [[emptyLabel, "—", "—", "—"]];
  return rows.map((r) => [r.label, r.sessionsLabel, r.engagementRateLabel, r.conversionsLabel]);
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
  const geoDim = data.geoDimension ?? "city";

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
            rows={metricTableRows(
              (data.devices ?? []).map((d) => ({
                label: d.device,
                sessionsLabel: d.sessionsLabel,
                engagementRateLabel: d.engagementRateLabel,
                conversionsLabel: d.conversionsLabel,
              })),
              "No device data",
            )}
          />
        ) : null}

        {breakdowns.channels ? (
          <SimpleTable
            title="Traffic Sources"
            columns={["Channel", "Sessions", "Engagement", "Conversions"]}
            rows={data.channels.map((c) => [c.channel, c.sessionsLabel, c.engagementRateLabel, c.conversionsLabel])}
          />
        ) : null}

        {breakdowns.geo ? (
          <SimpleTable
            title={geoSlideTitle(geoDim)}
            columns={[geoColumnHeader(geoDim), "Sessions", "% of Total", "Conversions", "Conv. Rate"]}
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

        {breakdowns.campaigns ? (
          <SimpleTable
            title="Campaign Performance"
            columns={["Campaign", "Sessions", "Engagement", "Conversions"]}
            rows={metricTableRows(
              (data.campaigns ?? []).map((c) => ({
                label: c.campaign,
                sessionsLabel: c.sessionsLabel,
                engagementRateLabel: c.engagementRateLabel,
                conversionsLabel: c.conversionsLabel,
              })),
              "No campaign data",
            )}
          />
        ) : null}

        {breakdowns.sources ? (
          <SimpleTable
            title="Traffic Sources (UTM)"
            columns={["Source / Medium", "Sessions", "Engagement", "Conversions"]}
            rows={metricTableRows(
              (data.sources ?? []).map((s) => ({
                label: s.label,
                sessionsLabel: s.sessionsLabel,
                engagementRateLabel: s.engagementRateLabel,
                conversionsLabel: s.conversionsLabel,
              })),
              "No source data",
            )}
          />
        ) : null}

        {breakdowns.demographics ? (
          <>
            <SimpleTable
              title="Age Groups"
              columns={["Age", "Sessions", "Conversions", "Conv. Rate"]}
              footnote={data.demographicsNote}
              rows={(data.ageGroups ?? []).length
                ? (data.ageGroups ?? []).map((a) => [a.segment, a.sessionsLabel, a.conversionsLabel, a.conversionRateLabel])
                : [["No age data", "—", "—", "—"]]}
            />
            <SimpleTable
              title="Gender"
              columns={["Gender", "Sessions", "Conversions", "Conv. Rate"]}
              rows={(data.genders ?? []).length
                ? (data.genders ?? []).map((g) => [g.segment, g.sessionsLabel, g.conversionsLabel, g.conversionRateLabel])
                : [["No gender data", "—", "—", "—"]]}
            />
          </>
        ) : null}

        {breakdowns.operatingSystem ? (
          <SimpleTable
            title="Operating System"
            columns={["OS", "Sessions", "Engagement", "Conversions"]}
            rows={metricTableRows(
              (data.operatingSystems ?? []).map((t) => ({
                label: t.name,
                sessionsLabel: t.sessionsLabel,
                engagementRateLabel: t.engagementRateLabel,
                conversionsLabel: t.conversionsLabel,
              })),
              "No OS data",
            )}
          />
        ) : null}

        {breakdowns.browser ? (
          <SimpleTable
            title="Browser"
            columns={["Browser", "Sessions", "Engagement", "Conversions"]}
            rows={metricTableRows(
              (data.browsers ?? []).map((t) => ({
                label: t.name,
                sessionsLabel: t.sessionsLabel,
                engagementRateLabel: t.engagementRateLabel,
                conversionsLabel: t.conversionsLabel,
              })),
              "No browser data",
            )}
          />
        ) : null}

        {breakdowns.newVsReturning ? (
          <SimpleTable
            title="New vs Returning"
            columns={["Audience", "Sessions", "Engagement", "Conversions"]}
            rows={metricTableRows(
              (data.audience ?? []).map((a) => ({
                label: a.segment,
                sessionsLabel: a.sessionsLabel,
                engagementRateLabel: a.engagementRateLabel,
                conversionsLabel: a.conversionsLabel,
              })),
              "No audience data",
            )}
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
