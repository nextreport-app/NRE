"use client";

import { useState } from "react";
import { useWizardContext } from "../wizard-context";
import Link from "next/link";
import { TEMPLATE_LABELS } from "@/lib/validators/client";
import { usesFullAdWizard } from "@/lib/nre/platform-labels";
import { WizardPlatformSummaryLabel } from "@/components/wizard-platform-banner";
import { NoDataRowsWarning, PreviousMonthSummaryOption } from "../ui/warnings";
import { SpecificFieldWarning } from "../ui/specific-field-warning";
import {
  isNoDataRowsError,
  isSpecificFieldError,
  buildClientReportWhatsAppShareUrl,
  buildClientReportSlackShareUrl,
  buildClientReportTeamsShareUrl,
  buildMailtoShareUrl,
  buildShareReportUrl,
  buildTelegramShareUrl,
} from "../utils";
import { WeeklyPeriodOption } from "../ui/weekly-period-option";
import { WizardReportSetupPanel } from "../ui/wizard-report-setup-panel";
import { WizardDateRangeFields } from "../ui/wizard-date-picker";
import { Spinner, MailIcon, CopyIcon } from "../ui/icons";
import { WizardStickyFooter } from "../ui/wizard-sticky-footer";
import { formatRelativeReportDate } from "@/lib/client-display";
import { META_HYBRID_API_CSV_IMPORT_NOTE } from "@/lib/nre/meta-api-sync/hybrid-import-note";
import { CsvVerificationPanel } from "../ui/csv-verification-panel";
import { SupportTicketLink } from "@/components/support-ticket-link";
import { WizardFeedbackLink } from "../ui/wizard-feedback-link";
import { WhatsAppChatLink } from "@/components/whatsapp-chat-link";
import { clientMonthlyBudgetSettingsHref } from "@/lib/nre/client-settings-navigation";
import { useWizardCopy } from "@/hooks/use-wizard-copy";
import { WizardReportBrandingPanel } from "../ui/wizard-report-branding-panel";

