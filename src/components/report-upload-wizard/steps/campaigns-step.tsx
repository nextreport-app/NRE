"use client";

import { useEffect, useId, useState } from "react";
import { useWizardContext } from "../wizard-context";
import {
  campaignCsvSummaryHasWizardSignal,
  csvResultTypeMatchesDetection,
  expectedResultLabelsFromCsvSummary,
  type CampaignCsvResultTypeSummary,
} from "@/lib/nre/campaign-csv-result-type";
import type { WizardCopy } from "@/lib/wizard-i18n";
import { normalizeCampaignName } from "@/lib/nre/objective";
import { adSetKey } from "@/lib/nre/ad-sets";
import { activeAdSetKeys, supportsAdSetSlides } from "@/lib/nre/ad-set-slide-preferences";
import { META_CAMPAIGNS_TABLE_ADSET_SKIP_HINT } from "@/lib/nre/meta-csv-export-profile";
import { ObjectivePicker } from "../ui/objective-picker";
import { CsvDateGuidanceBanner } from "../ui/csv-date-guidance-banner";
import { WizardStickyFooter } from "../ui/wizard-sticky-footer";
import { WizardStepHelp } from "../ui/wizard-step-help";
import { useWizardCopy } from "@/hooks/use-wizard-copy";
import { wizardStepLabel } from "@/lib/wizard-i18n";
import { useSiteTheme } from "@/components/site-theme-provider";

/** One-line CSV Result type ↔ objective status (Campaigns step). */
function csvObjectiveStatusLine(
  copy: WizardCopy,
  csvSummary: CampaignCsvResultTypeSummary,
  detectedLabel: string,
  csvAlign: boolean | null,
  useResultIndicatorHeading: boolean,
): string {
  const heading =
    csvSummary.distinct.length > 1
      ? useResultIndicatorHeading
        ? copy.csvResultIndicatorsHeading
        : copy.csvResultTypesHeading
      : useResultIndicatorHeading
        ? copy.csvResultIndicatorHeading
        : copy.csvResultTypeHeading;

  if (csvSummary.distinct.length === 1) {
    if (csvAlign === true && detectedLabel) {
      if (useResultIndicatorHeading && csvSummary.primary) {
        return `${heading}: ${csvSummary.primary} → ${detectedLabel} ✓ ${copy.csvResultTypeMatch}`;
      }
      return `${heading} → ${detectedLabel} ✓ ${copy.csvResultTypeMatch}`;
    }
    if (csvAlign === false) {
      const mismatch =
        csvSummary.expectedResultLabel && detectedLabel
          ? copy.csvResultTypeMismatch(csvSummary.expectedResultLabel, detectedLabel)
          : copy.csvResultTypeMismatch("—", detectedLabel || "—");
      return `${heading} ✗ ${mismatch}`;
    }
    const entry = csvSummary.entries[0];
    if (entry?.expectedResultLabel) {
      return `${heading}: ${entry.resultType} → ${entry.expectedResultLabel}`;
    }
    return `${heading}: ${csvSummary.primary ?? "—"}`;
  }

  const maps = csvSummary.entries
    .map((e) => (e.expectedResultLabel ? `${e.resultType} → ${e.expectedResultLabel}` : e.resultType))
    .join(", ");
  if (csvAlign === true) {
    return `${heading}: ${maps} ✓ ${copy.csvResultTypeMatch}`;
  }
  if (csvAlign === false) {
    return `${heading}: ${maps} ✗ ${copy.csvResultTypeMismatchMulti(
      expectedResultLabelsFromCsvSummary(csvSummary).join(", ") || "—",
      detectedLabel || "—",
    )}`;
  }
  return `${heading}: ${maps}`;
}

