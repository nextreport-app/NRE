"use client";

import { useEffect, useState } from "react";
import { useWizardContext } from "../wizard-context";
import Link from "next/link";
import { TEMPLATE_LABELS } from "@/lib/validators/client";
import { usesFullAdWizard } from "@/lib/nre/platform-labels";
import { WizardPlatformSummaryLabel } from "@/components/wizard-platform-banner";
import { NoDataRowsWarning, PreviousMonthSummaryOption } from "../ui/warnings";
import { SpecificFieldWarning } from "../ui/specific-field-warning";
import {
  defaultReportTitleFor,
  formatIso,
  formatIsoRange,
  formatSummaryRange,
  isNoDataRowsError,
  isSpecificFieldError,
} from "../utils";
import { WeeklyPeriodOption } from "../ui/weekly-period-option";
import { WizardDateRangeFields } from "../ui/wizard-date-picker";
import { Spinner } from "../ui/icons";
import { WizardStickyFooter } from "../ui/wizard-sticky-footer";
import { META_HYBRID_API_CSV_IMPORT_NOTE } from "@/lib/nre/meta-api-sync/hybrid-import-note";
import { CsvVerificationPanel } from "../ui/csv-verification-panel";
import { SupportTicketLink } from "@/components/support-ticket-link";
import { WizardFeedbackLink } from "../ui/wizard-feedback-link";
import { WhatsAppChatLink } from "@/components/whatsapp-chat-link";
import { useWizardCopy } from "@/hooks/use-wizard-copy";
import { WizardReportBrandingPanel } from "../ui/wizard-report-branding-panel";
import { WizardCoverBudgetSection } from "../ui/wizard-cover-budget-section";
import { WizardGenerateSuccessPanel } from "../ui/wizard-generate-success-panel";

