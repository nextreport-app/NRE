"use client";

import { useWizardContext } from "../wizard-context";
import Link from "next/link";
import { getMetaCsvDownloadTip } from "@/lib/nre/csv-date-guidance";
import { PreviousMonthDataWizardPanel } from "@/components/previous-month-data-wizard-panel";
import { AD_PLATFORM_API_SYNC_ENABLED } from "@/lib/ad-platform-api-sync";
import { WizardDataSourcePanel, WizardDataSourceToggle } from "@/components/wizard-data-source-panel";
import { MetaAdsBrandIcon, GoogleAdsBrandIcon, TikTokAdsBrandIcon } from "@/components/platform-brand-icons";
import { getPreviousMonthComparisonInfo } from "@/lib/nre/previous-month-data-status";
import {
  wizardPlatformImportDescription,
  isNoDataRowsError,
  isSpecificFieldError,
  isApiSyncArtifact,
  downloadWizardCsvFile,
} from "../utils";
import { SpecificFieldWarning } from "../ui/specific-field-warning";
import { NoDataRowsWarning, PreviousMonthSummaryOption } from "../ui/warnings";
import { WizardPlatformCompactBar, WizardPlatformPickerGrid } from "../ui/platform-picker";
import { PlatformBetaNotice } from "@/components/platform-beta-badge";
import { isPlatformBeta } from "@/lib/platform-beta";
import { UploadDropzone } from "../ui/upload-dropzone";

