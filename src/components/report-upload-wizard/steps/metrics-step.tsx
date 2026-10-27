"use client";

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
    confirmOpenSecondSlide,
    expandedCsvExtras,
    handleMetricsContinue,
    metricsStatus,
    objectiveAccent,
    overflowDialog,
    perCampaignMetrics,
    perCampaignMinWarning,
    removeCampaignMetric,
    setExpandedCsvExtras,
    setOverflowDialog,
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
          {selectedForCampaign.length <= MAX_METRICS_PER_SLIDE
            ? `${selectedForCampaign.length} of ${MAX_METRICS_PER_SLIDE} chips on this campaign slide`
            : `${selectedForCampaign.length} chips · first ${MAX_METRICS_PER_SLIDE} on slide 1, ${selectedForCampaign.length - MAX_METRICS_PER_SLIDE} on a continuation slide`}
        </p>

        <p className="mt-3 text-[14px] font-medium uppercase tracking-wide text-dash-ink-secondary">{copy.includedMetrics}</p>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {selectedForCampaign.map((m) => (
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
          ))}
        </div>

        {perCampaignMinWarning && (
          <p className="nre-wizard-confidence--warn mt-2 text-[14px]">{perCampaignMinWarning}</p>
        )}

        <details className="mt-4 border-t border-dash-border pt-3"><summary className="cursor-pointer text-[13px] font-medium text-dash-accent">Add more metrics · optional</summary><div className="mt-3">
        <p className="text-[14px] font-medium uppercase tracking-wide text-dash-ink-secondary">{copy.addFromCsv}</p>
        <p className="mt-0.5 text-[14px] text-dash-ink-secondary">{copy.addFromCsvHint}</p>
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
                  onClick={() => addCampaignMetric(normalized, candidate, name)}
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

      {overflowDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-dash-border bg-dash-card p-5">
            {overflowDialog.mode === "blocked_max" && (
              <>
                <p className="text-[15px] font-semibold text-dash-ink">Maximum {MAX_TOTAL_METRICS} metrics (2 slides)</p>
                <p className="mt-2 text-[14px] text-dash-ink-secondary">
                  Remove a chip before adding {overflowDialog.metric.label}.
                </p>
              </>
            )}
            {overflowDialog.mode === "confirm_second_slide" && (
              <>
                <p className="text-[15px] font-semibold text-dash-ink">Add a second slide?</p>
                <p className="mt-2 text-[14px] leading-relaxed text-dash-ink-secondary">
                  <span className="font-medium text-dash-ink">{overflowDialog.metric.label}</span> will go on slide 2.
                  Each campaign slide fits {MAX_METRICS_PER_SLIDE} metrics.
                </p>
                <p className="mt-2 text-[13px] text-dash-ink-muted">
                  Remove a chip above to stay on one slide instead.
                </p>
              </>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {overflowDialog.mode === "confirm_second_slide" && (
                <button
                  type="button"
                  onClick={confirmOpenSecondSlide}
                  className="rounded-md bg-dash-accent px-4 py-2 text-[14px] font-semibold text-dash-ink hover:bg-dash-accent-hover"
                >
                  Add to slide 2
                </button>
              )}
              <button
                type="button"
                onClick={() => setOverflowDialog(null)}
                className="rounded-md border border-dash-border px-4 py-2 text-[14px] text-dash-ink-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
