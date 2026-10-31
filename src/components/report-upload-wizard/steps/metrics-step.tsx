"use client";

import { paginateExtraMetrics } from "@/lib/nre/metric-pagination";
import { useMemo, useState } from "react";
import { useWizardContext } from "../wizard-context";
import { normalizeCampaignName } from "@/lib/nre/objective";
import { WizardStickyFooter } from "../ui/wizard-sticky-footer";
import { WizardStepHelp } from "../ui/wizard-step-help";
import { useWizardCopy } from "@/hooks/use-wizard-copy";
import { wizardStepLabel } from "@/lib/wizard-i18n";
import { useSiteTheme } from "@/components/site-theme-provider";

export function WizardMetricsStep() {
  const w = useWizardContext();
  const copy = useWizardCopy();
  const { locale } = useSiteTheme();
  const stepActive = w.step === 3;

  const activeCampaigns = useMemo(() => {
    if (!stepActive) return [];
    return w.campaigns.filter((name) => w.selectedCampaigns.has(name));
  }, [stepActive, w.campaigns, w.selectedCampaigns]);

  const [showAllCampaignMetrics, setShowAllCampaignMetrics] = useState(false);

  if (!stepActive) return null;

  const {
    ADD_FROM_CSV_VISIBLE,
    MAX_METRICS_PER_SLIDE,
    MAX_TOTAL_METRICS,
    MIN_SELECTED_METRICS,
    addCampaignMetric,
    campaignAvailableMetrics,
    campaignObjectives,
    expandedCsvExtras,
    handleMetricsContinue,
    metricsStatus,
    objectiveAccent,
    perCampaignMetrics,
    perCampaignMinWarning,
    removeCampaignMetric,
    setExpandedCsvExtras,
    setStep,
  } = w;

  const defaultPreviewCount = 1;
  const hasSelectionWarning = !!perCampaignMinWarning || activeCampaigns.some(name => { const metrics = perCampaignMetrics.get(normalizeCampaignName(name)) ?? []; return metrics.length < MIN_SELECTED_METRICS; });

  const visibleCampaigns =
    activeCampaigns.length <= 1 || showAllCampaignMetrics || hasSelectionWarning
      ? activeCampaigns
      : activeCampaigns.slice(0, defaultPreviewCount);

  const hiddenCampaignCount = activeCampaigns.length - visibleCampaigns.length;

  const totalMetricChips = activeCampaigns.reduce(
    (sum, name) => sum + (perCampaignMetrics.get(normalizeCampaignName(name))?.length ?? 0),
    0,
  );

  function renderCampaignMetrics(name: string) {
    const normalized = normalizeCampaignName(name);
    const objective = campaignObjectives.get(normalized);
    const selectedForCampaign = perCampaignMetrics.get(normalized) ?? [];
    const availableForCampaign = campaignAvailableMetrics(normalized);
    const accent = objectiveAccent(objective?.resultLabel);
    const pages = [selectedForCampaign.slice(0, MAX_METRICS_PER_SLIDE), ...paginateExtraMetrics(selectedForCampaign.slice(MAX_METRICS_PER_SLIDE))];

    return (
      <div
        key={name}
        className="mb-4 rounded-lg bg-dash-card nre-dash-surface p-4 last:mb-0"
        style={{ borderTop: `3px solid ${accent.borderHex}` }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="truncate text-[15px] font-bold text-dash-ink" title={name}>
            {name}
          </span>
          {objective && (
            <span
              className={`flex-shrink-0 rounded-[20px] text-[11px] font-medium uppercase ${accent.badgeClassName}`}
              style={{ padding: "4px 8px" }}
            >
              {objective.resultLabel}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[14px] text-dash-ink-secondary">
          {selectedForCampaign.length} metrics · {pages.length} {pages.length === 1 ? "slide" : "slides"}
        </p>

        <p className="mt-3 text-[14px] font-medium uppercase tracking-wide text-dash-ink-secondary">{copy.includedMetrics}</p>
        <div className="mt-2 space-y-3">
          {pages.map((metrics, index) => <div key={index} className={pages.length > 1 ? "rounded-lg border border-dash-border bg-dash-bg/30 p-3" : ""}>
            {pages.length > 1 && <p className="mb-2 text-xs font-medium text-dash-ink-secondary">{index === 0 ? "Main slide" : `Additional metrics · page ${index}`} · {metrics.length} metrics</p>}
            <div className="flex flex-wrap gap-2">{metrics.map((m) => (
            <span
              key={m.key}
              className="flex items-center gap-2 rounded-md border border-dash-border bg-dash-card nre-dash-surface"
              style={{ padding: "8px 12px" }}
            >
              <span className="text-[12px] uppercase text-dash-ink" style={{ letterSpacing: "0.5px" }}>
                {m.label}
              </span>
              <button
                type="button"
                onClick={() => removeCampaignMetric(normalized, m.key)}
                aria-label={`Remove ${m.label} from ${name}`}
                className="text-[#64748b] hover:text-[#fc8181]"
              >
                ✕
              </button>
            </span>
          ))}</div></div>)}
        </div>
        {pages.length > 1 && <p className="mt-2 text-xs text-dash-ink-secondary">Extra cards resize automatically. No empty slots or repeated metrics.</p>}

        {perCampaignMinWarning && (
          <p className="nre-wizard-confidence--warn mt-2 text-[14px]">{perCampaignMinWarning}</p>
        )}

        <details className="mt-4 border-t border-dash-border pt-3"><summary className="cursor-pointer text-[13px] font-medium text-dash-accent">Add more metrics · optional</summary><div className="mt-3">
        <p className="text-[14px] font-medium uppercase tracking-wide text-dash-ink-secondary">{copy.addFromCsv}</p>
        <p className="mt-0.5 text-[14px] text-dash-ink-secondary">{copy.addFromCsvHint}</p>
        {selectedForCampaign.length >= MAX_TOTAL_METRICS && <p className="mt-2 text-xs text-dash-ink-secondary">{MAX_TOTAL_METRICS}-metric limit reached. Remove a metric to add another.</p>}
        {availableForCampaign.length === 0 ? (
          <p className="mt-1.5 text-[14px] text-dash-ink-secondary">No extra columns in this export.</p>
        ) : (
          <>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {(expandedCsvExtras.has(normalized)
                ? availableForCampaign
                : availableForCampaign.slice(0, ADD_FROM_CSV_VISIBLE)
              ).map((candidate) => (
                <button
                  key={candidate.key}
                  type="button"
                  disabled={selectedForCampaign.length >= MAX_TOTAL_METRICS}
                  onClick={() => addCampaignMetric(normalized, candidate)}
                  className="rounded-md border border-[#1e3a5f] bg-transparent text-[14px] text-dash-ink-secondary hover:border-dash-ink-secondary hover:text-dash-ink"
                  style={{ padding: "8px 12px" }}
                >
                  <span className="text-[#68d391]">+</span> {candidate.label}
                </button>
              ))}
            </div>
            {availableForCampaign.length > ADD_FROM_CSV_VISIBLE && !expandedCsvExtras.has(normalized) && (
              <button
                type="button"
                onClick={() => setExpandedCsvExtras((prev) => new Set(prev).add(normalized))}
                className="mt-2 text-[14px] text-dash-accent hover:underline"
              >
                Show {availableForCampaign.length - ADD_FROM_CSV_VISIBLE} more
              </button>
            )}
          </>
        )}
        </div></details>
      </div>
    );
  }

  if (w.reportType === "COMPARISON" || w.reportType === "DAY_BREAKDOWN") {
    return <div className="space-y-4 rounded-xl border border-dash-border bg-dash-card p-5 pb-24 md:pb-5">
      <h3 className="text-base font-semibold text-dash-ink">{w.reportType === "COMPARISON" ? "Comparison metrics" : "Table metrics are included"}</h3>
      <p className="text-sm text-dash-ink-secondary">{w.reportType === "COMPARISON" ? "Each campaign slide shows Period A, Period B and the percentage change for the same four metrics." : "Each daily row uses the same fixed metrics so you can compare days."}{w.reportType === "DAY_BREAKDOWN" ? " Metrics are fixed for this report type." : " Add more CSV-backed metrics below; they appear on additional comparison slides."}</p>
      <p className="text-sm text-dash-ink-secondary">{w.reportType === "COMPARISON" ? "Included: ad spend, reach, results for the campaign objective and cost per result. A summary compares all selected campaigns." : "Spend, reach, impressions, CTR, CPC and objective-specific results and costs."}</p>
      {w.reportType === "COMPARISON" && <details className="rounded-lg border border-dash-border bg-dash-bg/40 p-4" open={w.comparisonMetricKeys.length > 0}>
        <summary className="cursor-pointer text-sm font-semibold text-dash-accent">Add comparison metrics · optional{w.comparisonMetricKeys.length ? ` · ${w.comparisonMetricKeys.length} selected` : ""}</summary>
        <p className="mt-3 text-xs text-dash-ink-secondary">Selected metrics are compared for each campaign. Missing values and percentage changes from a zero baseline show N/A. Existing default metrics are not repeated.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">{w.comparisonOptionalMetrics.map(metric => <label key={metric.key} className="flex cursor-pointer items-center gap-3 rounded-lg border border-dash-border p-3 text-sm text-dash-ink"><input type="checkbox" className="accent-sky-500" checked={w.comparisonMetricKeys.includes(metric.key)} onChange={() => w.toggleComparisonMetric(metric.key)} disabled={!w.comparisonMetricKeys.includes(metric.key) && w.comparisonMetricKeys.length >= MAX_TOTAL_METRICS} />{metric.label}</label>)}</div>
        {!w.comparisonOptionalMetrics.length && <p className="mt-3 text-sm text-dash-ink-secondary">No additional supported metric columns were detected in this CSV.</p>}
      </details>}
      <div className="hidden gap-3 md:flex"><button type="button" onClick={() => setStep(2)} className="rounded-md border border-dash-border px-4 py-2 text-sm text-dash-ink">{copy.back}</button><button type="button" onClick={handleMetricsContinue} className="rounded-md bg-dash-accent px-6 py-2 text-sm font-semibold text-[#0b1728]">{copy.continueToGenerate}</button></div>
      <WizardStickyFooter stepLabel={copy.stepOf(3, 4, wizardStepLabel(3, locale))} onBack={() => setStep(2)} backLabel={copy.back} primaryLabel={copy.continueToGenerate} onPrimary={handleMetricsContinue} />
    </div>;
  }

  return (
    <div className="space-y-4 rounded-xl border border-dash-border bg-dash-card p-5 shadow-sm pb-24 md:pb-5">
      {metricsStatus === "error" && (
        <div className="rounded-md border border-amber-900 bg-amber-950/30 p-3 text-[14px] text-amber-200">
          Couldn&apos;t load the full metric list — continuing with the engine&apos;s automatic selection.
        </div>
      )}

      <p className="text-[13px] leading-relaxed text-dash-ink-secondary">Metrics are selected from your CSV. Review the first campaign below, or expand the list to customize others.</p>
      {activeCampaigns.length > 1 ? (
        <p className="text-[14px] text-dash-ink-secondary">
          {activeCampaigns.length} campaigns · {totalMetricChips} metric{totalMetricChips === 1 ? "" : "s"} selected from
          your CSV
        </p>
      ) : null}

      {perCampaignMinWarning && activeCampaigns.length === 1 ? (
        <p className="text-[14px] text-amber-300">{perCampaignMinWarning}</p>
      ) : null}

      <div>{visibleCampaigns.map((name) => renderCampaignMetrics(name))}</div>

      {hiddenCampaignCount > 0 ? (
        <button
          type="button"
          onClick={() => setShowAllCampaignMetrics(true)}
          className="text-[14px] font-medium text-dash-accent hover:underline"
        >
          Show metrics for {hiddenCampaignCount} more campaign{hiddenCampaignCount === 1 ? "" : "s"}
        </button>
      ) : null}

      {showAllCampaignMetrics && activeCampaigns.length > 1 ? (
        <button
          type="button"
          onClick={() => setShowAllCampaignMetrics(false)}
          className="text-[14px] text-dash-ink-secondary hover:underline"
        >
          Show fewer campaigns
        </button>
      ) : null}

      <div className="hidden gap-3 md:flex">
        <button
          onClick={() => setStep(2)}
          className="rounded-md border border-dash-border px-4 py-2 text-[14px] font-medium text-dash-ink hover:bg-dash-border"
        >
          {copy.back}
        </button>
        <button
          onClick={handleMetricsContinue}
          disabled={[...perCampaignMetrics.values()].some(
            (metrics) => metrics.length > 0 && metrics.length < MIN_SELECTED_METRICS,
          )}
          className="rounded-md bg-dash-accent px-6 py-2 text-[14px] font-semibold text-dash-ink hover:bg-dash-accent-hover disabled:opacity-50"
        >
          {copy.continueToGenerate}
        </button>
      </div>

      <WizardStepHelp step={3} platform={w.platform} clientTimezone={w.clientTimezone} />

      <WizardStickyFooter
        stepLabel={copy.stepOf(3, 4, wizardStepLabel(3, locale))}
        onBack={() => setStep(2)}
        backLabel={copy.back}
        primaryLabel={copy.continueToGenerate}
        onPrimary={handleMetricsContinue}
        primaryDisabled={[...perCampaignMetrics.values()].some(
          (metrics) => metrics.length > 0 && metrics.length < MIN_SELECTED_METRICS,
        )}
      />


    </div>
  );
}
