import { buildCombinedTotalTableGrid } from "@/lib/nre/report-data";
import { buildGoogleCombinedTotalTableGrid } from "@/lib/nre/google-report-data";
import type { ShareReportData, ShareCampaignData, ShareAdSetData, ShareChartData } from "@/lib/nre/share-report";
import type { DeliveryStatusIndicator } from "@/lib/nre/delivery-status";
import type { DynamicMetricValue } from "@/lib/nre/dynamic-metrics";

/**
 * The public share page's full presentational tree (app/r/[token]/page.tsx)
 * — a faithful, all-CSS HTML replica of every slide in the generated PPTX
 * (Round J), built from Report.summaryJson alone (lib/nre/share-report.ts)
 * with no further data fetching. Pulled into its own module so it can be
 * rendered from a fixture — no DB, no Next.js request context — for the
 * empirical visual check this session's "run tsc/eslint/vitest/build, then
 * look at the real thing" pattern otherwise couldn't reach for a page whose
 * only real caller needs a live Postgres connection.
 */

export function reportTypeLabel(data: ShareReportData): string {
  return data.reportType === "MONTHLY" ? "Monthly Performance Report" : "Weekly Performance Report";
}

function StatusBadge({ status }: { status: DeliveryStatusIndicator }) {
  if (!status) return null;
  return (
    <span className="shrink-0 rounded-full border border-accent-orange/40 bg-accent-orange/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent-orange">
      {status}
    </span>
  );
}

function MetricGrid({ metrics }: { metrics: DynamicMetricValue[] }) {
  if (metrics.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {metrics.map((m, i) => (
        <div key={`${m.key}-${i}`} className="rounded-lg border border-navy-border bg-navy-panel px-4 py-4">
          <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-accent-orange">{m.label}</p>
          <p className="mt-1 truncate text-[24px] font-bold text-ink">{m.value}</p>
        </div>
      ))}
    </div>
  );
}

function DateAndFrequency({ dateRange, adFrequency }: { dateRange: string; adFrequency: string }) {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-muted">
      <span>{dateRange}</span>
      {adFrequency && <span>{adFrequency}</span>}
    </div>
  );
}

function AiCopyBlock({ heading, text }: { heading: string; text: string }) {
  if (!text) return null;
  return (
    <div className="mt-4">
      <h4 className="text-[11px] font-bold uppercase tracking-wide text-accent-orange">{heading}</h4>
      <p className="mt-1.5 text-[14px] leading-[1.6] text-ink">{text}</p>
    </div>
  );
}

function SlideCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-navy-border bg-navy p-6 shadow-[0_4px_20px_rgba(0,0,0,0.25)] sm:p-8">
      {children}
    </div>
  );
}

function CampaignCard({ campaign }: { campaign: ShareCampaignData }) {
  return (
    <SlideCard>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="line-clamp-2 text-[20px] font-bold text-ink">{campaign.campaignName}</h3>
        <StatusBadge status={campaign.statusIndicator} />
      </div>
      <DateAndFrequency dateRange={campaign.dateRange} adFrequency={campaign.adFrequency} />

      <div className="mt-5">
        <MetricGrid metrics={campaign.metrics} />
      </div>

      <AiCopyBlock heading="Campaign Summary" text={campaign.aiSummary} />
      <AiCopyBlock heading="Key Insights & Updates" text={campaign.aiInsights} />
    </SlideCard>
  );
}

function AdSetCard({ adSet }: { adSet: ShareAdSetData }) {
  return (
    <SlideCard>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="line-clamp-2 text-[20px] font-bold text-ink">{adSet.campaignName}</h3>
          <p className="mt-0.5 text-[14px] text-ink-muted">{adSet.adSetName}</p>
        </div>
        <StatusBadge status={adSet.statusIndicator} />
      </div>
      <DateAndFrequency dateRange={adSet.dateRange} adFrequency={adSet.adFrequency} />

      <div className="mt-5">
        <MetricGrid metrics={adSet.metrics} />
      </div>

      <AiCopyBlock heading="Campaign Summary" text={adSet.aiSummary} />
      <AiCopyBlock heading="Key Insights & Updates" text={adSet.aiInsights} />
    </SlideCard>
  );
}

