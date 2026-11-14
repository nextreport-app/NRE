"use client";
import { formatClientTimestamp } from "@/lib/client-date-format";

import { comparisonTone, comparisonPercent } from "@/lib/nre/comparison-presentation";
import type { ComparisonChange, ComparisonCampaignData, ComparisonMetricSet } from "@/lib/nre/report-data";
import type { ShareComparisonReportData } from "@/lib/nre/share-comparison-report";
import { sharePlatformBadge } from "@/lib/nre/platform-reporting";
import {
  preparedByCoverLine,
  reportBrandingFromShareJson,
  resolveShareBrandingDisplay,
} from "@/lib/report-branding";
import { ShareReportBrandingHeader } from "@/components/share-report-branding-header";

function changeBadgeLabel(change: ComparisonChange): string {
  if (change.percent === null && change.direction !== "new") return "N/A";
  if (change.direction === "new") return "NEW";
  const arrow = change.direction === "up" ? "↑" : change.direction === "down" ? "↓" : "→";
  return `${comparisonPercent(change.percent)} ${arrow}`;
}

function trendClass(key: string, label: string, percent: number | null): string {
  const tone = comparisonTone(key, label, percent);
  return tone === "positive" ? "bg-emerald-500/20 text-emerald-300" : tone === "negative" ? "bg-red-500/20 text-red-300" : "bg-slate-500/20 text-slate-300";
}

function changeBadgeClass(change: ComparisonChange, key: string, label: string): string {
  return change.direction === "new" ? "bg-amber-500/20 text-amber-300" : trendClass(key, label, change.percent);
}

function MetricComparisonRow({
  label,
  metricsA,
  metricsB,
  change,
  valueKey,
}: {
  label: string;
  metricsA: ComparisonMetricSet;
  metricsB: ComparisonMetricSet;
  change: ComparisonChange;
  valueKey: keyof ComparisonMetricSet;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
      <div className="rounded-lg border border-navy-border bg-navy-panel px-3 py-3 sm:px-4 sm:py-4">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted sm:text-[11px]">{label}</p>
        <p className="mt-1 text-lg font-bold text-ink sm:text-xl">{metricsA[valueKey].formatted}</p>
      </div>
      <span
        className={`inline-flex min-w-[72px] justify-center rounded-full px-2 py-1 text-[11px] font-semibold sm:min-w-[84px] sm:text-xs ${changeBadgeClass(change, valueKey, label)}`}
      >
        {changeBadgeLabel(change)}
      </span>
      <div className="rounded-lg border border-navy-border bg-navy-panel px-3 py-3 sm:px-4 sm:py-4">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted sm:text-[11px]">{label}</p>
        <p className="mt-1 text-lg font-bold text-ink sm:text-xl">{metricsB[valueKey].formatted}</p>
      </div>
    </div>
  );
}

