"use client";

import { useState } from "react";
import { useWizardContext } from "../wizard-context";
import { normalizeCampaignName } from "@/lib/nre/objective";
import { adSetKey } from "@/lib/nre/ad-sets";
import { isLowSpendCampaign } from "@/lib/nre/campaigns";
import { WizardPlatformSummaryLabel } from "@/components/wizard-platform-banner";
import { CsvDateGuidanceBanner } from "../ui/csv-date-guidance-banner";
import { WizardStickyFooter } from "../ui/wizard-sticky-footer";

export function WizardCampaignsStep() {
  const [objectivesExpanded, setObjectivesExpanded] = useState(false);
  const w = useWizardContext();
  if (w.step !== 2) return null;
  const {
    ADSET_CHIP_CLASS,
    LOW_SPEND_CAMPAIGN_THRESHOLD,
    OBJECTIVE_DROPDOWN_OPTIONS,
    adSetGroups,
    campaignObjectiveConfidence,
    campaignObjectives,
    campaignRequiresConfirmation,
    campaignSearch,
    campaignSpend,
    campaigns,
    csvDateGuidance,
    csvWarningDismissed,
    currencySymbol,
    data,
    deselectAllAdSetsForCampaign,
    expandedCampaigns,
    handleCampaignsContinue,
    hasBlockingObjectives,
    lowSpendCampaigns,
    metricsFetchedForSelection,
    metricsStatus,
    objectiveConfidenceBadge,
    selectAllAdSetsForCampaign,
    selectedAdSets,
    selectedCampaigns,
    selectedCampaignsKey,
    setCampaignObjective,
    setCampaignSearch,
    setCsvDateGuidance,
    setCsvWarningDismissed,
    setMtdFile,
    setSelectedCampaigns,
    setStep,
    setUploadSessionId,
    toggleAdSet,
    toggleCampaign,
    toggleCampaignExpanded,
    touchedObjectiveCampaigns
  } = w;

  return (
        <div className="space-y-4 rounded-lg border border-dash-border bg-dash-card p-5 pb-24 md:pb-5">
          {csvDateGuidance && csvDateGuidance.warnings.length > 0 && !csvWarningDismissed ? (
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

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                checked={campaigns.length > 0 && selectedCampaigns.size === campaigns.length}
                ref={(el) => {
                  if (el) el.indeterminate = selectedCampaigns.size > 0 && selectedCampaigns.size < campaigns.length;
                }}
                onChange={(e) => setSelectedCampaigns(e.target.checked ? new Set(campaigns) : new Set())}
                className="h-4 w-4 flex-shrink-0 accent-accent"
              />
              <span className="text-[14px] text-dash-ink-secondary">
                {selectedCampaigns.size} of {campaigns.length} campaigns selected
              </span>
            </label>
            {campaigns.length > 8 && (
              <input
                type="search"
                value={campaignSearch}
                onChange={(e) => setCampaignSearch(e.target.value)}
                placeholder="Search campaigns"
                className="w-full max-w-xs rounded-md border border-dash-border bg-dash-bg px-3 py-1.5 text-[14px] text-dash-ink outline-none focus:border-dash-accent sm:w-56"
              />
            )}
          </div>

          {lowSpendCampaigns.length > 0 && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[14px] text-dash-ink">
              <strong>{lowSpendCampaigns.length} campaign{lowSpendCampaigns.length === 1 ? "" : "s"}</strong> had less than{" "}
              {currencySymbol}
              {LOW_SPEND_CAMPAIGN_THRESHOLD} last-30-days spend and {lowSpendCampaigns.length === 1 ? "was" : "were"} excluded by default.
              Check any you still want in the report.
            </div>
          )}

          <ul className="divide-y divide-dash-border rounded-lg border border-dash-border">
            {(() => {
              const query = campaignSearch.trim().toLowerCase();
              const visible = query ? campaigns.filter((name) => name.toLowerCase().includes(query)) : campaigns;
              if (visible.length === 0) {
                return (
                  <li className="px-4 py-3 text-[14px] text-dash-ink-secondary">
                    No campaigns match “{campaignSearch.trim()}”.
                  </li>
                );
              }
              return visible.map((name) => {
              const isSelected = selectedCampaigns.has(name);
              const group = adSetGroups.find((g) => g.campaignName === name);
              const isExpanded = expandedCampaigns.has(name);
              const isMultiAdSet = !!group && group.adSetNames.length >= 2;
              const isSingleAdSet = !!group && group.adSetNames.length === 1;
              const allAdSetsDeselected =
                !!group && group.adSetNames.length > 0 && group.adSetNames.every((n) => !selectedAdSets.has(adSetKey(name, n)));
              const spend = campaignSpend[name] ?? 0;
              const lowSpend = isLowSpendCampaign(name, campaignSpend);
              return (
                <li key={name} className="px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id={`campaign-${name}`}
                      checked={isSelected}
                      onChange={() => toggleCampaign(name)}
                      className="h-4 w-4 flex-shrink-0 accent-accent"
                    />
                    <label htmlFor={`campaign-${name}`} className="min-w-0 flex-1 cursor-pointer truncate text-[14px] text-dash-ink" title={name}>
                      {name}
                    </label>
                    {lowSpend ? (
                      <span className="shrink-0 text-[14px] font-semibold tabular-nums text-amber-400">
                        Last 30 days spend detected · {currencySymbol}
                        {Math.round(spend).toLocaleString("en-US")}
                      </span>
                    ) : null}
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
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-[14px] text-dash-ink-secondary">
                            {selectedCount} of {group.adSetNames.length} ad sets selected
                          </p>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => selectAllAdSetsForCampaign(name, group.adSetNames)}
                              className="text-[14px] text-dash-accent hover:underline"
                            >
                              Select all
                            </button>
                            <button
                              type="button"
                              onClick={() => deselectAllAdSetsForCampaign(name, group.adSetNames)}
                              className="text-[14px] text-dash-accent hover:underline"
                            >
                              Deselect all
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
                                <label htmlFor={`adset-${key}`} className="min-w-0 flex-1 cursor-pointer truncate text-[14px] text-dash-ink-secondary" title={adSetName}>
                                  {adSetName}
                                </label>
                              </li>
                            );
                          })}
                        </ul>
                        <p className="text-[14px] text-dash-ink-secondary">
                          Uncheck any ad sets you do not want as separate slides in your report.
                        </p>
                        {allAdSetsDeselected && (
                          <p className="text-[14px] text-amber-300">No ad set slides will be generated for this campaign.</p>
                        )}
                      </div>
                    );
                  })()}

                  {isSelected && group && isSingleAdSet && isExpanded && (
                    <div className="mt-3 rounded-md border border-dash-border bg-dash-bg p-3">
                      <p className="mb-2 truncate text-[14px] font-medium text-dash-ink" title={group.adSetNames[0]}>
                        {group.adSetNames[0]}
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
            })()}
          </ul>

          {metricsFetchedForSelection === selectedCampaignsKey() && (() => {
            const shownCampaigns = campaigns.filter((name) => selectedCampaigns.has(name));
            const confidenceTiers = shownCampaigns.map((name) =>
              campaignObjectiveConfidence.get(normalizeCampaignName(name)),
            );
            const allConfirmed = shownCampaigns.length > 0 && confidenceTiers.every((t) => t === "cached");
            const blockingCount = campaigns.filter((name) => {
              const normalized = normalizeCampaignName(name);
              return (
                selectedCampaigns.has(name) &&
                campaignRequiresConfirmation.get(normalized) === true &&
                !touchedObjectiveCampaigns.has(normalized)
              );
            }).length;
            const showObjectiveList = blockingCount > 0 || !allConfirmed || objectivesExpanded;

            return (
            <div className="space-y-4 border-t border-dash-border pt-4">
              {allConfirmed && blockingCount === 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-emerald-800/50 bg-emerald-950/25 px-3 py-2.5">
                  <p className="text-[14px] text-emerald-200">
                    All objectives confirmed from your previous report.
                  </p>
                  {!objectivesExpanded ? (
                    <button
                      type="button"
                      onClick={() => setObjectivesExpanded(true)}
                      className="shrink-0 text-[14px] font-medium text-dash-accent hover:underline"
                    >
                      Review objectives
                    </button>
                  ) : null}
                </div>
              ) : (
                <div>
                  <h3 className="text-[15px] font-semibold text-white">Campaign Objectives</h3>
                  <p className="mt-1 text-[13px] text-dash-ink-secondary">
                    Objectives are auto-detected from your data. Change a dropdown only if the selection looks wrong.
                  </p>
                </div>
              )}

              {blockingCount > 0 && (
                <div className="rounded-md border border-[#fc8181]/40 bg-red-950/20 px-3 py-2 text-[14px] text-[#fc8181]">
                  {blockingCount === 1
                    ? "1 campaign's objective could not be reliably detected — pick a value from its dropdown to continue."
                    : `${blockingCount} campaigns' objectives could not be reliably detected — pick a value from each dropdown to continue.`}
                </div>
              )}

              {showObjectiveList ? (
              <ul className="divide-y divide-dash-border rounded-lg border border-dash-border">
                {campaigns
                  .filter((name) => selectedCampaigns.has(name))
                  .map((name) => {
                    const normalized = normalizeCampaignName(name);
                    const current = campaignObjectives.get(normalized);
                    const currentKey = current?.key ?? "results";
                    const options = OBJECTIVE_DROPDOWN_OPTIONS.some((o) => o.key === currentKey)
                      ? OBJECTIVE_DROPDOWN_OPTIONS
                      : [current!, ...OBJECTIVE_DROPDOWN_OPTIONS];
                    const tier = campaignObjectiveConfidence.get(normalized);
                    const badge = objectiveConfidenceBadge(tier);
                    const isBlocking =
                      campaignRequiresConfirmation.get(normalized) === true &&
                      !touchedObjectiveCampaigns.has(normalized);
                    return (
                      <li key={name} className={`px-4 py-3 ${isBlocking ? "border-2 border-[#fc8181] bg-red-950/10" : ""}`}>
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate text-[14px] text-white" title={name}>
                            {name}
                          </span>
                          <select
                            value={currentKey}
                            onChange={(e) => setCampaignObjective(name, e.target.value)}
                            className={`rounded-md border px-3 py-1.5 text-[14px] text-dash-ink outline-none focus:border-[#f6ad55] ${
                              isBlocking ? "border-[#fc8181] ring-1 ring-[#fc8181]" : "border-dash-border"
                            } bg-dash-bg`}
                          >
                            {options.map((o) => (
                              <option key={o.key} value={o.key}>
                                {o.resultLabel}
                              </option>
                            ))}
                          </select>
                        </div>
                        {badge && badge.pill && (
                          <div className="mt-2 flex justify-end">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[14px] font-semibold ${badge.className}`}
                            >
                              <span aria-hidden="true">{badge.icon}</span>
                              <span>{badge.text}</span>
                            </span>
                          </div>
                        )}
                        {badge && !badge.pill && (
                          <div className={`mt-1 flex items-center justify-end gap-1 text-[14px] font-medium ${badge.className}`}>
                            <span aria-hidden="true">{badge.icon}</span>
                            <span>{badge.text}</span>
                          </div>
                        )}
                      </li>
                    );
                  })}
              </ul>
              ) : null}
            </div>
            );
          })()}

          <div className="hidden gap-3 md:flex">
            <button
              onClick={() => setStep(1)}
              className="rounded-md border border-dash-border px-4 py-2 text-[14px] font-medium text-dash-ink hover:bg-dash-border"
            >
              Back
            </button>
            <button
              onClick={handleCampaignsContinue}
              disabled={
                selectedCampaigns.size === 0 ||
                metricsStatus === "loading" ||
                (metricsFetchedForSelection === selectedCampaignsKey() && hasBlockingObjectives())
              }
              className="rounded-md bg-dash-accent px-4 py-2 text-[14px] font-medium text-dash-ink hover:bg-dash-accent-hover disabled:opacity-50"
            >
              {metricsStatus === "loading" ? "Loading objectives…" : "Continue to metrics"}
            </button>
          </div>

          <WizardStickyFooter
            stepLabel="Step 2 of 4 · Campaign Data"
            onBack={() => setStep(1)}
            primaryLabel={metricsStatus === "loading" ? "Loading objectives…" : "Continue to metrics"}
            onPrimary={handleCampaignsContinue}
            primaryDisabled={
              selectedCampaigns.size === 0 ||
              metricsStatus === "loading" ||
              (metricsFetchedForSelection === selectedCampaignsKey() && hasBlockingObjectives())
            }
            primaryLoading={metricsStatus === "loading"}
          />
        </div>
  );
}
