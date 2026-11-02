"use client";
import { dailyBaseMetrics, dailyMetricIsExcluded } from "@/lib/nre/daily-metric-selection";
import { paginateComparisonMetrics } from "@/lib/nre/comparison-extra-metrics";

import { MetricChipPicker } from "../ui/metric-chip-picker";
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
    MAX_METRICS_PER_SLIDE,
    MAX_TOTAL_METRICS,
    MIN_SELECTED_METRICS,
    addCampaignMetric,
    campaignAvailableMetrics,
    campaignObjectives,
    handleMetricsContinue,
    metricsStatus,
    objectiveAccent,
    perCampaignMetrics,
    perCampaignMinWarning,
    removeCampaignMetric,
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

        <MetricChipPicker selected={selectedForCampaign} groups={pages.map((page, index) => ({ label: pages.length > 1 ? index === 0 ? "Main slide" : `Additional metrics · page ${index}` : "", keys: page.map(metric => metric.key) }))} available={availableForCampaign} onAdd={metric => { const candidate = availableForCampaign.find(item => item.key === metric.key); if (candidate) addCampaignMetric(normalized, candidate); }} onRemove={key => removeCampaignMetric(normalized, key)} limit={MAX_TOTAL_METRICS} hint={copy.addFromCsvHint} />
        {pages.length > 1 && <p className="mt-2 text-xs text-dash-ink-secondary">Additional metrics are paginated automatically. No empty slots or repeated metrics.</p>}
        {perCampaignMinWarning && <p className="mt-2 text-sm text-amber-300">{perCampaignMinWarning}</p>}
      </div>
    );
  }

  if (w.reportType === "COMPARISON" || w.reportType === "DAY_BREAKDOWN") {
    const daily = w.reportType === "DAY_BREAKDOWN";
    const optional = daily ? w.dailyOptionalMetrics : w.comparisonOptionalMetrics;
    const keys = daily ? w.dailyMetricKeys : w.comparisonMetricKeys;
    const toggle = daily ? w.toggleDailyMetric : w.toggleComparisonMetric;
    const objectives = activeCampaigns.flatMap(name => { const objective = campaignObjectives.get(normalizeCampaignName(name)); return objective ? [objective] : []; });
    const baseMetrics = dailyBaseMetrics(objectives);
    const included = daily ? baseMetrics.filter(metric => !dailyMetricIsExcluded(metric.key, w.dailyExcludedMetricKeys)) : baseMetrics.filter(metric => ["spend", "reach"].includes(metric.key) || metric.key.startsWith("objective_"));
    const toggleMetric = (key: string) => daily && baseMetrics.some(metric => metric.key === key) ? w.toggleDailyBaseMetric(key) : toggle(key);
    const extras = optional.filter(metric => keys.includes(metric.key));
    return <div className="space-y-4 rounded-xl border border-dash-border bg-dash-card p-5 shadow-sm pb-24 md:pb-5">
      <p className="text-[13px] leading-relaxed text-dash-ink-secondary">Metrics are selected from your CSV. Add or remove optional metrics below.</p>
      <div className="rounded-lg bg-dash-card nre-dash-surface p-4" style={{ borderTop: "3px solid #38bdf8" }}>
        <h3 className="text-[15px] font-bold text-dash-ink">{daily ? "Daily tables · selected campaigns" : "Comparison · selected campaigns"}</h3>
        <p className="mt-1 text-sm text-dash-ink-secondary">{daily ? "The same metrics are shown for each day, combined across selected campaigns." : "Each campaign uses its confirmed objective for both periods. Extras appear on additional comparison slides."}</p>
        <MetricChipPicker selected={[...included, ...extras]} groups={[{ label: daily ? "Main daily tables" : "Main comparison slide", keys: included.map(metric => metric.key) }, ...paginateComparisonMetrics(extras).map((page, index) => ({ label: `Additional metrics · ${daily ? "column group" : "page"} ${index + 1}`, keys: page.map(metric => metric.key) }))]} available={daily ? [...baseMetrics, ...optional] : optional} lockedKeys={daily ? [] : included.map(metric => metric.key)} onAdd={metric => toggleMetric(metric.key)} onRemove={toggleMetric} limit={MAX_TOTAL_METRICS + included.length} hint="Only supported metrics from your CSV are shown." />
      </div>
      <div className="hidden gap-3 md:flex"><button type="button" onClick={() => setStep(2)} className="rounded-md border border-dash-border px-4 py-2 text-sm text-dash-ink">{copy.back}</button><button type="button" onClick={handleMetricsContinue} className="rounded-md bg-dash-accent px-6 py-2 text-sm font-semibold text-[#0b1728]">{copy.continueToGenerate}</button></div>
      <WizardStepHelp step={3} platform={w.platform} clientTimezone={w.clientTimezone} />
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
