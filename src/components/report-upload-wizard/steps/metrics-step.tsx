"use client";
import { dailyBaseMetrics, dailyMetricIsExcluded } from "@/lib/nre/daily-metric-selection";
import { paginateComparisonMetrics } from "@/lib/nre/comparison-extra-metrics";

import { CampaignMetricPanel } from "../ui/campaign-metric-panel";
import { MetricChipPicker } from "../ui/metric-chip-picker";
import { paginateExtraMetrics } from "@/lib/nre/metric-pagination";
import { useMemo } from "react";
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
    perCampaignMetrics,
    perCampaignMinWarning,
    removeCampaignMetric,
    setStep,
  } = w;

  const hasInvalidSelection = activeCampaigns.some(name => {
    const count = perCampaignMetrics.get(normalizeCampaignName(name))?.length ?? 0;
    return count < MIN_SELECTED_METRICS || count > MAX_TOTAL_METRICS;
  });

  const metricSource = w.dataSourceMode === "api" ? "Meta API" : "CSV";

  function renderCampaignMetrics(name: string, index: number) {
    const normalized = normalizeCampaignName(name);
    const objective = campaignObjectives.get(normalized);
    const selectedForCampaign = perCampaignMetrics.get(normalized) ?? [];
    const availableForCampaign = campaignAvailableMetrics(normalized);
    const pages = [selectedForCampaign.slice(0, MAX_METRICS_PER_SLIDE), ...paginateExtraMetrics(selectedForCampaign.slice(MAX_METRICS_PER_SLIDE))];

    const needsAttention = metricsStatus !== "loading" && (selectedForCampaign.length < MIN_SELECTED_METRICS || selectedForCampaign.length > MAX_TOTAL_METRICS);
    return (
      <CampaignMetricPanel
        key={name} name={name} objective={objective?.resultLabel}
        metricCount={selectedForCampaign.length} slideCount={pages.length}
        collapsible={activeCampaigns.length > 1} initiallyExpanded={index === 0} needsAttention={needsAttention}
      >
        <MetricChipPicker selected={selectedForCampaign} groups={pages.map((page, index) => ({ label: pages.length > 1 ? index === 0 ? "Main slide" : `Additional metrics · page ${index}` : "", keys: page.map(metric => metric.key) }))} available={availableForCampaign} onAdd={metric => { const candidate = availableForCampaign.find(item => item.key === metric.key); if (candidate) addCampaignMetric(normalized, candidate); }} onRemove={key => removeCampaignMetric(normalized, key)} limit={MAX_TOTAL_METRICS} source={metricSource} />
        {pages.length > 1 && <p className="mt-2 text-xs text-dash-ink-secondary">Additional metrics are paginated automatically. No empty slots or repeated metrics.</p>}
        {needsAttention && <p role="alert" className="mt-2 text-sm text-dash-accent">{selectedForCampaign.length > MAX_TOTAL_METRICS ? `Choose up to ${MAX_TOTAL_METRICS} metrics for this campaign.` : `Choose at least ${MIN_SELECTED_METRICS} metrics for this campaign.`}</p>}
      </CampaignMetricPanel>
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
      <p className="text-[13px] leading-relaxed text-dash-ink-secondary">Metrics are selected from {w.dataSourceMode === "api" ? "Meta API" : "your CSV"}. Add or remove optional metrics below.</p>
      <div className="rounded-lg bg-dash-card nre-dash-surface p-4" style={{ borderTop: "var(--nre-wizard-section-border, 3px solid #38bdf8)" }}>
        <h3 className="text-[15px] font-bold text-dash-ink">{daily ? "Daily tables · selected campaigns" : "Comparison · selected campaigns"}</h3>
        <p className="mt-1 text-sm text-dash-ink-secondary">{daily ? "The same metrics are shown for each day, combined across selected campaigns." : "Each campaign uses its confirmed objective for both periods. Extras appear on additional comparison slides."}</p>
        <MetricChipPicker selected={[...included, ...extras]} groups={[{ label: daily ? "Main daily tables" : "Main comparison slide", keys: included.map(metric => metric.key) }, ...paginateComparisonMetrics(extras).map((page, index) => ({ label: `Additional metrics · ${daily ? "column group" : "page"} ${index + 1}`, keys: page.map(metric => metric.key) }))]} available={daily ? [...baseMetrics, ...optional] : optional} lockedKeys={daily ? [] : included.map(metric => metric.key)} onAdd={metric => toggleMetric(metric.key)} onRemove={toggleMetric} limit={MAX_TOTAL_METRICS + included.length} source={metricSource} />
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

      <p className="text-[13px] leading-relaxed text-dash-ink-secondary">Metrics are selected from {w.dataSourceMode === "api" ? "Meta API" : "your CSV"}. Review or expand to customize.</p>
      {activeCampaigns.length > 1 ? (
        <p className="text-[14px] text-dash-ink-secondary">
          {activeCampaigns.length} campaigns
        </p>
      ) : null}

      {perCampaignMinWarning ? (
        <p className="text-[14px] text-amber-300">{perCampaignMinWarning}</p>
      ) : null}

      <div className="space-y-3">{activeCampaigns.map(renderCampaignMetrics)}</div>

      <div className="hidden gap-3 md:flex">
        <button
          onClick={() => setStep(2)}
          className="rounded-md border border-dash-border px-4 py-2 text-[14px] font-medium text-dash-ink hover:bg-dash-border"
        >
          {copy.back}
        </button>
        <button
          onClick={handleMetricsContinue}
          disabled={hasInvalidSelection}
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
        primaryDisabled={hasInvalidSelection}
      />


    </div>
  );
}
