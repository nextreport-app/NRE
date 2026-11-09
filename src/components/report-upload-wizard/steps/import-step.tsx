"use client";
import { WeeklyPeriodControls } from "../ui/weekly-period-controls";
import { metaApiImportRange, type MetaApiReportSelection } from "@/lib/nre/meta-api-import-range";
import { ReportPeriodControls } from "../ui/report-period-controls";

import { useWizardContext } from "../wizard-context";
import { WizardImportDownloadInstructions } from "../ui/wizard-import-download-instructions";
import Link from "next/link";
import { PreviousMonthDataWizardPanel } from "@/components/previous-month-data-wizard-panel";
import { isWizardApiSyncVisible } from "@/lib/ad-platform-api-sync";
import { WizardDataSourcePanel, WizardDataSourceToggle } from "@/components/wizard-data-source-panel";
import { MetaAdsBrandIcon, GoogleAdsBrandIcon, TikTokAdsBrandIcon } from "@/components/platform-brand-icons";
import { getPreviousMonthComparisonInfo } from "@/lib/nre/previous-month-data-status";
import {
  wizardPlatformImportDescription,
  isNoDataRowsError,
  isSpecificFieldError,
} from "../utils";
import { SpecificFieldWarning } from "../ui/specific-field-warning";
import { NoDataRowsWarning, PreviousMonthSummaryOption } from "../ui/warnings";
import { WizardPlatformCompactBar, WizardPlatformPickerGrid } from "../ui/platform-picker";
import { PlatformBetaNotice } from "@/components/platform-beta-badge";
import { isPlatformBeta } from "@/lib/platform-beta";
import { isWizardPlatformSwitchEnabled } from "@/lib/meta-launch-scope";
import { UploadDropzone } from "../ui/upload-dropzone";
import { WizardReportSetupPanel } from "../ui/wizard-report-setup-panel";
import { CsvDateGuidanceBanner } from "../ui/csv-date-guidance-banner";

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
    handleRetryAnalyze,
    handleApiSynced,
    handleCancelPreviousMonthSummary,
    handleDataSourceModeChange,
    handleGeneratePreviousMonthSummary,
    handleMismatchContinueAnyway,
    handleMismatchGoBack,
    handleMtdFileSelected,
    hasSavedPlatformPreference,
    includePreviousMonthComparison,
    metaConfigured,
    metaConnected,
    metaConnectedName,
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
    reportType,
    handleReportTypeChange,
    reportTypeLabel,
    csvDateGuidance,
    csvWarningDismissed,
    setCsvWarningDismissed,
    setCsvDateGuidance,
  } = w;

  const previousMonthInfo = getPreviousMonthComparisonInfo(
    previousMonthHasFile,
    previousMonthUpdatedAt,
    clientTimezone,
  );
  const showCompactPreviousMonth =
    previousMonthInfo.status === "current" && !includePreviousMonthComparison;
  const platformSwitchEnabled = isWizardPlatformSwitchEnabled();

  const setupPlatform = selectedPlatformCard ?? "META";

  const reportTypeSetup = <WizardReportSetupPanel source={dataSourceMode} reportType={reportType} reportTypeLabel={reportTypeLabel()} platform={setupPlatform} clientTimezone={clientTimezone} onReportTypeChange={handleReportTypeChange} />;
  const reportPeriods = <>
    <ReportPeriodControls />
    {reportType === "WEEKLY" ? <WeeklyPeriodControls /> : null}
  </>;
  const reportSetup = <>{reportTypeSetup}{reportPeriods}</>;
  const apiSelection: MetaApiReportSelection = {
    reportType, dateSelection: w.dateMode === "custom" ? { mode: "custom", customStart: w.customStart, customEnd: w.customEnd } : { mode: w.dateMode },
    comparisonPeriodA: w.comparisonPeriodA ?? undefined, comparisonPeriodB: w.comparisonPeriodB ?? undefined, historicalMonthCount: w.historicalMonthCount,
  };
  let apiSelectionError: string | null = null;
  try { metaApiImportRange(apiSelection, new Date(), clientTimezone); }
  catch (error) { apiSelectionError = error instanceof Error ? error.message : "Choose valid dates."; }

  return (
    <fieldset disabled={apiSyncStatus === "loading" || analyzeStatus === "loading"} className="min-w-0 space-y-4 rounded-xl border border-dash-border bg-dash-card p-5 shadow-sm">
      {selectedPlatformCard && (hasSavedPlatformPreference || !platformSwitchEnabled) ? (
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
            description={dataSourceMode === "api" ? "Import campaign data from your Meta ad account" : wizardPlatformImportDescription(selectedPlatformCard)}
            expanded={platformPickerExpanded}
            onToggle={() => setPlatformPickerExpanded((open) => !open)}
            allowPlatformChange={platformSwitchEnabled}
          />
          {platformSwitchEnabled && platformPickerExpanded ? (
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
          <h3 className="text-[16px] font-semibold text-dash-ink">Select platform</h3>
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
          {isWizardApiSyncVisible() && <WizardDataSourceToggle
            value={dataSourceMode}
            onChange={handleDataSourceModeChange}
            apiUnavailable={!w.apiSyncEnabled}
            compact={w.hasSavedImportSource}
          />}
          {isWizardApiSyncVisible() && !w.apiSyncEnabled && dataSourceMode === "api" ? (
            <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[13px] text-amber-100/90">
              <span className="font-semibold text-amber-300">API sync is temporarily unavailable.</span> Use Manual CSV upload to continue.
            </p>
          ) : null}

          {dataSourceMode === "csv" ? reportSetup : null}

          {dataSourceMode === "csv" && <WizardImportDownloadInstructions
            clientId={clientId}
            reportType={reportType}
            platform={selectedPlatformCard}
            clientTimezone={clientTimezone}
          />}

          {w.apiSyncEnabled && dataSourceMode === "api" ? (
            <WizardDataSourcePanel
              clientId={clientId}
              reportSelection={apiSelection}
              clientTimezone={clientTimezone}
              onTimezoneUpdated={w.updateApiTimezone}
              selectionError={apiSelectionError}
              reportTypeControls={reportTypeSetup}
              setupControls={reportPeriods}
              platform={selectedPlatformCard}
              metaConnected={metaConnected}
              metaConnectedName={metaConnectedName}
              metaConfigured={metaConfigured}
              googleAdsConfigured={googleAdsConfigured}
              googleAdsConnected={googleAdsConnected}
              tiktokConfigured={tiktokConfigured}
              tiktokConnected={tiktokConnected}
              onSynced={handleApiSynced}
              syncStatus={analyzeStatus === "loading" ? "loading" : apiSyncStatus}
              syncError={apiSyncError || (w.metaConnectError ? "Meta connection could not be completed. Try connecting again." : null)}
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

          {(!w.apiSyncEnabled || dataSourceMode === "csv") && (
            <>
              <UploadDropzone file={mtdFile} onFileSelected={handleMtdFileSelected} disabled={analyzeStatus === "loading" || apiSyncStatus === "loading"} />

              {w.reportType === "WEEKLY" && csvDateGuidance && csvDateGuidance.warnings.length > 0 && !csvWarningDismissed ? (
                <CsvDateGuidanceBanner
                  guidance={csvDateGuidance}
                  onContinue={() => setCsvWarningDismissed(true)}
                  onRedownload={() => {
                    setCsvWarningDismissed(false);
                    setCsvDateGuidance(null);
                  }}
                />
              ) : null}

              <button
                type="button"
                onClick={() => void handleAnalyze()}
                disabled={!mtdFile || analyzeStatus === "loading"}
                className="h-12 w-full rounded-md bg-dash-accent text-[15px] font-semibold text-[#0d1b2e] hover:bg-dash-accent-hover disabled:opacity-40"
              >
                {analyzeStatus === "loading" ? "Analyzing…" : "Analyze campaign data"}
              </button>
            </>
          )}

          {dataSourceMode === "csv" && reportType === "WEEKLY" && (showCompactPreviousMonth ? (
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
          ))}
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
        <div className="space-y-3 rounded-lg border border-red-900 bg-red-950/40 p-4">
          <p className="text-[14px] text-red-300">{analyzeMessage}</p>
          {mtdFile ? (
            <>
              <p className="text-[13px] text-red-200/90">
                Your file is still selected — retry analyze without re-uploading.
              </p>
              <button
                type="button"
                onClick={handleRetryAnalyze}
                className="rounded-md bg-dash-accent px-4 py-2 text-[14px] font-semibold text-dash-ink hover:bg-dash-accent-hover"
              >
                Retry analyze
              </button>
            </>
          ) : null}
        </div>
      )}
    </fieldset>
  );
}
