"use client";

import type { ComparisonChange, ComparisonCampaignData, ComparisonMetricSet } from "@/lib/nre/report-data";
import type { ShareComparisonReportData } from "@/lib/nre/share-comparison-report";
import { sharePlatformBadge } from "@/lib/nre/platform-reporting";
import { reportBrandingFromShareJson, resolveShareBrandingDisplay } from "@/lib/report-branding";
import { ShareReportBrandingHeader } from "@/components/share-report-branding-header";

function changeBadgeLabel(change: ComparisonChange): string {
  if (change.direction === "new") return "NEW";
  const arrow = change.direction === "up" ? "↑" : change.direction === "down" ? "↓" : "→";
  const pct = change.percent ?? 0;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${Math.round(pct)}% ${arrow}`;
}

function changeBadgeClass(change: ComparisonChange): string {
  switch (change.direction) {
    case "up":
      return "bg-emerald-500/20 text-emerald-300";
    case "down":
      return "bg-red-500/20 text-red-300";
    case "new":
      return "bg-amber-500/20 text-amber-300";
    default:
      return "bg-slate-500/20 text-slate-300";
  }
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
        className={`inline-flex min-w-[72px] justify-center rounded-full px-2 py-1 text-[11px] font-semibold sm:min-w-[84px] sm:text-xs ${changeBadgeClass(change)}`}
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
}: {
  campaign: ComparisonCampaignData;
  periodALabel: string;
  periodBLabel: string;
}) {
  return (
    <section className="mb-8 break-inside-avoid rounded-xl border border-navy-border bg-navy-panel p-4 sm:p-6">
      <h2 className="text-lg font-bold text-ink sm:text-xl">{campaign.campaignName}</h2>
      <p className="mt-1 text-sm text-ink-muted">{campaign.objective}</p>
      <div className="mt-4 grid grid-cols-2 gap-2 text-center text-[11px] font-semibold uppercase tracking-wide text-ink-muted sm:text-xs">
        <div>
          <p>Period A</p>
          <p className="mt-0.5 font-normal normal-case text-ink-secondary">{periodALabel}</p>
        </div>
        <div>
          <p>Period B</p>
          <p className="mt-0.5 font-normal normal-case text-ink-secondary">{periodBLabel}</p>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        <MetricComparisonRow label="Ad Spend" metricsA={campaign.metricsA} metricsB={campaign.metricsB} change={campaign.changes.spend} valueKey="spend" />
        <MetricComparisonRow label="Reach" metricsA={campaign.metricsA} metricsB={campaign.metricsB} change={campaign.changes.reach} valueKey="reach" />
        <MetricComparisonRow label={campaign.objective} metricsA={campaign.metricsA} metricsB={campaign.metricsB} change={campaign.changes.results} valueKey="results" />
        <MetricComparisonRow label={campaign.costLabel} metricsA={campaign.metricsA} metricsB={campaign.metricsB} change={campaign.changes.cpr} valueKey="cpr" />
      </div>
    </section>
  );
}

export function ShareComparisonReportView({
  data,
  shareToken,
  isPrint = false,
}: {
  data: ShareComparisonReportData;
  shareToken?: string;
  isPrint?: boolean;
}) {
  const branding = reportBrandingFromShareJson(data);
  const brandingDisplay = resolveShareBrandingDisplay(branding);
  const generatedDate = new Date(data.generatedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div
      id={isPrint ? "share-report-print" : "share-report-page"}
      className={isPrint ? "bg-navy" : "min-h-screen"}
      style={{
        fontFamily: "var(--font-inter), sans-serif",
        backgroundColor: "#0d1b2e",
        backgroundImage: "radial-gradient(circle, #1e3a5f 1px, transparent 1px)",
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
                className="inline-flex items-center justify-center rounded-md border border-accent-orange px-2.5 py-1.5 text-[12px] font-semibold leading-none text-white hover:bg-accent-orange/10 sm:px-3.5 sm:py-2 sm:text-[14px]"
                style={{ backgroundColor: "#1e293b" }}
              >
                <span className="hidden min-[400px]:inline">Download </span>PPTX
              </a>
            ) : null
          }
        />
      ) : null}

      <main className={isPrint ? "mx-auto max-w-[960px] px-6 py-4" : "mx-auto max-w-[960px] px-3 py-4 sm:px-6 sm:py-6"}>
        <section className="mb-8 break-inside-avoid rounded-xl border border-navy-border bg-navy-panel px-4 py-6 text-center sm:px-8 sm:py-9">
          <div
            className="mx-auto inline-flex items-center gap-2 rounded-full"
            style={{ backgroundColor: "#1e293b", border: "1px solid #334155", padding: "3px 10px" }}
          >
            <span className="text-[11px] font-semibold uppercase text-[#94a3b8] sm:text-[13px]" style={{ letterSpacing: "0.08em" }}>
              {sharePlatformBadge(data.platform).label} · COMPARISON
            </span>
          </div>
          <h1 className="mt-3 text-[22px] font-bold text-ink sm:text-[30px] md:text-[34px]">{data.accountName}</h1>
          <p className="mt-2 text-[13px] text-ink-muted sm:text-[15px]">COMPARISON PERFORMANCE REPORT</p>
          <p className="mt-3 text-sm text-ink-secondary">
            {data.periodALabel}
            <span className="mx-2 text-ink-muted">vs</span>
            {data.periodBLabel}
          </p>
          {data.agencyName ? <p className="mt-4 text-sm text-ink-muted">Prepared by {data.agencyName}</p> : null}
        </section>

        {data.isPaused ? (
          <section className="mb-8 rounded-xl border border-navy-border bg-navy-panel p-6 text-center text-ink-muted">
            No spend recorded in either period for the selected campaigns.
          </section>
        ) : (
          <>
            {data.campaigns.map((campaign) => (
              <CampaignComparisonSection
                key={campaign.campaignName}
                campaign={campaign}
                periodALabel={data.periodALabel}
                periodBLabel={data.periodBLabel}
              />
            ))}

            <section className="mb-8 break-inside-avoid rounded-xl border border-navy-border bg-navy-panel p-4 sm:p-6">
              <h2 className="text-lg font-bold text-ink sm:text-xl">Account totals</h2>
              <div className="mt-4 space-y-3">
                <MetricComparisonRow label="Ad Spend" metricsA={data.totals.metricsA} metricsB={data.totals.metricsB} change={data.totals.changes.spend} valueKey="spend" />
                <MetricComparisonRow label="Reach" metricsA={data.totals.metricsA} metricsB={data.totals.metricsB} change={data.totals.changes.reach} valueKey="reach" />
                <MetricComparisonRow label="Results" metricsA={data.totals.metricsA} metricsB={data.totals.metricsB} change={data.totals.changes.results} valueKey="results" />
                <MetricComparisonRow label="Cost per result" metricsA={data.totals.metricsA} metricsB={data.totals.metricsB} change={data.totals.changes.cpr} valueKey="cpr" />
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
