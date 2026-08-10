import { buildCombinedTotalTableGrid } from "@/lib/nre/report-data";
import { buildGoogleCombinedTotalTableGrid } from "@/lib/nre/google-report-data";
import type { ShareReportData, ShareCampaignData } from "@/lib/nre/share-report";
import type { DeliveryStatusIndicator } from "@/lib/nre/delivery-status";

/**
 * The public share page's actual presentational tree (app/r/[token]/page.tsx),
 * pulled into its own module so it can be rendered from a fixture — no DB,
 * no Next.js request context — for the empirical visual check this session's
 * "run tsc/eslint/vitest/build, then look at the real thing" pattern
 * otherwise couldn't reach for a page whose only real caller needs a live
 * Postgres connection.
 */

export function reportTypeLabel(data: ShareReportData): string {
  return data.reportType === "MONTHLY" ? "Monthly Performance Report" : "Weekly Performance Report";
}

function StatusBadge({ status }: { status: DeliveryStatusIndicator }) {
  if (!status) return null;
  return (
    <span className="rounded-full border border-dash-border bg-dash-bg px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-dash-ink-secondary">
      {status}
    </span>
  );
}

function MetricGrid({ metrics }: { metrics: ShareCampaignData["metrics"] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {metrics.map((m, i) => (
        <div key={`${m.key}-${i}`} className="rounded-md border border-dash-border bg-dash-bg px-3 py-3">
          <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-dash-accent">{m.label}</p>
          <p className="mt-1 truncate text-[18px] font-bold text-dash-ink">{m.value}</p>
        </div>
      ))}
    </div>
  );
}

function CampaignCard({ campaign }: { campaign: ShareCampaignData }) {
  return (
    <div className="rounded-lg border border-dash-border bg-dash-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[18px] font-bold text-dash-ink">{campaign.campaignName}</h3>
        <StatusBadge status={campaign.statusIndicator} />
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-dash-ink-secondary">
        <span>{campaign.dateRange}</span>
        <span className="rounded-full border border-dash-border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-dash-ink-secondary">
          {campaign.resultLabel}
        </span>
      </div>

      <div className="mt-4">
        <MetricGrid metrics={campaign.metrics} />
      </div>

      {campaign.aiSummary && <p className="mt-4 text-[14px] leading-relaxed text-dash-ink">{campaign.aiSummary}</p>}
      {campaign.aiInsights && <p className="mt-2 text-[14px] leading-relaxed text-dash-ink-secondary">{campaign.aiInsights}</p>}
    </div>
  );
}

/**
 * Reproduces the exact PPT Combined Total slide's row-hiding rules
 * (pptx/fill-tags.ts's buildTableSlideXml) so this table only ever shows
 * the same rows the client would see in the deck: the Period row is
 * dropped for a Monthly report or when there's no Previous Month Data, and
 * the MTD row is additionally dropped when it would duplicate the Period
 * row's own month.
 */
function CombinedTotalTable({ data }: { data: ShareReportData }) {
  const grid =
    data.platform === "GOOGLE"
      ? buildGoogleCombinedTotalTableGrid(data.mtdRow, data.tableHeaderLabels)
      : buildCombinedTotalTableGrid(data.periodRow, data.mtdRow, data.tableHeaderLabels);

  const hidePeriodRow = data.reportType === "MONTHLY" || !data.periodRow.hasData;
  const hideMtdRow = !hidePeriodRow && data.periodRow.sameMonthAsCurrentMTD;
  const [headerRow, periodRow, mtdRow] = grid;
  const bodyRows = [...(hidePeriodRow ? [] : [periodRow]), ...(hideMtdRow ? [] : [mtdRow])];

  if (bodyRows.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-lg border border-dash-border bg-dash-card">
      <table className="w-full min-w-[640px] border-collapse text-left text-[13px]">
        <thead>
          <tr className="border-b border-dash-border">
            {headerRow.map((h, i) => (
              <th key={i} className="whitespace-nowrap px-4 py-3 font-semibold uppercase tracking-wide text-dash-accent">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bodyRows.map((row, ri) => (
            <tr key={ri} className={ri < bodyRows.length - 1 ? "border-b border-dash-border" : ""}>
              {row.map((cell, ci) => (
                <td key={ci} className={"whitespace-nowrap px-4 py-3 " + (ci === 0 ? "font-semibold text-dash-ink" : "text-dash-ink-secondary")}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ShareReportView({ data }: { data: ShareReportData }) {
  const generatedDate = new Date(data.generatedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div id="share-report-page" className="min-h-screen bg-navy">
      <header className="border-b border-navy-border px-4 py-4 sm:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="NextReport logo" width={28} height={28} className="block" />
            <span className="text-[16px] font-bold text-white">NextReport</span>
          </div>
          <span className="text-[12px] text-dash-ink-secondary">Powered by NextReport</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
        {/* Cover */}
        <section className="mb-8">
          <h1 className="text-[26px] font-bold text-white sm:text-[30px]">{data.accountName}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-dash-accent px-3 py-1 text-[12px] font-bold uppercase tracking-wide text-dash-sidebar">
              {reportTypeLabel(data).toUpperCase()}
            </span>
            <span className="rounded-full border border-dash-border px-3 py-1 text-[12px] text-dash-ink-secondary">{data.cover.dateRange}</span>
          </div>
          <p className="mt-3 text-[14px] font-medium text-dash-ink">{data.cover.healthBadge}</p>
          {data.cover.budgetSummary && <p className="mt-1 text-[13px] text-dash-ink-secondary">{data.cover.budgetSummary}</p>}
          {data.isPaused && data.pausedMessage && (
            <p className="mt-3 rounded-md border border-dash-border bg-dash-card px-4 py-3 text-[13px] text-dash-ink-secondary">{data.pausedMessage}</p>
          )}
        </section>

        {/* Campaign cards */}
        {data.campaigns.length > 0 && (
          <section className="mb-8 space-y-4">
            {data.campaigns.map((c) => (
              <CampaignCard key={c.campaignName} campaign={c} />
            ))}
          </section>
        )}

        {/* Combined Total table */}
        <section className="mb-8">
          <h2 className="mb-3 text-[18px] font-bold text-white">Monthly Campaign Performance Overview</h2>
          <CombinedTotalTable data={data} />
        </section>
      </main>

      <footer className="border-t border-navy-border px-4 py-6 sm:px-8">
        <div className="mx-auto max-w-5xl text-[12px] text-dash-ink-secondary">
          <p>This report was generated by NextReport · nextreport.in</p>
          <p className="mt-1">
            Generated on {generatedDate} · Data period: {data.fileDateRange}
          </p>
        </div>
      </footer>
    </div>
  );
}