function CoverBudgetClientSettingsLink({
  clientId,
  hasBudget,
}: {
  clientId: string;
  hasBudget: boolean;
}) {
  const href = clientMonthlyBudgetSettingsHref(clientId, { returnToWizard: true });
  return (
    <p className="text-[13px] leading-relaxed text-dash-ink-secondary">
      <Link
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-dash-accent hover:underline"
      >
        {hasBudget ? "Edit monthly budget" : "Set monthly budget"} in Client Settings
      </Link>
    </p>
  );
}

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
    handleGeneratePreviousMonthSummary,
    handleReportTypeChange,
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
    wizardSharePlatformLabel,
    driveDateRangeLabel,
    happyPathSkippedSteps,
    agencyName,
    handleWizardAgencyNameChange,
    reportBrandingMode,
    setReportBrandingMode,
    reportBrandingError,
    reportBrandingSaving,
    reportBrandingBlocksGenerate,
  } = w;

  const periodConfirmation = reportPeriodConfirmationLine();
  const slideCount = estimatedSlideCount();

  if (!stepActive) return null;

  const showGenerateFooter = generateStatus === "idle" || generateStatus === "loading" || generateStatus === "error";
  const generateCtaDisabled =
    previewStatus === "invalid" ||
    (previewStatus !== "error" && !generateStepPreviewReady) ||
    reportBrandingBlocksGenerate;
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
            : copy.generateReport;
  const showStandardCoverBudget =
    reportType !== "COMPARISON" && reportType !== "HISTORICAL" && reportType !== "DAY_BREAKDOWN";

  return (
        <div className={`space-y-6 ${showGenerateFooter ? "pb-28 md:pb-6" : ""}`}>
          {usesFullAdWizard(platform) && (
            <div className="space-y-5">
              <WizardReportSetupPanel
                variant="summary"
                allowInlineChange
                reportType={reportType}
                reportTypeLabel={reportTypeLabel()}
                platform={platform}
                clientTimezone={clientTimezone}
                onReportTypeChange={handleReportTypeChange}
              />

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

          {/* Date range (Weekly + Day-by-Day) */}
          {(reportType === "WEEKLY" || reportType === "DAY_BREAKDOWN") && (
            <section className="rounded-lg border border-dash-border bg-dash-card p-5">
              <h4 className="text-[16px] font-semibold text-dash-ink">
                {reportType === "DAY_BREAKDOWN" ? "Select date range" : "Select report period"}
              </h4>
              {reportType === "DAY_BREAKDOWN" ? (
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
              ) : (
                <>
                  <div className="mt-4 flex flex-wrap gap-3">
                    {weeklyOptions ? (
                      <WeeklyPeriodOption
                        selected={dateMode === "last7"}
                        label="Last 7 days"
                        sublabel={formatIsoRange(weeklyOptions.last7)}
                        onSelect={() => {
                          editDateMode("last7");
                          setCustomRangeError(null);
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
                      onSelect={() => editDateMode("custom")}
                    />
                  </div>

                  {dateMode === "custom" ? (
                    <div className="mt-4 space-y-3 rounded-lg border border-dash-border nre-wizard-panel p-4">
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
                            You selected {spanDays} days. Weekly reports read best at 7 days or less — continue with
                            this longer period anyway?
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
                </>
              )}
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


          {showStandardCoverBudget && (
            <section className="rounded-lg border border-dash-border bg-dash-card p-5">
              <h4 className="text-[16px] font-semibold text-dash-ink">Cover slide budget</h4>
              {clientMonthlyBudget != null && clientMonthlyBudget > 0 ? (
                <div className="mt-4 space-y-3 rounded-lg border border-dash-border nre-wizard-panel p-4">
                  {coverBudgetPreviewLine ? (
                    <p className="rounded-md border border-dash-border bg-dash-bg/80 px-4 py-3 text-[14px] leading-relaxed text-dash-ink">
                      {coverBudgetPreviewLine}
                    </p>
                  ) : (
                    <p className="rounded-md border border-dash-border bg-dash-bg/60 px-4 py-3 text-[14px] text-dash-ink-secondary">
                      Calculating spend vs budget…
                    </p>
                  )}
                  <label
                    className={`flex items-start gap-3 ${budgetToggleSaving || !data ? "cursor-wait" : "cursor-pointer"}`}
                  >
                    <input
                      type="checkbox"
                      checked={showBudgetOnCover}
                      disabled={budgetToggleSaving || !data}
                      onChange={(e) => void handleShowBudgetOnCoverChange(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-accent disabled:opacity-50"
                    />
                    <span className="text-[14px] leading-snug text-dash-ink-secondary">
                      Show monthly budget used on cover slide
                    </span>
                  </label>
                  {showBudgetOnCover && coverBudgetPacingWarning ? (
                    <p className="rounded-md border border-amber-800/50 bg-amber-950/30 px-4 py-3 text-[14px] leading-relaxed text-amber-200">
                      {coverBudgetPacingWarning}
                    </p>
                  ) : null}
                  <CoverBudgetClientSettingsLink clientId={clientId} hasBudget />
                </div>
              ) : (
                <div className="mt-4 space-y-2">
                  <p className="text-[14px] leading-relaxed text-dash-ink-secondary">
                    No monthly budget set for this client.
                  </p>
                  <CoverBudgetClientSettingsLink clientId={clientId} hasBudget={false} />
                </div>
              )}
            </section>
          )}

            {periodConfirmation && generateStepPreviewReady && generateStatus === "idle" ? (
              <div className="nre-wizard-callout-success rounded-lg px-4 py-3">
                <p className="nre-wizard-callout-success__label">Confirmed period</p>
                <p className="mt-1 text-[15px] font-medium leading-snug text-dash-ink">{periodConfirmation}</p>
              </div>
            ) : null}

            {generateStepPreviewReady && generateStatus === "idle" ? (
              <WizardReportBrandingPanel
                agencyName={agencyName}
                onAgencyNameChange={handleWizardAgencyNameChange}
                reportBrandingMode={reportBrandingMode}
                onReportBrandingModeChange={setReportBrandingMode}
                saving={reportBrandingSaving}
                error={reportBrandingError}
              />
            ) : null}

            <div className="space-y-4">
              {(previewKind === "normal" ||
                previewKind === "comparison" ||
                previewKind === "historical" ||
                previewKind === "dayBreakdown") &&
              generateStepPreviewReady &&
              generateStatus === "idle" ? (
                <CsvVerificationPanel
                  verification={csvVerification}
                  refreshing={previewRefreshing}
                  clientId={clientId}
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

          {generateStatus === "done" && downloadUrl && (
            <div className="overflow-hidden rounded-xl border border-emerald-800/40 bg-dash-card nre-dash-surface">
              <div className="border-b border-dash-border bg-emerald-950/20 px-5 py-5 text-center">
                <div
                  className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-2xl text-emerald-300"
                  aria-hidden
                >
                  ✓
                </div>
                <p className="text-[18px] font-bold text-emerald-300">Report generated</p>
                <p className="mt-1 text-[15px] font-semibold text-dash-ink">
                  {clientName} · {reportTypeLabel()}
                </p>
                <p className="mt-1 text-[14px] text-dash-ink-secondary">
                  {slideCount} slide{slideCount === 1 ? "" : "s"}
                  {driveDateRangeLabel() ? ` · ${driveDateRangeLabel()}` : ""}
                </p>
              </div>

              <div className="space-y-5 p-5">
                {shareToken ? (
                  <a
                    href={`https://${buildShareReportUrl(shareToken)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center justify-center rounded-lg bg-dash-accent px-4 py-3.5 text-[16px] font-semibold text-dash-ink shadow-sm hover:bg-dash-accent-hover"
                  >
                    View report in browser
                  </a>
                ) : null}
                {shareToken ? (
                  <a
                    href={buildClientReportWhatsAppShareUrl({
                      clientName,
                      reportTypeLabel: reportTypeLabel(),
                      platformLabel: wizardSharePlatformLabel(),
                      dateRangeLabel: driveDateRangeLabel() || "this period",
                      reportUrl: `https://${buildShareReportUrl(shareToken)}`,
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#25D366]/40 bg-[#25D366]/10 px-4 py-3 text-[15px] font-semibold text-[#86efac] hover:bg-[#25D366]/15"
                  >
                    Share on WhatsApp
                  </a>
                ) : null}
                {shareToken ? (
                  <a
                    href={buildClientReportSlackShareUrl({
                      clientName,
                      reportTypeLabel: reportTypeLabel(),
                      platformLabel: wizardSharePlatformLabel(),
                      dateRangeLabel: driveDateRangeLabel() || "this period",
                      reportUrl: `https://${buildShareReportUrl(shareToken)}`,
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#611f69]/40 bg-[#611f69]/15 px-4 py-3 text-[15px] font-semibold text-[#e9d8fd] hover:bg-[#611f69]/25"
                  >
                    Share on Slack
                  </a>
                ) : null}
                {shareToken ? (
                  <button
                    type="button"
                    onClick={() => void handleCopyClientShareMessage()}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-dash-border bg-dash-sidebar px-4 py-3 text-[15px] font-semibold text-dash-ink hover:bg-dash-border"
                  >
                    <CopyIcon />
                    {clientShareMessageCopied ? "Copied!" : "Copy message"}
                  </button>
                ) : null}
                {publishedAt ? (
                  <div className="rounded-lg border border-emerald-800/50 bg-emerald-950/30 px-4 py-3 text-[14px] text-emerald-200">
                    Published {formatRelativeReportDate(publishedAt)} — the live link reflects your published copy.
                    {driveSaveUrl ? " Re-save to Google Drive manually if you updated the PPT." : null}
                  </div>
                ) : null}

                {shareToken && reportId ? (
                  <p className="text-[14px] leading-relaxed text-dash-ink-secondary">
                    PPT and the live link are ready.{" "}
                    <Link
                      href={`/clients/${clientId}/reports/${reportId}/copy?from=generate`}
                      className="font-medium text-dash-accent hover:underline"
                      onClick={() => {
                        if (reportId && downloadUrl) {
                          persistGenerateSnapshot({ reportId, downloadUrl, shareToken });
                        }
                      }}
                    >
                      {publishedAt ? "Edit review" : "Review slides and edit"}
                    </Link>{" "}
                    before sharing.
                  </p>
                ) : null}

                {shareToken ? (
                  <div className="flex items-center gap-2 rounded-lg border border-dash-border bg-dash-sidebar px-3 py-2.5">
                    <span className="min-w-0 flex-1 truncate font-mono text-[14px] text-[#94a3b8]">
                      {buildShareReportUrl(shareToken)}
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      <a
                        href={`https://${buildShareReportUrl(shareToken)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md px-2.5 py-1 text-[14px] font-medium text-dash-accent hover:bg-dash-border"
                      >
                        View
                      </a>
                      <span className="text-[12px] text-dash-border" aria-hidden="true">
                        ·
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyShareLink}
                        className="rounded-md px-2.5 py-1 text-[14px] font-medium text-dash-accent hover:bg-dash-border"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                ) : null}

                {(() => {
                  const showDrive = !!(hasGoogleDriveConnected && (driveView === "collapsed" || driveView === "success"));
                  const gridClass = showDrive ? "grid grid-cols-2 gap-2" : "grid grid-cols-1 gap-2";

                  return (
                <div>
                  <p className="mb-2 text-[14px] font-semibold uppercase tracking-wide text-dash-ink-secondary">Downloads</p>
                  <div className={gridClass}>
                    <a
                      href={downloadUrl}
                      className="flex items-center justify-center rounded-lg border border-[#f5b45a]/30 bg-[#f5b45a]/10 px-3 py-3 text-[14px] font-medium text-[#f0c27a] transition-colors hover:border-[#f5b45a]/50 hover:bg-[#f5b45a]/15"
                    >
                      PPTX
                    </a>
                    {showDrive ? (
                      <button
                        type="button"
                        onClick={handleSaveButtonClick}
                        disabled={driveSaving}
                        className="flex items-center justify-center rounded-lg border border-[#68d391]/30 bg-[#68d391]/10 px-3 py-3 text-[14px] font-medium text-[#9ae6b4] transition-colors hover:border-[#68d391]/50 hover:bg-[#68d391]/15 disabled:opacity-50"
                      >
                        {driveSaving ? "Saving…" : "Google Drive"}
                      </button>
                    ) : null}
                  </div>
                  {hasGoogleDriveConnected && rememberedFolder && (driveView === "collapsed" || driveView === "success") ? (
                    <p className="mt-2 text-[14px] text-dash-ink-secondary">
                      Drive folder: <span className="text-dash-ink">{rememberedFolder.name}</span>{" "}
                      <button
                        type="button"
                        onClick={() => {
                          setDriveSaveError(null);
                          setDriveView("editing");
                        }}
                        className="text-dash-accent hover:underline"
                      >
                        Change
                      </button>
                    </p>
                  ) : null}
                </div>
                  );
                })()}

                {shareToken ? (
                  <details className="group rounded-lg border border-dash-border bg-dash-sidebar">
                    <summary className="cursor-pointer list-none px-4 py-3 text-[14px] font-medium text-dash-ink marker:content-none [&::-webkit-details-marker]:hidden">
                      <span className="flex items-center justify-between gap-2">
                        Share with client
                        <span className="text-[15px] leading-none text-dash-ink-secondary transition-transform group-open:rotate-180">▾</span>
                      </span>
                    </summary>
                    <div className="border-t border-dash-border px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <a
                          href={buildMailtoShareUrl(`https://${buildShareReportUrl(shareToken)}`, clientName)}
                          className="inline-flex items-center gap-1.5 rounded-md border border-dash-border px-3 py-2 text-[14px] text-dash-ink hover:bg-dash-border"
                        >
                          <MailIcon />
                          Email
                        </a>
                        <a
                          href={buildTelegramShareUrl(`https://${buildShareReportUrl(shareToken)}`)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-md border border-dash-border px-3 py-2 text-[14px] text-dash-ink hover:bg-dash-border"
                        >
                          <svg viewBox="0 0 24 24" fill="#26A5E4" width={16} height={16} aria-hidden="true">
                            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                          </svg>
                          Telegram
                        </a>
                        <a
                          href={buildClientReportTeamsShareUrl({
                            clientName,
                            reportTypeLabel: reportTypeLabel(),
                            platformLabel: wizardSharePlatformLabel(),
                            dateRangeLabel: driveDateRangeLabel() || "this period",
                            reportUrl: `https://${buildShareReportUrl(shareToken)}`,
                          })}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-md border border-dash-border px-3 py-2 text-[14px] text-dash-ink hover:bg-dash-border"
                        >
                          <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden="true">
                            <path
                              fill="#5059C9"
                              d="M20.625 8.25h-3.375V5.625A2.629 2.629 0 0 0 14.625 3h-5.25A2.629 2.629 0 0 0 6.75 5.625v2.625H3.375A1.128 1.128 0 0 0 2.25 9.375v9A2.629 2.629 0 0 0 4.875 21h14.25a2.629 2.629 0 0 0 2.625-2.625v-9a1.128 1.128 0 0 0-1.125-1.125ZM9 5.625a1.128 1.128 0 0 1 1.125-1.125h3.75A1.128 1.128 0 0 1 15 5.625V8.25H9V5.625Zm10.5 12.75a1.128 1.128 0 0 1-1.125 1.125H5.625A1.128 1.128 0 0 1 4.5 18.375v-7.5h15v7.5Z"
                            />
                            <path
                              fill="#7B83EB"
                              d="M12.75 11.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Zm-3.375 6.375h6.75a.375.375 0 0 0 .375-.375v-1.125a2.25 2.25 0 0 0-2.25-2.25h-3a2.25 2.25 0 0 0-2.25 2.25v1.125a.375.375 0 0 0 .375.375Z"
                            />
                          </svg>
                          Teams
                        </a>
                        <button
                          type="button"
                          onClick={() => void handleCopyClientShareMessage()}
                          className="inline-flex items-center gap-1.5 rounded-md border border-dash-border px-3 py-2 text-[14px] text-dash-ink hover:bg-dash-border"
                        >
                          <CopyIcon />
                          {clientShareMessageCopied ? "Copied!" : "Copy message"}
                        </button>
                        {driveSaveUrl ? (
                          <button
                            type="button"
                            onClick={handleCopyLink}
                            className="inline-flex items-center gap-1.5 rounded-md border border-dash-border px-3 py-2 text-[14px] text-dash-ink hover:bg-dash-border"
                          >
                            <CopyIcon />
                            {copied ? "Copied!" : "Copy Drive link"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </details>
                ) : null}

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
                      Open Google Drive → navigate to your folder → right-click → Get link → Copy link → paste it
                      here
                    </p>
                    {driveLinkFormatError && <p className="mt-1 text-[14px] text-red-400">{driveLinkFormatError}</p>}
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

              {driveSaveError && <p className="text-[14px] text-red-400">{driveSaveError}</p>}

              {/* State 3: button/input are both gone, replaced by the saved-file
                  link. The share link + Email/WhatsApp/Copy Link row now live
                  in the tertiary actions above (Fix 4) — no longer duplicated
                  here. */}
              {driveView === "success" && driveSaveUrl && (
                <div className="rounded-lg border border-emerald-800 bg-emerald-950/30 p-4">
                  <p className="mb-2 text-[14px] uppercase tracking-wide text-emerald-300">
                    Saved to Google Drive ✓
                  </p>
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
              )}

              {/* Fix 1 — only for a real WEEKLY/MONTHLY report (comparison reports have no Previous Month Data row to be missing) and only when the client genuinely has none uploaded. */}
              {reportType !== "COMPARISON" &&
                reportType !== "HISTORICAL" &&
                reportType !== "DAY_BREAKDOWN" &&
                includePreviousMonthComparison &&
                !previousMonthComparisonReady && (
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
              )}

              <div className="border-t border-dash-border pt-4">
                <button
                  type="button"
                  onClick={handleGenerateAnother}
                  className="w-full text-center text-[14px] font-medium text-[#63b3ed] hover:underline"
                >
                  Generate another report for {clientName}
                </button>
              </div>
              </div>
            </div>
          )}

          {showGenerateFooter && (
            <div className="space-y-3">
              {generateStatus === "idle" && (
                <div className="hidden md:block">
                  <button
                    type="button"
                    onClick={handleGenerate}
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

          <p className="rounded-lg border border-dash-border bg-dash-sidebar/60 px-4 py-3 text-[14px] leading-relaxed text-dash-ink-secondary">
            Have a question or an issue with this report?{" "}
            <SupportTicketLink clientId={clientId} openInNewTab /> or{" "}
            <WhatsAppChatLink message="Hi — I need help with a report in NextReport." />
            .
          </p>

          <WizardFeedbackLink />

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
        </div>

  );
}