export function WizardCampaignsStep() {
  const w = useWizardContext();
  const [zeroSpendExpanded, setZeroSpendExpanded] = useState(false);
  const zeroSpendListId = useId();
  const copy = useWizardCopy();
  const { locale } = useSiteTheme();
  const stepActive = w.step === 2;
  const zeroSpendSet = new Set(w.zeroSpendCampaigns);
  const selectionKey = w.selectedCampaignsKey();
  const objectivesReady = w.metricsFetchedForSelection === selectionKey;
  const selectedCount = w.selectedCampaigns.size;

  const ensureObjectives = w.ensureObjectivesForSelection;
  useEffect(() => {
    if (!stepActive || selectedCount === 0) return;
    if (objectivesReady) return;
    void ensureObjectives(selectionKey);
  }, [stepActive, selectionKey, selectedCount, objectivesReady, ensureObjectives]);

  if (!stepActive) return null;

  const {
    ADSET_CHIP_CLASS,
    OBJECTIVE_DROPDOWN_OPTIONS,
    adSetGroups,
    metaCsvExportProfile,
    campaignCsvResultTypes,
    campaignObjectiveConfidence,
    campaignObjectives,
    campaignRequiresConfirmation,
    campaignSearch,
    campaignSpend,
    campaigns,
    csvDateGuidance,
    csvWarningDismissed,
    currencySymbol,
    deselectAllAdSetsForCampaign,
    expandedCampaigns,
    handleCampaignsContinue,
    hasBlockingObjectives,
    zeroSpendCampaigns,
    campaignSpendLabel,
    campaignSpendLoading,
    selectAllCampaigns,
    metricsStatus,
    objectiveConfidenceBadge,
    selectAllAdSetsForCampaign,
    selectedAdSets,
    selectedCampaigns,
    setCampaignObjective,
    setCampaignSearch,
    setCsvDateGuidance,
    setCsvWarningDismissed,
    setMtdFile,
    setStep,
    setUploadSessionId,
    toggleAdSet,
    toggleCampaign,
    toggleCampaignExpanded,
    touchedObjectiveCampaigns,
  } = w;

  const useResultIndicatorHeading =
    metaCsvExportProfile?.kind === "campaigns_table" && metaCsvExportProfile.hasResultIndicatorColumn;

  const showAdSetOptions = supportsAdSetSlides(w.reportType);
  const activeAdSetCount = activeAdSetKeys(adSetGroups, selectedAdSets, selectedCampaigns).length;

  const objectivesLoading = selectedCampaigns.size > 0 && (metricsStatus === "loading" || !objectivesReady);

  const blockingCount = campaigns.filter((name) => {
    const normalized = normalizeCampaignName(name);
    return (
      selectedCampaigns.has(name) &&
      campaignRequiresConfirmation.get(normalized) === true &&
      !touchedObjectiveCampaigns.has(normalized)
    );
  }).length;

  return (
    <div className="space-y-5 pb-24 md:pb-0">
      {w.reportType === "WEEKLY" && csvDateGuidance && csvDateGuidance.warnings.length > 0 && !csvWarningDismissed ? (
        <CsvDateGuidanceBanner
          guidance={csvDateGuidance}
          onContinue={() => setCsvWarningDismissed(true)}
          onRedownload={() => {
            setCsvWarningDismissed(false);
            setCsvDateGuidance(null);
            setMtdFile(null);
            setUploadSessionId(null);
            setStep(1);
          }}
        />
      ) : null}

      {metaCsvExportProfile?.kind === "campaigns_table" ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[14px] leading-snug text-amber-200">
          <p>{META_CAMPAIGNS_TABLE_ADSET_SKIP_HINT.headline}</p>
          <p className="mt-1 text-[13px] text-amber-200/90">{META_CAMPAIGNS_TABLE_ADSET_SKIP_HINT.recommended}</p>
        </div>
      ) : null}

      <section aria-labelledby="wizard-campaigns-section-heading" className="space-y-4 rounded-xl border border-dash-border bg-dash-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-dash-border pb-4">
          <div className="flex items-start gap-3">
            <span className="nre-wizard-section-marker flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-sky-500/25 bg-sky-500/10 text-sm font-semibold text-sky-400" aria-hidden="true">1</span>
            <div><h3 id="wizard-campaigns-section-heading" className="text-[16px] font-semibold text-dash-ink">Campaign selection</h3><p className="mt-1 text-[13px] text-dash-ink-secondary">Choose which campaigns to include in this report.</p></div>
          </div>
          <p className="rounded-full border border-dash-border bg-dash-bg px-2.5 py-1 text-xs text-dash-ink-secondary" role="status">{selectedCampaigns.size} of {campaigns.length} included{campaigns.length > selectedCampaigns.size ? ` · ${campaigns.length - selectedCampaigns.size} excluded` : ""}</p>
        </div>

      {showAdSetOptions && adSetGroups.length > 0 && <div className="space-y-1 text-[13px] text-dash-ink-secondary">
        <p className="font-semibold text-dash-ink">Optional ad-set slides</p>
        <p>Campaign totals already include all ad sets. Select any you want to show as separate slides.</p>
        <p role="status">{selectedCampaigns.size} campaign{selectedCampaigns.size === 1 ? "" : "s"} included · {activeAdSetCount} ad set{activeAdSetCount === 1 ? "" : "s"} selected for separate slides</p>
      </div>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            checked={campaigns.length > 0 && selectedCampaigns.size === campaigns.length}
            ref={(el) => {
              if (el) el.indeterminate = selectedCampaigns.size > 0 && selectedCampaigns.size < campaigns.length;
            }}
            onChange={(e) => selectAllCampaigns(e.target.checked)}
            className="h-4 w-4 flex-shrink-0 accent-accent"
          />
          <span className="text-[14px] text-dash-ink-secondary">
            Select all campaigns
          </span>
        </label>
        {campaigns.length > 8 && (
          <input
            type="search"
            value={campaignSearch}
            onChange={(e) => setCampaignSearch(e.target.value)}
            placeholder="Search campaigns"
            aria-label="Search campaigns"
            className="w-full max-w-xs rounded-md border border-dash-border bg-dash-bg px-3 py-1.5 text-[14px] text-dash-ink outline-none focus:border-dash-accent sm:w-56"
          />
        )}
      </div>

      <p className="text-[13px] text-dash-ink-secondary">{campaignSpendLoading ? "Updating campaign spend…" : campaignSpendLabel}</p>
      {zeroSpendCampaigns.length > 0 && <p className="text-[13px] text-dash-ink-secondary">Campaigns with no spend in this reporting period are excluded by default. Expand below to include any you need.</p>}

      <div className="space-y-3">
        {(() => {
          const query = campaignSearch.trim().toLowerCase();
          const visible = query ? campaigns.filter((name) => name.toLowerCase().includes(query)) : campaigns;
          if (visible.length === 0) {
            return (
              <p className="px-4 py-3 text-[14px] text-dash-ink-secondary">
                No campaigns match “{campaignSearch.trim()}”.
              </p>
            );
          }
          const renderCampaigns = (names: string[]) => names.map((name) => {
            const isSelected = selectedCampaigns.has(name);
            const group = adSetGroups.find((g) => g.campaignName === name);
            const isExpanded = expandedCampaigns.has(name);
            const isMultiAdSet = showAdSetOptions && !!group && group.adSetNames.length >= 2;
            const isSingleAdSet = showAdSetOptions && !!group && group.adSetNames.length === 1;
            const allAdSetsDeselected =
              !!group && group.adSetNames.length > 0 && group.adSetNames.every((n) => !selectedAdSets.has(adSetKey(name, n)));
            const spend = campaignSpend[name];
            const spendKnown = typeof spend === "number" && Number.isFinite(spend);
            return (
              <li key={name} className="px-4 py-2.5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <input
                    type="checkbox"
                    id={`campaign-${name}`}
                    checked={isSelected}
                    onChange={() => toggleCampaign(name)}
                    className="h-4 w-4 flex-shrink-0 accent-accent"
                  />
                  <label
                    htmlFor={`campaign-${name}`}
                    className="min-w-0 flex-1 cursor-pointer truncate text-[14px] text-dash-ink"
                    title={name}
                  >
                    {name}
                  </label>
                  {!spendKnown ? <span className="shrink-0 text-[13px] text-dash-ink-secondary">Spend unavailable</span> : null}
                  {spendKnown ? <span className="shrink-0 text-[13px] tabular-nums text-dash-ink-secondary">{spend > 0 && spend < 0.01 ? `<${currencySymbol}0.01` : `${currencySymbol}${spend.toLocaleString("en-US", { maximumFractionDigits: 2 })}`} spend{zeroSpendSet.has(name) && !isSelected ? " · Excluded by default" : ""}</span> : null}
                  {isSingleAdSet && (
                    <button
                      type="button"
                      onClick={() => toggleCampaignExpanded(name)}
                      disabled={!isSelected}
                      aria-expanded={isExpanded}
                      className={ADSET_CHIP_CLASS}
                    >
                      1 ad set {isExpanded ? "▲" : "▼"}
                    </button>
                  )}
                  {isMultiAdSet && (
                    <button
                      type="button"
                      onClick={() => toggleCampaignExpanded(name)}
                      disabled={!isSelected}
                      aria-expanded={isExpanded}
                      className={ADSET_CHIP_CLASS}
                    >
                      {group.adSetNames.length} ad sets {isExpanded ? "▲" : "▼"}
                    </button>
                  )}
                </div>

                {isSelected && group && isMultiAdSet && isExpanded && (() => {
                  const selectedCount = group.adSetNames.filter((n) => selectedAdSets.has(adSetKey(name, n))).length;
                  return (
                    <div className="mt-3 space-y-2 rounded-md border border-dash-border bg-dash-bg p-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-[14px] text-dash-ink-secondary">
                          {selectedCount} of {group.adSetNames.length} selected for separate slides
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => selectAllAdSetsForCampaign(name, group.adSetNames)}
                            className="text-[14px] text-dash-accent hover:underline"
                          >
                            Include all ad-set slides
                          </button>
                          <button
                            type="button"
                            onClick={() => deselectAllAdSetsForCampaign(name, group.adSetNames)}
                            className="text-[14px] text-dash-accent hover:underline"
                          >
                            Exclude all
                          </button>
                        </div>
                      </div>
                      <ul className="space-y-1.5">
                        {group.adSetNames.map((adSetName) => {
                          const key = adSetKey(name, adSetName);
                          return (
                            <li key={key} className="flex items-center gap-2.5">
                              <input
                                type="checkbox"
                                id={`adset-${key}`}
                                checked={selectedAdSets.has(key)}
                                onChange={() => toggleAdSet(name, adSetName)}
                                className="h-3.5 w-3.5 flex-shrink-0 accent-accent"
                              />
                              <label
                                htmlFor={`adset-${key}`}
                                className="min-w-0 flex-1 cursor-pointer truncate text-[14px] text-dash-ink-secondary"
                                title={adSetName}
                              >
                                {adSetName}
                                {w.newAdSetKeys?.has(key) && <span className="ml-2 rounded bg-sky-500/10 px-1.5 py-0.5 text-xs text-sky-400">New</span>}
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                      <p className="text-[14px] text-dash-ink-secondary">
                        Add separate slides for the ad sets you want to discuss with your client.
                      </p>
                      {allAdSetsDeselected && (
                        <p className="text-[13px] text-dash-ink-secondary">No ad set slides will be generated for this campaign.</p>
                      )}
                    </div>
                  );
                })()}

                {isSelected && group && isSingleAdSet && isExpanded && (
                  <div className="mt-3 rounded-md border border-dash-border bg-dash-bg p-3">
                    <p className="mb-2 truncate text-[14px] font-medium text-dash-ink" title={group.adSetNames[0]}>
                      {group.adSetNames[0]}
                      {w.newAdSetKeys?.has(adSetKey(name, group.adSetNames[0])) && <span className="ml-2 rounded bg-sky-500/10 px-1.5 py-0.5 text-xs text-sky-400">New</span>}
                    </p>
                    <label className="flex cursor-pointer items-center gap-2.5">
                      <input
                        type="checkbox"
                        id={`adset-${adSetKey(name, group.adSetNames[0])}`}
                        checked={selectedAdSets.has(adSetKey(name, group.adSetNames[0]))}
                        onChange={() => toggleAdSet(name, group.adSetNames[0])}
                        className="h-3.5 w-3.5 flex-shrink-0 accent-accent"
                      />
                      <span className="text-[14px] text-dash-ink-secondary">
                        Optional ad set slide — mirrors campaign data. Enable only if you want a separate slide.
                      </span>
                    </label>
                  </div>
                )}
              </li>
            );
          });
          const listClass = "divide-y divide-dash-border rounded-lg border border-dash-border";
          // Search includes every campaign, even when the zero-spend group is collapsed.
          if (query) return <ul className={listClass}>{renderCampaigns(visible)}</ul>;
          const zeroSpend = visible.filter(name => zeroSpendSet.has(name));
          const withSpend = visible.filter(name => !zeroSpendSet.has(name));
          const zeroSpendSelected = zeroSpend.filter(name => selectedCampaigns.has(name)).length;
          return (
            <>
              {withSpend.length > 0 ? <ul className={listClass}>{renderCampaigns(withSpend)}</ul> : null}
              {zeroSpend.length > 0 ? (
                <div className="overflow-hidden rounded-lg border border-dash-border">
                  <button
                    type="button"
                    aria-expanded={zeroSpendExpanded}
                    aria-controls={zeroSpendListId}
                    onClick={() => setZeroSpendExpanded(open => !open)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left focus-visible:outline-2 focus-visible:outline-dash-accent"
                  >
                    <span className="min-w-0">
                      <span className="block text-[14px] font-semibold text-dash-ink">Zero-spend campaigns ({zeroSpend.length.toLocaleString("en-US")})</span>
                      <span className="mt-1 block text-[13px] text-dash-ink-secondary">{zeroSpendSelected} included · {zeroSpendExpanded ? "Hide campaigns" : "Expand to review or include"}</span>
                    </span>
                    <span aria-hidden="true" className="shrink-0 text-dash-ink-secondary">{zeroSpendExpanded ? "▲" : "▼"}</span>
                  </button>
                  <div id={zeroSpendListId} hidden={!zeroSpendExpanded}>
                    {zeroSpendExpanded ? (
                      <div role="region" aria-label="Zero-spend campaigns" tabIndex={0} className="max-h-96 overflow-y-auto overscroll-contain border-t border-dash-border focus-visible:outline-2 focus-visible:outline-dash-accent">
                        <ul className="divide-y divide-dash-border">{renderCampaigns(zeroSpend)}</ul>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </>
          );
        })()}
      </div>
      </section>

      {selectedCampaigns.size > 0 ? (
        <>
          <section
            aria-labelledby="wizard-objectives-section-heading"
            className="space-y-4 rounded-xl border border-dash-border bg-dash-card p-4 sm:p-5"
          >
          <div className="flex items-start gap-3 border-b border-dash-border pb-4">
            <span className="nre-wizard-section-marker flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-sky-500/25 bg-sky-500/10 text-sm font-semibold text-sky-400" aria-hidden="true">2</span>
            <div><h3 id="wizard-objectives-section-heading" className="text-[16px] font-semibold text-dash-ink">{copy.campaignObjectives}</h3><p className="mt-1 text-[13px] text-dash-ink-secondary">{copy.objectivesIntro}</p></div>
          </div>

          {blockingCount > 0 ? (
            <div className="rounded-md border border-[#fc8181]/40 bg-red-950/20 px-3 py-2 text-[14px] text-[#fc8181]">
              {blockingCount === 1
                ? "1 campaign's objective could not be reliably detected — pick a value from its dropdown to continue."
                : `${blockingCount} campaigns' objectives could not be reliably detected — pick a value from each dropdown to continue.`}
            </div>
          ) : null}

          {objectivesLoading ? (
            <p className="text-[14px] text-dash-ink-secondary">Loading objectives…</p>
          ) : (
            <ul className="space-y-2">
              {campaigns
                .filter((name) => selectedCampaigns.has(name))
                .map((name) => {
                  const normalized = normalizeCampaignName(name);
                  const current = campaignObjectives.get(normalized);
                  const currentKey = current?.key ?? "results";
                  const options = OBJECTIVE_DROPDOWN_OPTIONS.some((o) => o.key === currentKey)
                    ? OBJECTIVE_DROPDOWN_OPTIONS
                    : current
                      ? [current, ...OBJECTIVE_DROPDOWN_OPTIONS]
                      : OBJECTIVE_DROPDOWN_OPTIONS;
                  const tier = campaignObjectiveConfidence.get(normalized);
                  const csvSummary = campaignCsvResultTypes.get(normalized);
                  const detectedLabel = current?.resultLabel ?? "";
                  const csvAlign =
                    csvSummary && detectedLabel
                      ? csvResultTypeMatchesDetection(csvSummary, detectedLabel)
                      : null;
                  const showCsvObjectivePanel = campaignCsvSummaryHasWizardSignal(csvSummary);
                  const badge = objectiveConfidenceBadge(tier);
                  const isBlocking =
                    campaignRequiresConfirmation.get(normalized) === true &&
                    !touchedObjectiveCampaigns.has(normalized);
                  return (
                    <li key={name}>
                      <details key={`${normalized}-${csvAlign}-${isBlocking}`} open={csvAlign !== true || isBlocking} className={`group/objective overflow-hidden rounded-lg border ${isBlocking ? "border-[#fc8181] bg-red-950/10" : csvAlign === true ? "border-emerald-500/25 bg-emerald-500/5" : "border-dash-border"}`}>
                        <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 text-sm focus-visible:outline-2 focus-visible:outline-dash-accent [&::-webkit-details-marker]:hidden">
                          <span aria-hidden className={csvAlign === true && !isBlocking ? "text-emerald-400" : "text-dash-accent"}>{csvAlign === true && !isBlocking ? "✓" : "!"}</span>
                          <span className="min-w-0 flex-1"><span className="block break-words font-medium text-dash-ink" title={name}>{name}</span><span className="text-xs text-dash-ink-secondary">{detectedLabel}{csvAlign === true && !isBlocking ? " · Matches imported data" : " · Review objective"}</span></span>
                          <span aria-hidden className="text-dash-ink-secondary transition-transform group-open/objective:rotate-180">▾</span>
                        </summary>
                        <div className="space-y-2 border-t border-dash-border px-4 py-3">
                        <ObjectivePicker options={options} value={currentKey} label={`Objective for ${name}`} needsConfirmation={isBlocking} onChange={key => setCampaignObjective(name, key)} />
                      {showCsvObjectivePanel && csvSummary && (csvAlign === false || csvSummary.distinct.length > 1) ? (
                        <div
                          className={`mt-2 rounded-md border px-3 py-1.5 text-[13px] leading-snug ${
                            csvAlign === false
                              ? "border-[#fc8181]/50 bg-red-950/15 text-[#fecaca]"
                              : csvAlign === true
                                ? "border-emerald-500/35 bg-emerald-950/15 text-emerald-100"
                                : "border-dash-border bg-dash-bg text-dash-ink-secondary"
                          }`}
                        >
                          <p className="font-normal text-dash-ink">
                            {csvObjectiveStatusLine(
                              copy,
                              csvSummary,
                              detectedLabel,
                              csvAlign,
                              useResultIndicatorHeading,
                            )}
                          </p>
                          {csvSummary.distinct.length > 1 ? (
                            <p className="mt-1 text-[12px] text-dash-ink-secondary">{copy.csvResultTypeMultipleHint}</p>
                          ) : null}
                        </div>
                      ) : null}
                      {badge && badge.pill ? (
                        <div className="flex">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[14px] font-semibold ${badge.className}`}
                          >
                            <span aria-hidden="true">{badge.icon}</span>
                            <span>{badge.text}</span>
                          </span>
                        </div>
                      ) : null}
                      {badge && !badge.pill ? (
                        <div className={`flex items-center gap-1 text-[14px] font-medium ${badge.className}`}>
                          <span aria-hidden="true">{badge.icon}</span>
                          <span>{badge.text}</span>
                        </div>
                      ) : null}
                        </div>
                      </details>
                    </li>
                  );
                })}
            </ul>
          )}
          </section>
        </>
      ) : null}

      <div className="hidden gap-3 md:flex">
        <button
          onClick={() => setStep(1)}
          className="rounded-md border border-dash-border px-4 py-2 text-[14px] font-medium text-dash-ink hover:bg-dash-border"
        >
          {copy.back}
        </button>
        <button
          onClick={() => void handleCampaignsContinue()}
          disabled={selectedCampaigns.size === 0 || objectivesLoading || campaignSpendLoading || hasBlockingObjectives()}
          className="rounded-md bg-dash-accent px-4 py-2 text-[14px] font-medium text-dash-ink hover:bg-dash-accent-hover disabled:opacity-50"
        >
          {objectivesLoading ? copy.loading : copy.continueToMetrics}
        </button>
      </div>

      <WizardStepHelp step={2} platform={w.platform} clientTimezone={w.clientTimezone} />

      <WizardStickyFooter
        stepLabel={copy.stepOf(2, 4, wizardStepLabel(2, locale))}
        onBack={() => setStep(1)}
        backLabel={copy.back}
        primaryLabel={objectivesLoading ? copy.loading : copy.continueToMetrics}
        onPrimary={() => void handleCampaignsContinue()}
        primaryDisabled={selectedCampaigns.size === 0 || objectivesLoading || campaignSpendLoading || hasBlockingObjectives()}
        primaryLoading={objectivesLoading}
      />
    </div>
  );
}