/** Horizontal-bar replica of the PPT's donut chart slide — a bar reads far better than a circle in a narrow mobile column, so this is deliberately a different chart FORM from the deck while showing exactly the same numbers/colors. */
function ChartSlide({ chart }: { chart: ShareChartData }) {
  return (
    <SlideCard>
      <h2 className="text-center text-[24px] font-bold text-ink">{chart.title}</h2>

      <div className="mx-auto mt-6 max-w-2xl space-y-5">
        {chart.campaigns.map((c, i) => (
          <div key={`${c.name}-${i}`}>
            <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <span className="line-clamp-1 text-[13px] font-medium text-ink">{c.name}</span>
              {c.statusIndicator && (
                <span className="text-[11px] font-semibold uppercase tracking-wide text-accent-orange">{c.statusIndicator}</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-navy-panel">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.max(c.percentage, 2)}%`, backgroundColor: `#${c.color}` }}
                />
              </div>
              <span className="w-[110px] shrink-0 text-right text-[12px] text-ink-muted">
                {c.spendLabel} · {c.percentage.toFixed(1)}%
              </span>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-6 text-center text-[13px] text-ink-muted">{chart.totalSpendLine}</p>
    </SlideCard>
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

  const bodyRows: { cells: string[]; isPeriod: boolean }[] = [
    ...(hidePeriodRow ? [] : [{ cells: periodRow, isPeriod: true }]),
    ...(hideMtdRow ? [] : [{ cells: mtdRow, isPeriod: false }]),
  ];

  if (bodyRows.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-lg border border-navy-border">
      <table className="w-full min-w-[640px] border-collapse text-left text-[13px]">
        <thead>
          <tr className="bg-navy-border">
            {headerRow.map((h, i) => (
              <th key={i} className="whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-ink">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bodyRows.map((row, ri) => (
            <tr key={ri} className={row.isPeriod ? "bg-navy-panel" : "bg-navy"}>
              {row.cells.map((cell, ci) => (
                <td
                  key={ci}
                  className={
                    "whitespace-nowrap px-4 py-3 text-[13px] text-ink " +
                    (ci === 0 ? "text-left font-semibold" : "text-center")
                  }
                >
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

function MetricGuideSection({ metricGuide }: { metricGuide: ShareReportData["metricGuide"] }) {
  if (metricGuide.length === 0) return null;
  return (
    <SlideCard>
      <h2 className="text-[22px] font-bold text-ink">Metric Abbreviation Guide</h2>
      <div className="mt-5 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
        {metricGuide.map((entry, i) => (
          <div key={`${entry.term}-${i}`}>
            <p className="text-[12px] font-bold uppercase tracking-wide text-accent-orange">{entry.term}</p>
            <p className="mt-1 text-[11px] leading-[1.5] text-ink-muted">{entry.explanation}</p>
          </div>
        ))}
      </div>
    </SlideCard>
  );
}

export function ShareReportView({ data, shareToken }: { data: ShareReportData; shareToken?: string }) {
  const generatedDate = new Date(data.generatedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  // A summaryJson blob written before Round J (ad sets/chart/metricGuide/
  // agencyName) still validates as version 1 — those fields are additive,
  // not a breaking change — but are simply absent on the parsed object at
  // runtime despite TypeScript believing them required. Defaulting here
  // (rather than widening the type to optional everywhere) keeps every
  // component below able to assume the full shape it's typed for.
  const adSets = data.adSets ?? [];
  const chart = data.chart ?? null;
  const metricGuide = data.metricGuide ?? [];

  return (
    <div id="share-report-page" className="min-h-screen bg-navy" style={{ fontFamily: "var(--font-inter), sans-serif" }}>
      <header className="sticky top-0 z-10 border-b border-navy-border bg-navy/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-[960px] items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="NextReport logo" width={24} height={24} className="block" />
            <span className="text-[15px] font-bold text-ink">NextReport</span>
          </div>
          <div className="flex items-center gap-3">
            {shareToken ? (
              <a
                href={`/api/r/${shareToken}/download`}
                className="rounded-md bg-accent-orange px-3.5 py-1.5 text-[12px] font-semibold text-navy hover:bg-accent-orange-hover"
              >
                Download PPTX
              </a>
            ) : null}
            <span className="hidden text-[12px] text-ink-muted sm:inline">Powered by NextReport</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[960px] px-4 py-6 sm:px-6">
        {/* Cover slide replica */}
        <section className="mb-6">
          <div className="mx-auto aspect-video w-full max-w-2xl rounded-lg border border-navy-border bg-navy-panel px-6 py-8 shadow-[0_4px_20px_rgba(0,0,0,0.25)] sm:px-10 sm:py-10">
            <div className="flex h-full flex-col items-center justify-center text-center">
              <p className="text-[12px] uppercase tracking-widest text-ink-muted">{data.platform === "GOOGLE" ? "Google Ads" : "Meta Ads"}</p>
              <h1 className="mt-4 line-clamp-2 text-[32px] font-bold text-ink">{data.accountName}</h1>
              <p className="mt-2 text-[16px] tracking-wide text-ink-muted">{reportTypeLabel(data).toUpperCase()}</p>
              <p className="mt-2 text-[14px] text-ink-muted">{data.cover.dateRange}</p>
              <div className="my-5 h-px w-24 bg-navy-border" />
              <p className="text-[14px] font-medium text-ink">{data.cover.healthBadge}</p>
              {data.cover.budgetSummary && <p className="mt-2 text-[13px] text-ink-muted">{data.cover.budgetSummary}</p>}
            </div>
          </div>
          {data.isPaused && data.pausedMessage && (
            <p className="mx-auto mt-4 max-w-2xl rounded-md border border-navy-border bg-navy-panel px-4 py-3 text-center text-[13px] text-ink-muted">
              {data.pausedMessage}
            </p>
          )}
        </section>

        {/* Campaign slide replicas */}
        {data.campaigns.map((c) => (
          <section key={`campaign-${c.campaignName}`} className="mb-6">
            <CampaignCard campaign={c} />
          </section>
        ))}

        {/* Ad set slide replicas */}
        {adSets.map((a, i) => (
          <section key={`adset-${a.campaignName}-${a.adSetName}-${i}`} className="mb-6">
            <AdSetCard adSet={a} />
          </section>
        ))}

        {/* MTD/Weekly chart slide replica */}
        {chart && chart.campaigns.length > 0 && (
          <section className="mb-6">
            <ChartSlide chart={chart} />
          </section>
        )}

        {/* Combined Total table */}
        <section className="mb-6">
          <SlideCard>
            <h2 className="mb-4 text-[22px] font-bold text-ink">Monthly Campaign Performance Overview</h2>
            <CombinedTotalTable data={data} />
          </SlideCard>
        </section>

        {/* Metric Guide */}
        <section className="mb-6">
          <MetricGuideSection metricGuide={metricGuide} />
        </section>
      </main>

      <footer className="border-t border-navy-border px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-[960px] text-center text-[12px] text-ink-muted">
          <p>
            This report was generated by {data.agencyName ? data.agencyName : "NextReport"} using NextReport
          </p>
          <p className="mt-1">
            Generated on {generatedDate} · nextreport.in
          </p>
        </div>
      </footer>
    </div>
  );
}