export function WizardImportStep() {
  const w = useWizardContext();
  if (w.step !== 1) return null;
  const {
    analyzeErrors,
    analyzeMessage,
    analyzeStatus,
    apiSyncError,
    apiSyncStatus,
    choosePlatform,
    chooseWebsitePlatform,
    clientId,
    clientTimezone,
    continueStatus,
    dataSourceMode,
    detectedPlatform,
    googleAdsConfigured,
    googleAdsConnected,
    handleAnalyze,
    handleApiSynced,
    handleCancelPreviousMonthSummary,
    handleDataSourceModeChange,
    handleGeneratePreviousMonthSummary,
    handleMismatchContinueAnyway,
    handleMismatchGoBack,
    handleMtdFileSelected,
    importPipelineLabel,
    hasSavedPlatformPreference,
    includePreviousMonthComparison,
    metaConfigured,
    metaConnected,
    metaConnectedName,
    metaSyncDiagnostics,
    mismatchWarning,
    mtdFile,
    platformPickerExpanded,
    pmsError,
    pmsResult,
    pmsStatus,
    currencySymbol,
    previousMonthCampaigns,
    previousMonthCampaignSpend,
    previousMonthHasFile,
    previousMonthSelectedCampaigns,
    previousMonthUpdatedAt,
    selectedPlatformCard,
    setApiSyncError,
    setApiSyncStatus,
    setIncludePreviousMonthComparison,
    setPlatformPickerExpanded,
    setPreviousMonthCampaigns,
    setPreviousMonthCampaignSpend,
    setPreviousMonthHasFile,
    setPreviousMonthSelectedCampaigns,
    setPreviousMonthUpdatedAt,
    showTikTokOption,
    tiktokConfigured,
    tiktokConnected,
  } = w;

  const previousMonthInfo = getPreviousMonthComparisonInfo(
    previousMonthHasFile,
    previousMonthUpdatedAt,
    clientTimezone,
  );
  const showCompactPreviousMonth =
    previousMonthInfo.status === "current" && !includePreviousMonthComparison;

  return (
    <div className="space-y-4 rounded-lg border border-dash-border bg-dash-card p-5">
      {hasSavedPlatformPreference && selectedPlatformCard ? (
        <>
          <WizardPlatformCompactBar
            icon={
              selectedPlatformCard === "META" ? (
                <MetaAdsBrandIcon />
              ) : selectedPlatformCard === "GOOGLE" ? (
                <GoogleAdsBrandIcon />
              ) : (
                <TikTokAdsBrandIcon />
              )
            }
            heading={
              selectedPlatformCard === "META"
                ? "Meta Ads"
                : selectedPlatformCard === "GOOGLE"
                  ? "Google Ads"
                  : "TikTok Ads"
            }
            description={wizardPlatformImportDescription(selectedPlatformCard)}
            expanded={platformPickerExpanded}
            onToggle={() => setPlatformPickerExpanded((open) => !open)}
          />
          {platformPickerExpanded ? (
            <div className="space-y-3 border-t border-dash-border pt-4">
              <p className="text-[13px] text-dash-ink-secondary">Switch to a different platform</p>
              <WizardPlatformPickerGrid
                showTikTokOption={showTikTokOption}
                selectedPlatformCard={selectedPlatformCard}
                onChoosePlatform={choosePlatform}
                onChooseWebsitePlatform={chooseWebsitePlatform}
              />
            </div>
          ) : null}
        </>
      ) : (
        <>
          <h3 className="text-[16px] font-semibold text-white">Select platform</h3>
          <WizardPlatformPickerGrid
            showTikTokOption={showTikTokOption}
            selectedPlatformCard={selectedPlatformCard}
            onChoosePlatform={choosePlatform}
            onChooseWebsitePlatform={chooseWebsitePlatform}
          />
        </>
      )}

      {selectedPlatformCard && isPlatformBeta(selectedPlatformCard) ? (
        <PlatformBetaNotice platform={selectedPlatformCard} />
      ) : null}

      {selectedPlatformCard && (
        <div className="space-y-3">
          {AD_PLATFORM_API_SYNC_ENABLED ? (
            <WizardDataSourceToggle value={dataSourceMode} onChange={handleDataSourceModeChange} />
          ) : null}

          {AD_PLATFORM_API_SYNC_ENABLED && importPipelineLabel ? (
            <p className="rounded-md border border-dash-border bg-[#0d1b2e]/60 px-3 py-2 text-[14px] text-dash-ink-secondary">
              {importPipelineLabel}
            </p>
          ) : null}

          {AD_PLATFORM_API_SYNC_ENABLED && dataSourceMode === "api" ? (
            <WizardDataSourcePanel
              clientId={clientId}
              platform={selectedPlatformCard}
              metaConnected={metaConnected}
              metaConnectedName={metaConnectedName}
              metaConfigured={metaConfigured}
              googleAdsConfigured={googleAdsConfigured}
              googleAdsConnected={googleAdsConnected}
              tiktokConfigured={tiktokConfigured}
              tiktokConnected={tiktokConnected}
              onSynced={(file, meta) => void handleApiSynced(file, meta)}
              syncStatus={apiSyncStatus}
              syncError={apiSyncError}
              onSyncStart={() => {
                setApiSyncStatus("loading");
                setApiSyncError(null);
              }}
              onSyncError={(message) => {
                setApiSyncStatus("error");
                setApiSyncError(message);
              }}
              importComplete={false}
            />
          ) : null}

          {AD_PLATFORM_API_SYNC_ENABLED && dataSourceMode === "api" && metaSyncDiagnostics ? (
            <div
              className={`rounded-lg border px-4 py-3 ${
                metaSyncDiagnostics.mappedResultsSum > 0
                  ? "border-emerald-500/35 bg-[#0d1b2e]/80"
                  : "border-amber-500/40 bg-amber-950/20"
              }`}
            >
              <p className="text-[14px] font-medium text-white">API sync diagnostics</p>
              <p className="mt-2 text-[13px] leading-relaxed text-dash-ink-secondary">
                This is the same file as the auto-download and &quot;Download API sync CSV&quot; — name like{" "}
                <span className="font-mono text-dash-ink">meta-api-sync-YYYY-MM-DD.csv</span> (CSV, not Excel). Check
                columns <span className="text-dash-ink">Result type</span>, <span className="text-dash-ink">Results</span>
                , <span className="text-dash-ink">Website leads</span> — not spend/reach only.
              </p>
              <ul className="mt-2 space-y-1 text-[13px] text-dash-ink-secondary">
                <li>
                  Mapped Results total:{" "}
                  <span className="font-semibold text-white">{metaSyncDiagnostics.mappedResultsSum}</span>
                </li>
                <li>
                  Rows: {metaSyncDiagnostics.rowCount} · Meta sent{" "}
                  <span className="text-dash-ink">results[]</span> on {metaSyncDiagnostics.rowsWithResultsField} ·{" "}
                  <span className="text-dash-ink">objective_results[]</span> on{" "}
                  {metaSyncDiagnostics.rowsWithObjectiveResultsField} · pixel in{" "}
                  <span className="text-dash-ink">actions[]</span> on {metaSyncDiagnostics.rowsWithPixelInActions}
                </li>
                {metaSyncDiagnostics.deployCommit ? (
                  <li>
                    Deploy commit:{" "}
                    <span className="font-mono text-dash-ink">{metaSyncDiagnostics.deployCommit}</span>
                  </li>
                ) : null}
              </ul>
              {metaSyncDiagnostics.mappedResultsSum === 0 ? (
                <p className="mt-2 text-[13px] text-amber-200">
                  If all three Meta conversion counts above are 0, the API is not returning conversion fields for this
                  token/account — mapper changes cannot invent Results. If they are &gt; 0 but total is still 0, open a
                  support ticket with this screen.
                </p>
              ) : null}
            </div>
          ) : null}

          {AD_PLATFORM_API_SYNC_ENABLED && dataSourceMode === "api" && mtdFile && isApiSyncArtifact(mtdFile) ? (
            <div className="rounded-lg border border-emerald-500/35 bg-[#0d1b2e]/80 px-4 py-3">
              <p className="text-[14px] font-medium text-white">API sync complete</p>
              <button
                type="button"
                onClick={() => downloadWizardCsvFile(mtdFile)}
                className="mt-3 inline-flex h-10 items-center rounded-md border border-emerald-500/50 bg-emerald-500/10 px-4 text-[14px] font-semibold text-emerald-300 hover:bg-emerald-500/20"
              >
                Download API sync CSV
              </button>
            </div>
          ) : null}

          {(!AD_PLATFORM_API_SYNC_ENABLED || dataSourceMode === "csv") && (
            <>
              <UploadDropzone file={mtdFile} onFileSelected={handleMtdFileSelected} />
              <p className="rounded-lg border border-[#f6ad55]/40 bg-[#1e293b] px-4 py-3.5 text-[14px] leading-relaxed text-dash-ink">
                <a
                  href="https://nextreport.in/help/download"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mb-1 block text-[15px] font-semibold text-[#f6ad55] underline decoration-[#f6ad55]/50 underline-offset-2 hover:text-[#fbd38d]"
                >
                  How to download your CSV
                </a>
                {selectedPlatformCard === "META" ? (
                  <span className="block text-[#e2e8f0]">{getMetaCsvDownloadTip(new Date(), clientTimezone)}</span>
                ) : selectedPlatformCard === "TIKTOK" ? (
                  <span className="block text-[#e2e8f0]">
                    Export Last 30 days with Day breakdown from TikTok Ads Manager — include Campaign, Ad group, Cost,
                    Impressions, Clicks, and Conversions.
                  </span>
                ) : (
                  "Set date range to Last 30 days and segment by Day."
                )}
              </p>

              <button
                type="button"
                onClick={() => void handleAnalyze()}
                disabled={!mtdFile || analyzeStatus === "loading"}
                className="h-12 w-full rounded-md bg-dash-accent text-[15px] font-semibold text-dash-ink hover:bg-dash-accent-hover disabled:opacity-40"
              >
                {analyzeStatus === "loading" ? "Analyzing…" : "Analyze campaign data"}
              </button>
            </>
          )}

          {showCompactPreviousMonth ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dash-border bg-dash-bg/60 px-4 py-3">
              <p className="text-[14px] text-dash-ink-secondary">
                <span className="font-medium text-emerald-400">{previousMonthInfo.expectedMonthName} on file ✓</span>
                {" · "}
                <Link
                  href={`/clients/${clientId}#previous-month-data`}
                  className="font-medium text-dash-accent hover:underline"
                >
                  Manage
                </Link>
              </p>
              <label className="flex cursor-pointer items-center gap-2">
                <span className="text-[12px] font-medium text-dash-ink-secondary">Include in report</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={includePreviousMonthComparison}
                  onClick={() => setIncludePreviousMonthComparison(!includePreviousMonthComparison)}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                    includePreviousMonthComparison ? "bg-dash-accent" : "bg-dash-border"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      includePreviousMonthComparison ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </label>
            </div>
          ) : (
            <PreviousMonthDataWizardPanel
              clientId={clientId}
              clientTimezone={clientTimezone}
              currencySymbol={currencySymbol}
              initialHasFile={previousMonthHasFile}
              initialUpdatedAt={previousMonthUpdatedAt}
              initialCampaigns={previousMonthCampaigns}
              initialSelectedCampaigns={previousMonthSelectedCampaigns}
              initialCampaignSpend={previousMonthCampaignSpend}
              includeInReport={includePreviousMonthComparison}
              onIncludeInReportChange={setIncludePreviousMonthComparison}
              onUploaded={(meta) => {
                setPreviousMonthHasFile(true);
                setPreviousMonthUpdatedAt(new Date().toISOString());
                if (meta) {
                  setPreviousMonthCampaigns(meta.campaigns);
                  setPreviousMonthSelectedCampaigns(meta.selectedCampaigns);
                  if (meta.campaignSpend) setPreviousMonthCampaignSpend(meta.campaignSpend);
                }
              }}
              onCampaignsChange={(meta) => {
                setPreviousMonthCampaigns(meta.campaigns);
                setPreviousMonthSelectedCampaigns(meta.selectedCampaigns);
              }}
            />
          )}
        </div>
      )}

      {mismatchWarning && (
        <div className="space-y-2 rounded-md border border-amber-900 bg-amber-950/30 p-3">
          <p className="text-[14px] text-amber-200">
            This looks like a{" "}
            {detectedPlatform === "GOOGLE"
              ? "Google Ads"
              : detectedPlatform === "TIKTOK"
                ? "TikTok Ads"
                : "Meta Ads"}{" "}
            CSV, but you selected{" "}
            {selectedPlatformCard === "GOOGLE"
              ? "Google Ads"
              : selectedPlatformCard === "TIKTOK"
                ? "TikTok Ads"
                : "Meta Ads"}{" "}
            above.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleMismatchContinueAnyway}
              disabled={continueStatus === "loading"}
              className="rounded-md bg-dash-accent px-3 py-1.5 text-[14px] font-medium text-dash-ink hover:bg-dash-accent-hover disabled:opacity-50"
            >
              {continueStatus === "loading" ? "Loading…" : "Continue anyway"}
            </button>
            <button
              onClick={handleMismatchGoBack}
              className="rounded-md border border-dash-border px-3 py-1.5 text-[14px] text-dash-ink-secondary hover:bg-dash-border"
            >
              Go back
            </button>
          </div>
        </div>
      )}

      {analyzeStatus === "invalid" && (
        <div className="space-y-3">
          {analyzeErrors.filter(isNoDataRowsError).map((e, i) =>
            previousMonthHasFile ? (
              <PreviousMonthSummaryOption
                key={i}
                status={pmsStatus}
                error={pmsError}
                result={pmsResult}
                onGenerate={handleGeneratePreviousMonthSummary}
                onCancel={handleCancelPreviousMonthSummary}
              />
            ) : (
              <NoDataRowsWarning key={i} message={e.message} />
            ),
          )}
          {analyzeErrors.filter(isSpecificFieldError).map((e, i) => (
            <SpecificFieldWarning key={i} message={e.message} />
          ))}
          {analyzeErrors.some((e) => !isNoDataRowsError(e) && !isSpecificFieldError(e)) && (
            <div className="rounded-lg border border-red-900 bg-red-950/40 p-4">
              <p className="mb-2 text-[14px] font-medium text-red-300">
                This CSV can&apos;t be used to generate a report yet:
              </p>
              <ul className="list-inside list-disc space-y-1 text-[14px] text-red-300">
                {analyzeErrors.filter((e) => !isNoDataRowsError(e) && !isSpecificFieldError(e)).map((e, i) => (
                  <li key={i}>{e.message}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      {analyzeStatus === "error" && analyzeMessage && (
        <div className="rounded-lg border border-red-900 bg-red-950/40 p-4 text-[14px] text-red-300">{analyzeMessage}</div>
      )}
    </div>
  );
}