function CampaignComparisonSection({
  campaign,
  periodALabel,
  periodBLabel,
  periodATitle = "Period A",
  periodBTitle = "Period B",
}: {
  campaign: ComparisonCampaignData;
  periodALabel: string;
  periodBLabel: string;
  periodATitle?: string;
  periodBTitle?: string;
}) {
  return (
    <section className="mb-8 break-inside-avoid rounded-xl border border-navy-border bg-navy-panel p-4 sm:p-6">
      <h2 className="text-lg font-bold text-ink sm:text-xl">{campaign.campaignName}</h2>
      <p className="mt-1 text-sm text-ink-muted">{campaign.objective}</p>
      <div className="mt-4 grid grid-cols-2 gap-2 text-center text-[11px] font-semibold uppercase tracking-wide text-ink-muted sm:text-xs">
        <div>
          <p>{periodATitle}</p>
          <p className="mt-0.5 font-normal normal-case text-ink-secondary">{periodALabel}</p>
        </div>
        <div>
          <p>{periodBTitle}</p>
          <p className="mt-0.5 font-normal normal-case text-ink-secondary">{periodBLabel}</p>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        <MetricComparisonRow label="Ad Spend" metricsA={campaign.metricsA} metricsB={campaign.metricsB} change={campaign.changes.spend} valueKey="spend" />
        <MetricComparisonRow label="Reach" metricsA={campaign.metricsA} metricsB={campaign.metricsB} change={campaign.changes.reach} valueKey="reach" />
        <MetricComparisonRow label={campaign.objective} metricsA={campaign.metricsA} metricsB={campaign.metricsB} change={campaign.changes.results} valueKey="results" />
        <MetricComparisonRow label={campaign.costLabel} metricsA={campaign.metricsA} metricsB={campaign.metricsB} change={campaign.changes.cpr} valueKey="cpr" />
      </div>
      {!!campaign.additionalMetrics?.length && <div className="mt-6 overflow-x-auto"><h3 className="mb-3 text-sm font-semibold text-ink">Additional comparison metrics</h3><table className="w-full text-left text-sm text-ink"><thead className="text-xs text-ink-muted"><tr><th className="p-2">Metric</th><th className="p-2">{periodATitle}</th><th className="p-2">{periodBTitle}</th><th className="p-2">Change</th></tr></thead><tbody>{campaign.additionalMetrics.map(metric => <tr key={metric.key} className="border-t border-navy-border"><td className="p-2">{metric.label}</td><td className="p-2">{metric.formattedA}</td><td className="p-2">{metric.formattedB}</td><td className="p-2"><span className={`rounded px-2 py-1 ${trendClass(metric.key, metric.label, metric.percent)}`}>{comparisonPercent(metric.percent)}</span></td></tr>)}</tbody></table></div>}
    </section>
  );
}