export function WizardGenerateStep() {
  const copy = useWizardCopy();
  const w = useWizardContext();

  const stepActive = w.step === 4;

  const {
    budgetToggleSaving,
    clientId,
    clientMonthlyBudget,
    clientName,
    clientTemplate,
    comparisonData,
    comparisonPeriodA,
    comparisonPeriodB,
    comparisonPreset,
    copied,
    clientShareMessageCopied,
    shareLinkCopied,
    generatedAt,
    handleCopyClientShareMessage,
    coverBudgetPacingWarning,
    coverBudgetPreviewLine,
    customEnd,
    customRangeError,
    customStart,
    dailyRange,
    data,
    dateBounds,
    dateMode,
    downloadUrl,
    driveDisplayLabel,
    driveFolderLinkInput,
    driveFolderNameInput,
    driveLinkFormatError,
    driveSaveError,
    driveSaveUrl,
    driveSaving,
    driveView,
    estimatedSlideCount,
    formatIso,
    formatIsoRange,
    formatSummaryRange,
    apiSyncHybridImport,
    generateMessage,
    generateStatus,
    handleCancelPreviousMonthSummary,
    handleComparisonPresetSelect,
    handleCopyLink,
    handleCopyShareLink,
    handleGenerate,
    handleGenerateStepPrimary,
    handleGenerateAnother,
    generatedWithCsvMismatch,
    handleGeneratePreviousMonthSummary,
    handleSaveButtonClick,
    clientTimezone,
    handleSaveToFolderLink,
    handleShowBudgetOnCoverChange,
    hasAdLevelCsv,
    hasGoogleDriveConnected,
    dayBreakdownData,
    historicalData,
    historicalMonthCount,
    historicalMonthLabels,
    includePreviousMonthComparison,
    mtdRange,
    needsLongRangeConfirm,
    persistGenerateSnapshot,
    platform,
    pmsError,
    pmsResult,
    pmsStatus,
    previewErrors,
    previewKind,
    previewMessage,
    previewStatus,
    previewRefreshing,
    generateStepPreviewReady,
    csvVerification,
    previousMonthComparisonReady,
    previousMonthHasFile,
    publishedAt,
    rememberedFolder,
    reportId,
    reportSummaryExpanded,
    reportType,
    reportTypeLabel,
    setCustomEnd,
    setCustomRangeError,
    setCustomStart,
    editCustomEnd,
    editCustomStart,
    editDateMode,
    setDateMode,
    setDriveFolderLinkInput,
    setDriveFolderNameInput,
    setDriveLinkFormatError,
    setDriveSaveError,
    setDriveSaveUrl,
    setDriveView,
    setHistoricalMonthCount,
    editHistoricalMonthCount,
    setLongRangeConfirmed,
    setReportSummaryExpanded,
    setStep,
    shareToken,
    showBudgetOnCover,
    spanDays,
    summaryCampaignNames,
    updateComparisonPeriodA,
    updateComparisonPeriodB,
    weeklyOptions,
    weeklyPeriodSummaryLabel,
    weeklyRangeIso,
    reportPeriodConfirmationLine,
    reportPeriodConfirmationBullets,
    wizardSharePlatformLabel,
    driveDateRangeLabel,
    happyPathSkippedSteps,
    agencyName,
    reportBrandingMode,
    reportBrandingError,
    reportBrandingBlocksGenerate,
  } = w;

  const periodConfirmation = reportPeriodConfirmationLine();
  const periodConfirmationBullets = reportPeriodConfirmationBullets();
  const slideCount = estimatedSlideCount();

  const weeklyPeriodNeedsAttention =
    reportType === "WEEKLY" &&
    (dateMode === "custom" || Boolean(customRangeError) || needsLongRangeConfirm);
  const [weeklyPeriodExpanded, setWeeklyPeriodExpanded] = useState(false);

  useEffect(() => {
    if (weeklyPeriodNeedsAttention) setWeeklyPeriodExpanded(true);
  }, [weeklyPeriodNeedsAttention]);

  const showWeeklyPeriodEditor =
    reportType === "WEEKLY" && (weeklyPeriodNeedsAttention || weeklyPeriodExpanded);

  if (!stepActive) return null;

  const showGenerateFooter = generateStatus === "idle" || generateStatus === "loading" || generateStatus === "error";
  const csvMismatchActive =
    generateStepPreviewReady &&
    generateStatus === "idle" &&
    csvVerification?.status === "mismatch";
  const generateCtaDisabled =
    previewStatus === "invalid" ||
    (previewStatus !== "error" && !generateStepPreviewReady) ||
    reportBrandingBlocksGenerate ||
    previewRefreshing;
  const generateCtaLabel =
    generateStatus === "loading"
      ? "Generating…"
      : generateStatus === "error"
        ? "Try again"
        : previewStatus === "loading" || previewRefreshing
          ? "Loading report options…"
          : !generateStepPreviewReady
            ? previewStatus === "invalid"
              ? "Fix options above"
              : previewStatus === "error"
                ? "Retry preview"
                : previewStatus === "idle"
                  ? "Choose dates above"
                  : "Loading report options…"
            : csvMismatchActive
              ? copy.generateForInternalReview
              : copy.generateReport;
  const showStandardCoverBudget =
    reportType !== "COMPARISON" && reportType !== "HISTORICAL" && reportType !== "DAY_BREAKDOWN";
  const showGenerateSuccess = generateStatus === "done" && !!downloadUrl;

  if (showGenerateSuccess) {
    return (
      <div className="space-y-6">
        <WizardGenerateSuccessPanel
          clientName={clientName}
          clientId={clientId}
          generatedWithCsvMismatch={generatedWithCsvMismatch}
          reportId={reportId}
          reportTitle={defaultReportTitleFor(reportType)}
          reportType={reportType}
          reportTypeLabel={reportTypeLabel()}
          wizardSharePlatformLabel={wizardSharePlatformLabel()}
          slideCount={slideCount}
          dateRangeLabel={driveDateRangeLabel()}
          downloadUrl={downloadUrl}
          shareToken={shareToken}
          publishedAt={publishedAt}
          generatedAt={generatedAt}
          clientShareMessageCopied={clientShareMessageCopied}
          shareLinkCopied={shareLinkCopied}
          onCopyClientShareMessage={handleCopyClientShareMessage}
          onCopyShareLink={handleCopyShareLink}
          persistGenerateSnapshot={persistGenerateSnapshot}
          hasGoogleDriveConnected={hasGoogleDriveConnected}
          driveView={driveView}
          driveSaving={driveSaving}
          handleSaveButtonClick={handleSaveButtonClick}
          rememberedFolder={rememberedFolder}
          setDriveView={setDriveView}
          onEditDriveFolder={() => {
            setDriveSaveError(null);
            setDriveView("editing");
          }}
          copied={copied}
          driveSaveUrl={driveSaveUrl}
          handleCopyLink={handleCopyLink}
          handleGenerateAnother={handleGenerateAnother}
        >
          {hasGoogleDriveConnected && driveView === "editing" && (
            <div className="space-y-3 rounded-lg border border-dash-border bg-dash-card p-4">
              <div>
                <label className="block text-[14px] text-dash-ink-secondary">Folder link:</label>
                <input
                  type="text"
                  value={driveFolderLinkInput}
                  onChange={(e) => {
                    setDriveFolderLinkInput(e.target.value);
                    setDriveLinkFormatError(null);
                  }}
                  placeholder="https://drive.google.com/drive/folders/1ABC123xyz"
                  className="mt-1 w-full rounded-md border border-dash-border bg-dash-bg px-3 py-2 text-[14px] text-dash-ink outline-none focus:border-dash-accent"
                />
                <p className="mt-1 text-[14px] text-dash-ink-secondary">
                  Open Google Drive → navigate to your folder → right-click → Get link → Copy link → paste it here
                </p>
                {driveLinkFormatError ? <p className="mt-1 text-[14px] text-red-400">{driveLinkFormatError}</p> : null}
              </div>

              <div>
                <label className="block text-[14px] text-dash-ink-secondary">
                  Folder name <span className="text-dash-ink-secondary">— optional, but recommended</span>:
                </label>
                <input
                  type="text"
                  value={driveFolderNameInput}
                  onChange={(e) => setDriveFolderNameInput(e.target.value)}
                  placeholder="e.g. Reports"
                  className="mt-1 w-full rounded-md border border-dash-border bg-dash-bg px-3 py-2 text-[14px] text-dash-ink outline-none focus:border-dash-accent"
                />
                <p className="mt-1 text-[14px] text-dash-ink-secondary">
                  Type a name to help you identify this folder — shown as &quot;Saving to: ...&quot; next time.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleSaveToFolderLink}
                  disabled={!driveFolderLinkInput.trim() || driveSaving}
                  className="rounded-md bg-dash-accent px-4 py-2 text-[14px] font-medium text-dash-ink hover:bg-dash-accent-hover disabled:opacity-50"
                >
                  {driveSaving ? "Saving…" : "Save to this folder"}
                </button>
                <button
                  type="button"
                  disabled={driveSaving}
                  onClick={() => {
                    setDriveView("collapsed");
                    setDriveFolderLinkInput("");
                    setDriveFolderNameInput("");
                    setDriveLinkFormatError(null);
                    setDriveSaveError(null);
                  }}
                  className="rounded-md border border-dash-border px-3 py-2 text-[14px] text-dash-ink-secondary hover:bg-dash-border disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {driveSaveError ? <p className="text-[14px] text-red-400">{driveSaveError}</p> : null}

          {driveView === "success" && driveSaveUrl ? (
            <div className="rounded-lg border border-emerald-800 bg-emerald-950/30 p-4">
              <p className="mb-2 text-[14px] uppercase tracking-wide text-emerald-300">Saved to Google Drive ✓</p>
              <a
                href={driveSaveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block break-all text-[14px] text-dash-accent hover:underline"
              >
                {driveDisplayLabel()}
              </a>
              <button
                onClick={() => {
                  setDriveView("editing");
                  setDriveSaveUrl(null);
                }}
                className="mt-3 text-[14px] text-dash-ink-secondary hover:underline"
              >
                Save to a different folder
              </button>
            </div>
          ) : null}

          {reportType !== "COMPARISON" &&
          reportType !== "HISTORICAL" &&
          reportType !== "DAY_BREAKDOWN" &&
          includePreviousMonthComparison &&
          !previousMonthComparisonReady ? (
            <div className="rounded-lg border border-dash-border border-l-4 border-l-dash-accent bg-dash-card p-4 text-[14px] text-dash-ink">
              <p className="font-semibold">Previous month comparison not set up</p>
              <p className="mt-1 text-dash-ink-secondary">
                Combined Total won&apos;t include a previous-month row.{" "}
                <Link href={`/clients/${clientId}#previous-month-data`} className="text-dash-accent hover:underline">
                  Upload on the client page
                </Link>{" "}
                or add it when you start your next report.
              </p>
            </div>
          ) : null}
        </WizardGenerateSuccessPanel>
      </div>
    );
  }

  return (
        <div className={`space-y-6 ${showGenerateFooter ? "pb-28 md:pb-6" : ""}`}>
          {usesFullAdWizard(platform) && (
            <div className="space-y-5">
            {happyPathSkippedSteps ? (
              <div className="rounded-lg border border-dash-accent/30 bg-dash-accent/5 px-4 py-3">
                <p className="text-[14px] font-semibold text-dash-ink">{copy.happyPathBannerTitle}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-dash-ink-secondary">{copy.happyPathBannerBody}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="rounded-md border border-dash-border bg-dash-card px-3 py-1.5 text-[13px] font-medium text-dash-ink hover:bg-dash-sidebar"
                  >
                    {copy.happyPathReviewCampaigns}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="rounded-md border border-dash-border bg-dash-card px-3 py-1.5 text-[13px] font-medium text-dash-ink hover:bg-dash-sidebar"
                  >
                    {copy.happyPathReviewMetrics}
                  </button>
                </div>
              </div>
            ) : null}

            {reportType === "HISTORICAL" && (
              <section className="rounded-lg border border-dash-border bg-dash-card p-5">
                <h4 className="text-[15px] font-semibold text-dash-ink">Historical months</h4>
                <div className="mt-3 space-y-3">
                  <label className="block text-[14px] text-dash-ink-secondary">
                    How many complete prior months?
                    <select
                      value={historicalMonthCount}
                      onChange={(e) => editHistoricalMonthCount(Number(e.target.value))}
                      className="mt-2 block w-full max-w-xs rounded-md border border-dash-border bg-dash-sidebar px-3 py-2 text-[14px] text-dash-ink"
                    >
                      {[2, 3, 4, 5, 6, 8, 12].map((n) => (
                        <option key={n} value={n}>
                          Last {n} months
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="text-[14px] text-dash-ink-secondary">
                    Months: <span className="text-dash-ink">{historicalMonthLabels.join(" · ")}</span>
                  </p>
                  {dateBounds && (
                    <p className="text-[14px] text-dash-ink-muted">
                      CSV must cover {formatIso(dateBounds.minIso)} – {formatIso(dateBounds.maxIso)}.
                    </p>
                  )}
                </div>
              </section>
            )}
            {reportType === "DAILY" && dailyRange && (
              <p className="text-[14px] text-dash-ink-secondary">
                Reporting on <span className="text-dash-ink">{formatIsoRange(dailyRange)}</span>.
              </p>
            )}

          {showWeeklyPeriodEditor ? (
            <section className="rounded-lg border border-dash-border bg-dash-card p-4">
              <h4 className="text-[15px] font-semibold text-dash-ink">Report period</h4>
              <p className="mt-1 text-[13px] leading-snug text-dash-ink-secondary">
                Default is last 7 days in your CSV. Change here only if you need a different week.
              </p>
              <div className="mt-4 space-y-4">
                <div className="flex flex-wrap gap-3">
                  {weeklyOptions ? (
                    <WeeklyPeriodOption
                      selected={dateMode === "last7"}
                      label="Last 7 days"
                      sublabel={formatIsoRange(weeklyOptions.last7)}
                      onSelect={() => {
                        editDateMode("last7");
                        setCustomRangeError(null);
                        setWeeklyPeriodExpanded(false);
                      }}
                    />
                  ) : null}
                  <WeeklyPeriodOption
                    selected={dateMode === "custom"}
                    label="Custom date range"
                    sublabel={
                      dateBounds
                        ? `${formatIso(dateBounds.minIso)} – ${formatIso(dateBounds.maxIso)}`
                        : "Pick any start and end date in your CSV"
                    }
                    onSelect={() => {
                      editDateMode("custom");
                      setWeeklyPeriodExpanded(true);
                    }}
                  />
                </div>

                {dateMode === "custom" ? (
                  <div className="space-y-3 rounded-lg border border-dash-border nre-wizard-panel p-4">
                    <WizardDateRangeFields
                      startIso={customStart}
                      endIso={customEnd}
                      minIso={dateBounds?.minIso}
                      maxIso={dateBounds?.maxIso}
                      onStartChange={(iso) => editCustomStart(iso)}
                      onEndChange={(iso) => editCustomEnd(iso)}
                    />

                    {customRangeError ? <p className="text-[14px] text-red-400">{customRangeError}</p> : null}

                    {needsLongRangeConfirm ? (
                      <div className="rounded-md border border-amber-900 bg-amber-950/30 p-3">
                        <p className="mb-2 text-[14px] text-amber-200">
                          You selected {spanDays} days. Weekly reports read best at 7 days or less — continue with this
                          longer period anyway?
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setLongRangeConfirmed(true)}
                            className="rounded-md bg-dash-accent px-3 py-1 text-[14px] font-medium text-dash-ink hover:bg-dash-accent-hover"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setCustomEnd("")}
                            className="rounded-md border border-dash-border px-3 py-1 text-[14px] text-dash-ink-secondary hover:bg-dash-border"
                          >
                            No
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          {reportType === "DAY_BREAKDOWN" && (
            <section className="rounded-lg border border-dash-border bg-dash-card p-5">
              <h4 className="text-[16px] font-semibold text-dash-ink">Select date range</h4>
              <div className="mt-4 space-y-3 rounded-lg border border-dash-border nre-wizard-panel p-4">
                <p className="text-[14px] text-dash-ink-secondary">
                  Pick any range covered by your day-level CSV
                  {dateBounds
                    ? ` (${formatIso(dateBounds.minIso)} – ${formatIso(dateBounds.maxIso)})`
                    : ""}
                  .
                </p>
                <WizardDateRangeFields
                  startIso={customStart}
                  endIso={customEnd}
                  minIso={dateBounds?.minIso}
                  maxIso={dateBounds?.maxIso}
                  onStartChange={(iso) => {
                    editDateMode("custom");
                    editCustomStart(iso);
                  }}
                  onEndChange={(iso) => {
                    editDateMode("custom");
                    editCustomEnd(iso);
                  }}
                />
                {customRangeError ? <p className="text-[14px] text-red-400">{customRangeError}</p> : null}
              </div>
            </section>
          )}

          {/* Section 2 (Comparison variant) — Period A/B presets (A1) */}
          {reportType === "COMPARISON" && (
            <section className="rounded-lg border border-dash-border bg-dash-card p-5">
              <h4 className="text-[16px] font-semibold text-dash-ink">Select comparison periods</h4>
              <div className="mt-4 flex flex-wrap gap-3">
                <WeeklyPeriodOption
                  selected={comparisonPreset === "thisWeek"}
                  label="This week vs Last week"
                  sublabel={
                    weeklyOptions
                      ? `${formatIsoRange(weeklyOptions.last7)} vs ${formatIsoRange(weeklyOptions.prev7)}`
                      : undefined
                  }
                  onSelect={() => handleComparisonPresetSelect("thisWeek")}
                />
                <WeeklyPeriodOption
                  selected={comparisonPreset === "custom"}
                  label="Custom"
                  onSelect={() => handleComparisonPresetSelect("custom")}
                />
              </div>

              {comparisonPreset === "custom" && (
                <div className="mt-4 space-y-4 rounded-lg border border-dash-border nre-wizard-panel p-4">
                  <div>
                    <p className="mb-3 text-[14px] font-medium text-dash-ink">Period A (current)</p>
                    <WizardDateRangeFields
                      startIso={comparisonPeriodA?.startIso ?? ""}
                      endIso={comparisonPeriodA?.endIso ?? ""}
                      minIso={dateBounds?.minIso}
                      maxIso={dateBounds?.maxIso}
                      startLabel="Start"
                      endLabel="End"
                      onStartChange={(iso) => updateComparisonPeriodA("startIso", iso)}
                      onEndChange={(iso) => updateComparisonPeriodA("endIso", iso)}
                    />
                  </div>
                  <div>
                    <p className="mb-3 text-[14px] font-medium text-dash-ink">Period B (compare)</p>
                    <WizardDateRangeFields
                      startIso={comparisonPeriodB?.startIso ?? ""}
                      endIso={comparisonPeriodB?.endIso ?? ""}
                      minIso={dateBounds?.minIso}
                      maxIso={dateBounds?.maxIso}
                      startLabel="Start"
                      endLabel="End"
                      onStartChange={(iso) => updateComparisonPeriodB("startIso", iso)}
                      onEndChange={(iso) => updateComparisonPeriodB("endIso", iso)}
                    />
                  </div>
                </div>
              )}

              <p className="mt-4 rounded-md border border-dash-border bg-dash-bg px-3 py-2 text-[14px] text-dash-ink-secondary">
                Tip: Both periods must fit your main CSV (or use Custom and export a longer range from{" "}
                {platform === "TIKTOK" ? "TikTok Ads Manager" : "Meta Ads Manager"} that includes Period A and Period B).
              </p>
            </section>
          )}

              {previewStatus === "invalid" && (
                <div className="space-y-3">
                  {previewErrors.filter(isNoDataRowsError).map((e, i) =>
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
                  {previewErrors.filter(isSpecificFieldError).map((e, i) => (
                    <SpecificFieldWarning key={i} message={e.message} />
                  ))}
                  {previewErrors.some((e) => !isNoDataRowsError(e) && !isSpecificFieldError(e)) && (
                    <div className="rounded-lg border border-red-900 bg-red-950/40 p-4">
                      <p className="mb-2 text-[14px] font-medium text-red-300">Can&apos;t build a preview yet:</p>
                      <ul className="list-inside list-disc space-y-1 text-[14px] text-red-300">
                        {previewErrors.filter((e) => !isNoDataRowsError(e) && !isSpecificFieldError(e)).map((e, i) => (
                          <li key={i}>{e.message}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              {previewStatus === "error" && previewMessage && (
                <div className="space-y-3 rounded-lg border border-red-900 bg-red-950/40 p-4">
                  <p className="text-[14px] text-red-300">{previewMessage}</p>
                  <p className="text-[13px] text-red-200/90">
                    Your campaigns, objectives, and metrics are still saved — use Retry preview below (no need to start
                    over).
                  </p>
                  <button
                    type="button"
                    onClick={handleGenerateStepPrimary}
                    className="rounded-md bg-dash-accent px-4 py-2 text-[14px] font-semibold text-dash-ink hover:bg-dash-accent-hover"
                  >
                    Retry preview
                  </button>
                </div>
              )}
              {previewRefreshing && (data || comparisonData || historicalData || dayBreakdownData) ? (
                <p className="text-[13px] text-dash-ink-secondary">Updating preview…</p>
              ) : null}
            </div>
          )}


            {(periodConfirmation || periodConfirmationBullets) &&
            generateStepPreviewReady &&
            generateStatus === "idle" ? (
              <div className="nre-wizard-callout-success rounded-lg px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="nre-wizard-callout-success__label">Confirmed period</p>
                    {periodConfirmationBullets ? (
                      <div className="mt-1 text-[15px] font-medium leading-snug text-dash-ink">
                        <p>{copy.confirmedPeriodWeeklyLead}</p>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] font-normal">
                          {periodConfirmationBullets.map((line) => (
                            <li key={line}>{line}</li>
                          ))}
                        </ul>
                      </div>
                    ) : periodConfirmation ? (
                      <p className="mt-1 text-[15px] font-medium leading-snug text-dash-ink">{periodConfirmation}</p>
                    ) : null}
                  </div>
                  {reportType === "WEEKLY" && !showWeeklyPeriodEditor ? (
                    <button
                      type="button"
                      onClick={() => setWeeklyPeriodExpanded(true)}
                      className="shrink-0 text-[14px] font-medium text-dash-accent hover:underline"
                    >
                      Change dates
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="space-y-4">
              {(previewKind === "normal" ||
                previewKind === "comparison" ||
                previewKind === "historical" ||
                previewKind === "dayBreakdown") &&
              generateStepPreviewReady &&
              generateStatus === "idle" ? (
                <CsvVerificationPanel verification={csvVerification} refreshing={previewRefreshing} />
              ) : null}

              {showStandardCoverBudget && generateStepPreviewReady && generateStatus === "idle" ? (
                <WizardCoverBudgetSection
                  clientId={clientId}
                  clientMonthlyBudget={clientMonthlyBudget}
                  coverBudgetPreviewLine={coverBudgetPreviewLine}
                  showBudgetOnCover={showBudgetOnCover}
                  onShowBudgetOnCoverChange={handleShowBudgetOnCoverChange}
                  coverBudgetPacingWarning={coverBudgetPacingWarning}
                  budgetToggleSaving={budgetToggleSaving}
                  previewReady={Boolean(data)}
                />
              ) : null}

              {generateStepPreviewReady && generateStatus === "idle" ? (
                <WizardReportBrandingPanel
                  agencyName={agencyName}
                  reportBrandingMode={reportBrandingMode}
                  error={reportBrandingError}
                />
              ) : null}

              {/* Section 1 — Report summary card, amber left border. Merges
                  what used to be two separate cards (Reporting Period +
                  Ready to generate) into the one card the merged Step 3
                  spec calls for. */}
              <div className="rounded-lg border-l-4 border-l-[#f6ad55] bg-dash-card nre-dash-surface p-5">
                <button
                  type="button"
                  onClick={() => setReportSummaryExpanded((open) => !open)}
                  aria-expanded={reportSummaryExpanded}
                  className="flex w-full items-center justify-between gap-3 text-left"
                >
                  <h3 className="text-[15px] font-semibold text-dash-ink">Report Summary</h3>
                  <span
                    className={`text-[15px] leading-none text-dash-ink-secondary transition-transform${reportSummaryExpanded ? " rotate-180" : ""}`}
                    aria-hidden
                  >
                    ▾
                  </span>
                </button>
                {reportSummaryExpanded && (
                  <>
                <hr className="my-3 border-t border-dash-border" />
                <div className="space-y-2">
                  {apiSyncHybridImport ? (
                    <p className="rounded-md border border-dash-border bg-dash-bg px-3 py-2 text-[13px] leading-relaxed text-[#94a3b8]">
                      {META_HYBRID_API_CSV_IMPORT_NOTE}
                    </p>
                  ) : null}
                  <p className="text-[14px] text-[#94a3b8]">
                    Report type: <span className="text-[14px] text-dash-ink">{reportTypeLabel()}</span>
                  </p>
                  <p className="text-[14px] text-[#94a3b8]">
                    Client: <span className="text-[14px] text-dash-ink">{clientName}</span>
                  </p>
                  <div>
                    <p className="text-[14px] text-[#94a3b8]">
                      Campaigns:{" "}
                      <span className="text-[14px] text-dash-ink">{summaryCampaignNames().length} selected</span>
                    </p>
                    <ul className="mt-1 space-y-0.5 pl-4">
                      {summaryCampaignNames().map((name) => (
                        <li key={name} className="truncate text-[14px] text-[#64748b]" title={name}>
                          {name}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {previewKind === "comparison" && comparisonData ? (
                    <p className="text-[14px] text-[#94a3b8]">
                      Comparison periods:{" "}
                      <span className="text-[14px] text-dash-ink">
                        {comparisonData.periodALabel} vs {comparisonData.periodBLabel}
                      </span>
                    </p>
                  ) : previewKind === "historical" && historicalData ? (
                    <p className="text-[14px] text-[#94a3b8]">
                      Months covered:{" "}
                      <span className="text-[14px] text-dash-ink">{historicalData.monthsLabel}</span>
                    </p>
                  ) : previewKind === "dayBreakdown" && dayBreakdownData ? (
                    <p className="text-[14px] text-[#94a3b8]">
                      Date range:{" "}
                      <span className="text-[14px] text-dash-ink">{dayBreakdownData.rangeLabel}</span>
                      {" · "}
                      {dayBreakdownData.dayCount} day{dayBreakdownData.dayCount === 1 ? "" : "s"} with data
                    </p>
                  ) : (
                    <>
                      {reportType === "DAILY" && dailyRange && (
                        <p className="text-[14px] text-[#94a3b8]">
                          Daily period: <span className="text-[14px] text-dash-ink">{formatSummaryRange(dailyRange)}</span>
                        </p>
                      )}
                      {(reportType === "WEEKLY" || reportType === "DAY_BREAKDOWN") && weeklyRangeIso && (
                        <p className="text-[14px] text-[#94a3b8]">
                          {reportType === "DAY_BREAKDOWN" ? "Date range" : weeklyPeriodSummaryLabel()}:{" "}
                          <span className="text-[14px] text-dash-ink">{formatSummaryRange(weeklyRangeIso)}</span>
                        </p>
                      )}
                      {reportType === "MONTHLY" && mtdRange && (
                        <p className="text-[14px] text-[#94a3b8]">
                          Full month: <span className="text-[14px] text-dash-ink">{formatSummaryRange(mtdRange)}</span>
                        </p>
                      )}
                      {reportType === "CREATIVE" && mtdRange && (
                        <p className="text-[14px] text-[#94a3b8]">
                          Data window: <span className="text-[14px] text-dash-ink">{formatSummaryRange(mtdRange)}</span>
                        </p>
                      )}
                      {reportType === "WEEKLY" && mtdRange && (
                        <p className="text-[14px] text-[#94a3b8]">
                          Month to date: <span className="text-[14px] text-dash-ink">{formatSummaryRange(mtdRange)}</span>
                        </p>
                      )}
                    </>
                  )}
                  <p className="text-[14px] text-[#94a3b8]">
                    Template: <span className="text-[14px] text-dash-ink">{TEMPLATE_LABELS[clientTemplate] ?? clientTemplate}</span>
                  </p>
                  <p className="text-[14px] text-[#94a3b8]">
                    Platform: <WizardPlatformSummaryLabel platform={platform} />
                  </p>
                  <p className="text-[14px] text-[#94a3b8]">
                    Estimated slides: <span className="text-[14px] text-dash-ink">{estimatedSlideCount()}</span>
                  </p>
                </div>
                  </>
                )}
              </div>

            {previewKind === "normal" && data?.isPaused && (
              <div className="rounded-lg border border-amber-900 bg-amber-950/30 p-4 text-[14px] text-amber-200">
                <p>{data.pausedMessage}</p>
                {(data.chart || data.periodRow.hasData) ? (
                  <p className="mt-2">
                    Previous month and last-30-days data will still be included in this report where available.
                  </p>
                ) : null}
                <p className="mt-2 font-medium text-amber-100">Still want to create this report? Click Generate.</p>
              </div>
            )}

            {previewKind === "historical" && historicalData?.isPaused && (
              <div className="rounded-lg border border-amber-900 bg-amber-950/30 p-4 text-[14px] text-amber-200">
                No campaign spend found in the selected months. Check your CSV date range and campaign selection.
              </div>
            )}

            {previewKind === "dayBreakdown" && dayBreakdownData?.isPaused && (
              <div className="rounded-lg border border-amber-900 bg-amber-950/30 p-4 text-[14px] text-amber-200">
                No campaign spend found in the selected date range. Check your CSV dates and campaign selection.
              </div>
            )}

            {previewKind === "normal" && data && !data.isPaused && data.objectiveWarnings.length > 0 && (
              <div className="space-y-2">
                {data.objectiveWarnings.map((w) => (
                  <div
                    key={w.campaignName}
                    className="rounded-lg border border-amber-900 bg-amber-950/30 p-4 text-[14px] text-amber-200"
                  >
                    <p>
                      <span className="font-medium">{w.campaignName}:</span> Objective auto-detected as{" "}
                      {w.detectedLabel}. If this is incorrect, make sure your CSV includes the relevant result
                      column — for example Website leads, Meta leads, Purchases, Landing page views etc. See our{" "}
                      <Link href="/help/download" className="underline hover:text-amber-100">
                        Download Guide
                      </Link>{" "}
                      for the recommended columns to include.
                    </p>
                  </div>
                ))}
              </div>
            )}

          </div>

          {!generateStepPreviewReady && previewStatus === "loading" && generateStatus === "idle" ? (
            <p className="text-[14px] text-dash-ink-secondary">Loading report preview…</p>
          ) : null}

          {showGenerateFooter && (
            <div className="space-y-3">
              {generateStatus === "idle" && (
                <div className="hidden md:block">
                  <button
                    type="button"
                    onClick={handleGenerateStepPrimary}
                    disabled={generateCtaDisabled}
                    className="h-12 w-full rounded-md bg-dash-accent text-[16px] font-semibold text-dash-ink hover:bg-dash-accent-hover disabled:opacity-50"
                  >
                    {generateCtaLabel}
                  </button>
                  <p className="mt-2 text-center text-[14px] text-[#94a3b8]">This usually takes 20-30 seconds</p>
                </div>
              )}
              {generateStatus === "loading" && (
                <div className="hidden items-center gap-3 rounded-lg border border-dash-border bg-dash-card p-4 text-[14px] text-dash-ink-secondary md:flex">
                  <Spinner />
                  Generating your report…
                </div>
              )}
              {generateStatus === "error" && (
                <div className="hidden space-y-3 md:block">
                  <div className="rounded-lg border border-red-900 bg-red-950/40 p-4 text-[14px] text-red-300">
                    {generateMessage}
                  </div>
                  <p className="text-[13px] text-dash-ink-secondary">
                    Your setup is unchanged — retry uses the same CSV, campaigns, and metrics.
                  </p>
                  <button
                    type="button"
                    onClick={handleGenerate}
                    className="rounded-md bg-dash-accent px-4 py-2 text-[14px] font-medium text-dash-ink hover:bg-dash-accent-hover"
                  >
                    Retry generate
                  </button>
                </div>
              )}
            </div>
          )}

          {showGenerateFooter ? (
            <WizardStickyFooter
              stepLabel={
                generateStatus === "loading"
                  ? "Step 4 of 4 · Generating…"
                  : generateStatus === "error"
                    ? "Step 4 of 4 · Try again"
                    : "Step 4 of 4 · Generate"
              }
              onBack={() => setStep(3)}
              backLabel="Back to metrics"
              primaryLabel={generateCtaLabel}
              onPrimary={handleGenerateStepPrimary}
              primaryDisabled={generateStatus !== "loading" && generateCtaDisabled}
              primaryLoading={
                generateStatus === "loading" ||
                (previewStatus === "loading" && generateStatus === "idle")
              }
            />
          ) : null}

          {generateStatus !== "done" ? (
            <div className="mt-10 space-y-4 border-t border-dash-border pt-8">
              <p className="text-center text-[14px] leading-relaxed text-dash-ink-secondary">
                Have a question or an issue with this report?{" "}
                <SupportTicketLink clientId={clientId} openInNewTab className="text-dash-accent" /> or{" "}
                <WhatsAppChatLink message="Hi — I need help with a report in NextReport." />
                .
              </p>
              <WizardFeedbackLink />
            </div>
          ) : null}
        </div>

  );
}