export function ShareComparisonReportView({
  data,
  clientCurrency, clientTimezone,
  shareToken,
  isPrint = false,
}: {
  data: ShareComparisonReportData;
  clientCurrency?: string;
  clientTimezone?: string;
  shareToken?: string;
  isPrint?: boolean;
}) {
  const mixedObjectives = new Set(data.campaigns.map(campaign => campaign.objective.trim().toUpperCase())).size > 1;
  const multipleCampaigns = data.campaigns.length > 1;
  const overlappingReach = multipleCampaigns && data.campaigns.some(campaign => ["REACH", "UNIQUE REACH"].includes(campaign.objective));
  const comparableResults = !mixedObjectives && !overlappingReach;
  const comparableCost = comparableResults && !(multipleCampaigns && /(?:1k|1,?000|thousand)/i.test(data.campaigns[0]?.costLabel ?? ""));
  const account = data.campaigns.length === 1 ? data.campaigns[0] : data.totals;
  const branding = reportBrandingFromShareJson(data);
  const brandingDisplay = resolveShareBrandingDisplay(branding);
  const coverPreparedByLine = preparedByCoverLine(branding);
  const generatedDate = clientCurrency ? formatClientTimestamp(data.generatedAt, clientCurrency, clientTimezone, false) : new Date(data.generatedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div
      id={isPrint ? "share-report-print" : "share-report-page"}
      className={isPrint ? "bg-navy" : "nre-client-report min-h-screen"}
      style={{
        fontFamily: "var(--font-inter), sans-serif",
        backgroundColor: isPrint ? "#0d1b2e" : undefined,
        backgroundImage: isPrint ? "radial-gradient(circle, #1e3a5f 1px, transparent 1px)" : undefined,
        backgroundSize: "32px 32px",
      }}
    >
      {!isPrint ? (
        <ShareReportBrandingHeader
          brandingDisplay={brandingDisplay}
          branding={branding}
          shareToken={shareToken}
          rightSlot={
            shareToken ? (
              <a
                href={`/api/r/${shareToken}/download`}
                aria-label="Download PowerPoint report"
                className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[#f5b45a] bg-[#f5b45a] px-3 py-2 text-[12px] font-semibold leading-none text-[#0b1728] transition-colors hover:bg-[#e9a447] sm:px-4 sm:py-2.5 sm:text-[14px]"
              >
                <span className="hidden min-[400px]:inline">Download</span><span>PPTX</span>
              </a>
            ) : null
          }
        />
      ) : null}

      <main className={isPrint ? "mx-auto max-w-[960px] px-6 py-4" : "mx-auto max-w-[960px] px-3 py-4 sm:px-6 sm:py-6"}>
        <section className="mb-8 break-inside-avoid rounded-xl border border-navy-border bg-navy-panel px-4 py-6 text-center sm:px-8 sm:py-9">
          <div
            className="mx-auto inline-flex items-center gap-2 rounded-full"
            style={{ backgroundColor: "#292d37", border: "1px solid #383e4c", padding: "3px 10px" }}
          >
            <span className="text-[11px] font-semibold uppercase text-[#94a3b8] sm:text-[13px]" style={{ letterSpacing: "0.08em" }}>
              {sharePlatformBadge(data.platform).label} · COMPARISON
            </span>
          </div>
          <h1 className="mt-3 text-[22px] font-bold text-ink sm:text-[30px] md:text-[34px]">{data.accountName}</h1>
          <p className="mt-2 text-[13px] text-ink-muted sm:text-[15px]">COMPARISON PERFORMANCE REPORT</p>
          {data.comparisonLabel && <p className="mt-3 text-base font-semibold text-ink">{data.comparisonLabel}</p>}
          <p className="mt-3 text-sm text-ink-secondary">
            {data.periodALabel}
            <span className="mx-2 text-ink-muted">vs</span>
            {data.periodBLabel}
          </p>
          {coverPreparedByLine ? <p className="mt-4 text-sm text-ink-muted">{coverPreparedByLine}</p> : null}
        </section>

        {data.isPaused ? (
          <section className="mb-8 rounded-xl border border-navy-border bg-navy-panel p-6 text-center text-ink-muted">
            No spend recorded in either period for the selected campaigns.
          </section>
        ) : (
          <>
            {data.campaigns.filter(campaign => campaign.metricsA.spend.value > 0).map((campaign) => (
              <CampaignComparisonSection
                key={campaign.campaignName}
                campaign={campaign}
                periodATitle={data.periodATitle}
                periodBTitle={data.periodBTitle}
                periodALabel={data.periodALabel}
                periodBLabel={data.periodBLabel}
              />
            ))}

            <section className="mb-8 break-inside-avoid rounded-xl border border-navy-border bg-navy-panel p-4 sm:p-6">
              <h2 className="text-lg font-bold text-ink sm:text-xl">Account totals</h2>
              <div className="mt-4 space-y-3">
                <MetricComparisonRow label="Ad Spend" metricsA={account.metricsA} metricsB={account.metricsB} change={account.changes.spend} valueKey="spend" />
                {!multipleCampaigns && <MetricComparisonRow label="Reach" metricsA={account.metricsA} metricsB={account.metricsB} change={account.changes.reach} valueKey="reach" />}
                {comparableResults && <MetricComparisonRow label="Results" metricsA={account.metricsA} metricsB={account.metricsB} change={account.changes.results} valueKey="results" />}
                {comparableCost && <MetricComparisonRow label="Cost per result" metricsA={account.metricsA} metricsB={account.metricsB} change={account.changes.cpr} valueKey="cpr" />}
                {!comparableResults && <p className="text-sm text-ink-muted">Results and cost per result are shown per campaign because objectives differ or campaign reach can overlap.</p>}
                {multipleCampaigns && <p className="text-sm text-ink-muted">Reach is shown per campaign because audiences can overlap.</p>}
              </div>
            </section>
          </>
        )}
      </main>

      {!isPrint && (brandingDisplay.footerPrimary || brandingDisplay.showGeneratedDate) ? (
        <footer style={{ textAlign: "center", padding: "32px 24px", borderTop: "1px solid #1e3a5f", marginTop: "40px" }}>
          {brandingDisplay.footerPrimary ? (
            <div style={{ color: "#94a3b8", fontSize: "13px" }}>{brandingDisplay.footerPrimary}</div>
          ) : null}
          {brandingDisplay.showGeneratedDate ? (
            <div style={{ color: "#64748b", fontSize: "12px", marginTop: brandingDisplay.footerPrimary ? "4px" : 0 }}>
              Generated on {generatedDate}
            </div>
          ) : null}
        </footer>
      ) : null}
    </div>
  );
}

export function comparisonReportTypeLabel(): string {
  return "Comparison Report";
}
