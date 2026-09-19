"use client";

import { useState } from "react";
import { useWizardContext } from "../wizard-context";
import Link from "next/link";
import { TEMPLATE_LABELS } from "@/lib/validators/client";
import { usesFullAdWizard } from "@/lib/nre/platform-labels";
import { WizardPlatformSummaryLabel } from "@/components/wizard-platform-banner";
import { NoDataRowsWarning, PreviousMonthSummaryOption } from "../ui/warnings";
import { SpecificFieldWarning } from "../ui/specific-field-warning";
import { isNoDataRowsError, isSpecificFieldError, buildMailtoShareUrl, buildShareReportUrl, buildSlackShareUrl, buildTelegramShareUrl, buildWhatsAppShareUrl } from "../utils";
import { ReportTypeCard } from "../ui/report-type-card";
import { WeeklyPeriodOption } from "../ui/weekly-period-option";
import { Spinner, MailIcon, CopyIcon } from "../ui/icons";
import { WizardStickyFooter } from "../ui/wizard-sticky-footer";
import { formatRelativeReportDate } from "@/lib/client-display";

const PRIMARY_REPORT_TYPES = new Set(["WEEKLY", "MONTHLY", "DAILY"]);

export function WizardGenerateStep() {
  const w = useWizardContext();
  if (w.step !== 4) return null;
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
    coverBudgetPacingWarning,
    coverBudgetPreviewLine,
    customEnd,
    customRangeError,
    customStart,
    customTitleExpanded,
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
    generateMessage,
    generateStatus,
    handleCancelPreviousMonthSummary,
    handleComparisonPresetSelect,
    handleCopyLink,
    handleCopyShareLink,
    handleGenerate,
    handleGenerateAnother,
    handleGeneratePreviousMonthSummary,
    handleReportTypeChange,
    handleSaveButtonClick,
    handleSaveToFolderLink,
    handleShowBudgetOnCoverChange,
    hasAdLevelCsv,
    hasGoogleDriveConnected,
    historicalData,
    historicalMonthCount,
    historicalMonthLabels,
    includePreviousMonthComparison,
    monthComparisonCoverage,
    monthComparisonOptions,
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
    previousMonthComparisonReady,
    previousMonthHasFile,
    publishedAt,
    rememberedFolder,
    reportId,
    reportSummaryExpanded,
    reportTitle,
    reportTitleTouched,
    reportType,
    reportTypeLabel,
    setCustomEnd,
    setCustomRangeError,
    setCustomStart,
    setCustomTitleExpanded,
    setDateMode,
    setDriveFolderLinkInput,
    setDriveFolderNameInput,
    setDriveLinkFormatError,
    setDriveSaveError,
    setDriveSaveUrl,
    setDriveView,
    setHistoricalMonthCount,
    setLongRangeConfirmed,
    setReportSummaryExpanded,
    setReportTitle,
    setReportTitleTouched,
    setStep,
    shareToken,
    showBudgetOnCover,
    spanDays,
    summaryCampaignNames,
    updateComparisonPeriodA,
    updateComparisonPeriodB,
    weeklyOptions,
    weeklyPeriodSummaryLabel,
    weeklyRangeIso
  } = w;

  const [moreReportTypesOpen, setMoreReportTypesOpen] = useState(
    () => !PRIMARY_REPORT_TYPES.has(reportType),
  );

  const showGenerateFooter = generateStatus === "idle" || generateStatus === "loading" || generateStatus === "error";

  return (
        <div className={`space-y-6 ${showGenerateFooter ? "pb-28 md:pb-6" : ""}`}>
          {usesFullAdWizard(platform) && (
            <div className="space-y-5">
              <section className="rounded-lg border border-dash-border border-l-4 border-l-[#f6ad55] bg-dash-card p-5">
            <h4 className="text-[15px] font-semibold text-white">Report Type</h4>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <ReportTypeCard
                icon="📊"
                heading="Weekly Performance Report"
                description="One week with a daily chart."
                selected={reportType === "WEEKLY"}
                onSelect={() => handleReportTypeChange("WEEKLY")}
                layout="compact"
              />
              <ReportTypeCard
                icon="📅"
                heading="Monthly Performance Report"
                description="Full month with MTD chart."
                selected={reportType === "MONTHLY"}
                onSelect={() => handleReportTypeChange("MONTHLY")}
                layout="compact"
              />
              <ReportTypeCard
                icon="☀️"
                heading="Daily Performance Report"
                description="Yesterday only."
                selected={reportType === "DAILY"}
                onSelect={() => handleReportTypeChange("DAILY")}
                layout="compact"
              />
            </div>
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setMoreReportTypesOpen((open) => !open)}
                className="flex w-full items-center justify-between rounded-md border border-dash-border bg-[#0d1b2e]/60 px-3 py-2.5 text-left text-[14px] font-medium text-dash-ink hover:bg-dash-border/40"
                aria-expanded={moreReportTypesOpen}
              >
                <span>
                  More report types
                  {!PRIMARY_REPORT_TYPES.has(reportType) ? (
                    <span className="ml-2 font-normal text-dash-accent">· {reportTypeLabel()}</span>
                  ) : null}
                </span>
                <span className="text-dash-ink-secondary">{moreReportTypesOpen ? "▲" : "▼"}</span>
              </button>
              {moreReportTypesOpen ? (
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <ReportTypeCard
                    icon="📈"
                    heading="Quarterly Performance Report"
                    description="Current quarter to date."
                    selected={reportType === "QUARTER"}
                    onSelect={() => handleReportTypeChange("QUARTER")}
                    layout="compact"
                  />
                  <ReportTypeCard
                    icon="🗓️"
                    heading="Year-to-Date Report"
                    description="Jan 1 through yesterday."
                    selected={reportType === "YTD"}
                    onSelect={() => handleReportTypeChange("YTD")}
                    layout="compact"
                  />
                  <ReportTypeCard
                    icon="🎨"
                    heading="Creative Performance Report"
                    description={
                      hasAdLevelCsv ? "Ad-level winners and video metrics." : "Requires ad-level CSV."
                    }
                    selected={reportType === "CREATIVE"}
                    onSelect={() => handleReportTypeChange("CREATIVE")}
                    disabled={!hasAdLevelCsv}
                    layout="compact"
                  />
                  <ReportTypeCard
                    icon="🔀"
                    heading="Comparison Report"
                    description="Two periods side by side."
                    selected={reportType === "COMPARISON"}
                    onSelect={() => handleReportTypeChange("COMPARISON")}
                    layout="compact"
                  />
                  <ReportTypeCard
                    icon="📆"
                    heading="Multi-Month Historical Report"
                    description="Several past months in one deck."
                    selected={reportType === "HISTORICAL"}
                    onSelect={() => handleReportTypeChange("HISTORICAL")}
                    layout="compact"
                  />
                </div>
              ) : null}
            </div>
            {hasAdLevelCsv && reportType !== "CREATIVE" && (
              <p className="mt-4 rounded-md border border-emerald-800/60 bg-emerald-950/30 px-3 py-2 text-[14px] text-emerald-200">
                Ad-level data detected — creative slides will be included automatically.
              </p>
            )}
            {reportType === "HISTORICAL" && (
              <div className="mt-4 space-y-3">
                <label className="block text-[14px] text-dash-ink-secondary">
                  How many complete prior months?
                  <select
                    value={historicalMonthCount}
                    onChange={(e) => setHistoricalMonthCount(Number(e.target.value))}
                    className="mt-2 block w-full max-w-xs rounded-md border border-dash-border bg-dash-sidebar px-3 py-2 text-[14px] text-white"
                  >
                    {[2, 3, 4, 5, 6, 8, 12].map((n) => (
                      <option key={n} value={n}>
                        Last {n} months
                      </option>
                    ))}
                  </select>
                </label>
                <p className="text-[14px] text-dash-ink-secondary">
                  Months: <span className="text-white">{historicalMonthLabels.join(" · ")}</span>
                </p>
                {dateBounds && (
                  <p className="text-[14px] text-dash-ink-muted">
                    CSV must cover {formatIso(dateBounds.minIso)} – {formatIso(dateBounds.maxIso)}.
                  </p>
                )}
              </div>
            )}
            {reportType === "DAILY" && dailyRange && (
              <p className="mt-4 text-[14px] text-dash-ink-secondary">
                Reporting on <span className="text-white">{formatIsoRange(dailyRange)}</span>.
              </p>
            )}
          </section>

          {/* Section 2 — Date range (Weekly only) */}
          {reportType === "WEEKLY" && (
            <section className="rounded-lg border border-dash-border bg-dash-card p-5">
              <h4 className="text-[16px] font-semibold text-white">Select report period</h4>

              <p className="mt-4 text-[14px] font-semibold uppercase tracking-wide text-dash-ink-secondary">Quick picks</p>
              <div className="mt-2 flex flex-wrap gap-3">
                {weeklyOptions && (
                  <WeeklyPeriodOption
                    selected={dateMode === "last7"}
                    label="Last 7 days"
                    sublabel={formatIsoRange(weeklyOptions.last7)}
                    onSelect={() => {
                      setDateMode("last7");
                      setCustomRangeError(null);
                    }}
                  />
                )}
                {weeklyOptions && (
                  <WeeklyPeriodOption
                    selected={dateMode === "prev7"}
                    label="Previous 7 days"
                    sublabel={formatIsoRange(weeklyOptions.prev7)}
                    onSelect={() => {
                      setDateMode("prev7");
                      setCustomRangeError(null);
                    }}
                  />
                )}
                {weeklyOptions && (
                  <WeeklyPeriodOption
                    selected={dateMode === "last14"}
                    label="Last 14 days (bi-weekly)"
                    sublabel={formatIsoRange(weeklyOptions.last14)}
                    onSelect={() => {
                      setDateMode("last14");
                      setCustomRangeError(null);
                    }}
                  />
                )}
              </div>

              <p className="mt-4 text-[14px] font-semibold uppercase tracking-wide text-dash-ink-secondary">Custom dates</p>
              <div className="mt-2 flex flex-wrap gap-3">
                <WeeklyPeriodOption
                  selected={dateMode === "custom"}
                  label="Custom date range"
                  sublabel={
                    dateBounds
                      ? `Any dates within ${formatIso(dateBounds.minIso)} – ${formatIso(dateBounds.maxIso)}`
                      : "Pick any start and end date in your CSV"
                  }
                  onSelect={() => setDateMode("custom")}
                />
              </div>

              {dateMode === "custom" && (
                <div className="mt-4 space-y-3 rounded-md border border-dash-border p-3">
                  <div className="flex flex-wrap gap-3">
                    <div>
                      <label className="mb-1 block text-[14px] text-dash-ink-secondary">Start date</label>
                      <input
                        type="date"
                        value={customStart}
                        min={dateBounds?.minIso}
                        max={dateBounds?.maxIso}
                        onChange={(e) => {
                          setCustomStart(e.target.value);
                          setLongRangeConfirmed(false);
                          setCustomRangeError(null);
                        }}
                        className="rounded-md border border-dash-border bg-dash-bg px-2 py-1.5 text-[14px] text-dash-ink outline-none focus:border-dash-accent"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[14px] text-dash-ink-secondary">End date</label>
                      <input
                        type="date"
                        value={customEnd}
                        min={dateBounds?.minIso}
                        max={dateBounds?.maxIso}
                        onChange={(e) => {
                          setCustomEnd(e.target.value);
                          setLongRangeConfirmed(false);
                          setCustomRangeError(null);
                        }}
                        className="rounded-md border border-dash-border bg-dash-bg px-2 py-1.5 text-[14px] text-dash-ink outline-none focus:border-dash-accent"
                      />
                    </div>
                  </div>

                  {customRangeError && <p className="text-[14px] text-red-400">{customRangeError}</p>}

                  {needsLongRangeConfirm && (
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
                  )}
                </div>
              )}
            </section>
          )}

          {/* Section 2 (Comparison variant) — Period A/B presets (A1) */}
          {reportType === "COMPARISON" && (
            <section className="rounded-lg border border-dash-border bg-dash-card p-5">
              <h4 className="text-[16px] font-semibold text-white">Select comparison periods</h4>
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
                  selected={comparisonPreset === "thisMonth"}
                  label="Month-on-month (this month vs last)"
                  sublabel={
                    monthComparisonOptions
                      ? `${formatIsoRange(monthComparisonOptions.periodA)} vs ${formatIsoRange(monthComparisonOptions.periodB)}`
                      : undefined
                  }
                  onSelect={() => handleComparisonPresetSelect("thisMonth")}
                />
                <WeeklyPeriodOption
                  selected={comparisonPreset === "custom"}
                  label="Custom"
                  onSelect={() => handleComparisonPresetSelect("custom")}
                />
              </div>

              {comparisonPreset === "custom" && (
                <div className="mt-4 space-y-3 rounded-md border border-dash-border p-3">
                  <div>
                    <p className="mb-1 text-[14px] text-dash-ink-secondary">Period A (current)</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="date"
                        value={comparisonPeriodA?.startIso ?? ""}
                        min={dateBounds?.minIso}
                        max={dateBounds?.maxIso}
                        onChange={(e) => updateComparisonPeriodA("startIso", e.target.value)}
                        className="rounded-md border border-dash-border bg-dash-bg px-2 py-1.5 text-[14px] text-dash-ink outline-none focus:border-dash-accent"
                      />
                      <span className="text-[14px] text-dash-ink-secondary">to</span>
                      <input
                        type="date"
                        value={comparisonPeriodA?.endIso ?? ""}
                        min={dateBounds?.minIso}
                        max={dateBounds?.maxIso}
                        onChange={(e) => updateComparisonPeriodA("endIso", e.target.value)}
                        className="rounded-md border border-dash-border bg-dash-bg px-2 py-1.5 text-[14px] text-dash-ink outline-none focus:border-dash-accent"
                      />
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-[14px] text-dash-ink-secondary">Period B (compare)</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="date"
                        value={comparisonPeriodB?.startIso ?? ""}
                        min={dateBounds?.minIso}
                        max={dateBounds?.maxIso}
                        onChange={(e) => updateComparisonPeriodB("startIso", e.target.value)}
                        className="rounded-md border border-dash-border bg-dash-bg px-2 py-1.5 text-[14px] text-dash-ink outline-none focus:border-dash-accent"
                      />
                      <span className="text-[14px] text-dash-ink-secondary">to</span>
                      <input
                        type="date"
                        value={comparisonPeriodB?.endIso ?? ""}
                        min={dateBounds?.minIso}
                        max={dateBounds?.maxIso}
                        onChange={(e) => updateComparisonPeriodB("endIso", e.target.value)}
                        className="rounded-md border border-dash-border bg-dash-bg px-2 py-1.5 text-[14px] text-dash-ink outline-none focus:border-dash-accent"
                      />
                    </div>
                  </div>
                </div>
              )}

              {monthComparisonCoverage && !monthComparisonCoverage.valid ? (
                <p className="mt-4 rounded-md border border-amber-800/50 bg-amber-950/30 px-3 py-2 text-[14px] text-amber-200">
                  {monthComparisonCoverage.error ??
                    "Your CSV does not cover both comparison periods. Export a longer custom range or upload Previous Month Data on Manage."}
                </p>
              ) : monthComparisonCoverage?.periodBUsesSupplemental ? (
                <p className="mt-4 rounded-md border border-sky-800/50 bg-sky-950/30 px-3 py-2 text-[14px] text-sky-200">
                  Period B will use your stored Previous Month Data for dates before your main CSV starts.
                </p>
              ) : (
                <p className="mt-4 rounded-md border border-dash-border bg-dash-bg px-3 py-2 text-[14px] text-dash-ink-secondary">
                  Tip: Period A must fit your main CSV. For month-vs-month, upload Previous Month Data once on Manage — or
                  export a custom range from{" "}
                  {platform === "TIKTOK" ? "TikTok Ads Manager" : "Meta Ads Manager"} that includes both periods.
                </p>
              )}
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
                <div className="rounded-lg border border-red-900 bg-red-950/40 p-4 text-[14px] text-red-300">
                  {previewMessage}
                </div>
              )}
              {previewStatus === "loading" && !data && !comparisonData && !historicalData && (
                <div className="flex items-center gap-3 rounded-lg border border-dash-border bg-dash-card p-4 text-[14px] text-dash-ink-secondary">
                  <Spinner />
                  Loading preview…
                </div>
              )}
              {previewRefreshing && (data || comparisonData || historicalData) ? (
                <p className="text-[13px] text-dash-ink-secondary">Updating preview…</p>
              ) : null}
            </div>
          )}


          {previewKind === "normal" && data && (
            <div className="rounded-lg border border-dash-border bg-dash-card p-4">
              <h4 className="text-[15px] font-semibold text-white">Cover slide budget</h4>
              {clientMonthlyBudget != null && clientMonthlyBudget > 0 && coverBudgetPreviewLine ? (
                <div className="mt-3 space-y-3">
                  <p className="rounded-md border border-navy-border bg-navy-panel px-3 py-2.5 text-[14px] leading-relaxed text-dash-ink">
                    {coverBudgetPreviewLine}
                  </p>
                  <label className={`flex items-start gap-3 ${budgetToggleSaving ? "cursor-wait opacity-70" : "cursor-pointer"}`}>
                    <input
                      type="checkbox"
                      checked={showBudgetOnCover}
                      disabled={budgetToggleSaving}
                      onChange={(e) => void handleShowBudgetOnCoverChange(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-accent disabled:opacity-50"
                    />
                    <span className="text-[14px] text-dash-ink-secondary">
                      Show monthly budget used on cover slide
                    </span>
                  </label>
                  {coverBudgetPacingWarning && (
                    <p className="rounded-md border border-amber-800/50 bg-amber-950/30 px-3 py-2 text-[14px] text-amber-200">
                      {coverBudgetPacingWarning}
                    </p>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-[14px] leading-relaxed text-dash-ink-secondary">
                  No monthly budget set for this client.{" "}
                  <Link
                    href={`/clients/${clientId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-dash-accent hover:underline"
                  >
                    Set budget in Client Settings
                  </Link>
                </p>
              )}
            </div>
          )}

          {(data || comparisonData || historicalData) && (
            <>
            <div className="space-y-4">
              {/* Section 1 — Report summary card, amber left border. Merges
                  what used to be two separate cards (Reporting Period +
                  Ready to generate) into the one card the merged Step 3
                  spec calls for. */}
              <div className="rounded-lg border-l-4 border-l-[#f6ad55] bg-[#1e293b] p-5">
                <button
                  type="button"
                  onClick={() => setReportSummaryExpanded((open) => !open)}
                  aria-expanded={reportSummaryExpanded}
                  className="flex w-full items-center justify-between gap-3 text-left"
                >
                  <h3 className="text-[15px] font-semibold text-white">Report Summary</h3>
                  <span
                    className={`text-[15px] leading-none text-dash-ink-secondary transition-transform${reportSummaryExpanded ? " rotate-180" : ""}`}
                    aria-hidden
                  >
                    ▾
                  </span>
                </button>
                {reportSummaryExpanded && (
                  <>
                <hr className="my-3 border-t border-[#334155]" />
                <div className="space-y-2">
                  <p className="text-[14px] text-[#94a3b8]">
                    Report type: <span className="text-[14px] text-white">{reportTypeLabel()}</span>
                  </p>
                  <p className="text-[14px] text-[#94a3b8]">
                    Client: <span className="text-[14px] text-white">{clientName}</span>
                  </p>
                  <div>
                    <p className="text-[14px] text-[#94a3b8]">
                      Campaigns:{" "}
                      <span className="text-[14px] text-white">{summaryCampaignNames().length} selected</span>
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
                      <span className="text-[14px] text-white">
                        {comparisonData.periodALabel} vs {comparisonData.periodBLabel}
                      </span>
                    </p>
                  ) : previewKind === "historical" && historicalData ? (
                    <p className="text-[14px] text-[#94a3b8]">
                      Months covered:{" "}
                      <span className="text-[14px] text-white">{historicalData.monthsLabel}</span>
                    </p>
                  ) : (
                    <>
                      {reportType === "DAILY" && dailyRange && (
                        <p className="text-[14px] text-[#94a3b8]">
                          Daily period: <span className="text-[14px] text-white">{formatSummaryRange(dailyRange)}</span>
                        </p>
                      )}
                      {reportType === "WEEKLY" && weeklyRangeIso && (
                        <p className="text-[14px] text-[#94a3b8]">
                          {weeklyPeriodSummaryLabel()}:{" "}
                          <span className="text-[14px] text-white">{formatSummaryRange(weeklyRangeIso)}</span>
                        </p>
                      )}
                      {reportType === "MONTHLY" && mtdRange && (
                        <p className="text-[14px] text-[#94a3b8]">
                          Full month: <span className="text-[14px] text-white">{formatSummaryRange(mtdRange)}</span>
                        </p>
                      )}
                      {reportType === "CREATIVE" && mtdRange && (
                        <p className="text-[14px] text-[#94a3b8]">
                          Data window: <span className="text-[14px] text-white">{formatSummaryRange(mtdRange)}</span>
                        </p>
                      )}
                      {reportType === "WEEKLY" && mtdRange && (
                        <p className="text-[14px] text-[#94a3b8]">
                          Month to date: <span className="text-[14px] text-white">{formatSummaryRange(mtdRange)}</span>
                        </p>
                      )}
                    </>
                  )}
                  <p className="text-[14px] text-[#94a3b8]">
                    Template: <span className="text-[14px] text-white">{TEMPLATE_LABELS[clientTemplate] ?? clientTemplate}</span>
                  </p>
                  <p className="text-[14px] text-[#94a3b8]">
                    Platform: <WizardPlatformSummaryLabel platform={platform} />
                  </p>
                  <p className="text-[14px] text-[#94a3b8]">
                    Estimated slides: <span className="text-[14px] text-white">{estimatedSlideCount()}</span>
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

            {/* Section 2 — Custom title, collapsed behind a small link by default. */}
            <div className="rounded-lg bg-[#1e293b] p-5">
              {!customTitleExpanded && !reportTitleTouched ? (
                <button
                  type="button"
                  onClick={() => setCustomTitleExpanded(true)}
                  className="text-[14px] text-dash-accent hover:underline"
                >
                  Add custom PPT report title +
                </button>
              ) : (
                <>
                  <label className="mb-1 block text-[14px] text-[#94a3b8]">Custom report title</label>
                  <input
                    value={reportTitle}
                    onChange={(e) => {
                      setReportTitle(e.target.value);
                      setReportTitleTouched(true);
                    }}
                    placeholder="e.g. Monthly Campaign Summary or Q3 Performance Review"
                    maxLength={100}
                    disabled={generateStatus === "loading" || generateStatus === "done"}
                    className="w-full rounded-md border border-dash-border bg-dash-card px-3 py-2 text-[14px] text-dash-ink outline-none focus:border-dash-accent disabled:opacity-60"
                  />
                  <p className="mt-1 text-[14px] text-[#94a3b8]">Replaces the report type title on the cover slide.</p>
                </>
              )}
            </div>

            {/* Section 3 — Generate button. Same screen throughout: only
                this changes as generateStatus moves idle -> loading ->
                done/error, so there's no navigation between "getting ready"
                and "here's your file". */}
            {generateStatus === "idle" && (
              <div className="hidden md:block">
                <button
                  onClick={handleGenerate}
                  className="h-12 w-full rounded-md bg-dash-accent text-[16px] font-semibold text-dash-ink hover:bg-dash-accent-hover"
                >
                  Generate Report
                </button>
                <p className="mt-2 text-center text-[14px] text-[#94a3b8]">This usually takes 20-30 seconds</p>
              </div>
            )}
          </div>

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
              <button
                onClick={handleGenerate}
                className="rounded-md bg-dash-accent px-4 py-2 text-[14px] font-medium text-dash-ink hover:bg-dash-accent-hover"
              >
                Try Again
              </button>
            </div>
          )}

          {generateStatus === "done" && downloadUrl && (
            <div className="overflow-hidden rounded-xl border border-dash-border bg-[#111f35]">
              <div className="border-b border-dash-border px-5 py-4">
                <p className="text-[16px] font-semibold text-[#68d391]">Report ready</p>
                <p className="mt-1 text-[14px] text-dash-ink-secondary">
                  Share the live link with your client or download files below.
                </p>
              </div>

              <div className="space-y-5 p-5">
                {publishedAt ? (
                  <div className="rounded-lg border border-emerald-800/50 bg-emerald-950/30 px-4 py-3 text-[14px] text-emerald-200">
                    Published {formatRelativeReportDate(publishedAt)} — the live link reflects your published copy.
                    {driveSaveUrl ? " Re-save to Google Drive manually if you updated the PPT." : null}
                  </div>
                ) : null}

                {shareToken && reportId ? (
                  <div className="rounded-lg border border-[#f6ad55]/40 bg-[#0d1b2e] p-4">
                    <p className="text-[14px] leading-relaxed text-dash-ink">
                      PPT and the live link are ready. Review or edit slides and copy before sharing — publish from
                      Review updates the live link.
                    </p>
                    <Link
                      href={`/clients/${clientId}/reports/${reportId}/copy?from=generate`}
                      className="mt-3 flex w-full items-center justify-center rounded-lg bg-dash-accent px-4 py-3 text-[15px] font-semibold text-dash-ink hover:bg-dash-accent-hover"
                      onClick={() => {
                        if (reportId && downloadUrl) {
                          persistGenerateSnapshot({ reportId, downloadUrl, shareToken });
                        }
                      }}
                    >
                      {publishedAt ? "Edit review" : "Review before sharing"}
                    </Link>
                  </div>
                ) : null}

                {shareToken ? (
                  <>
                    <a
                      href={`https://${buildShareReportUrl(shareToken)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex w-full items-center justify-center rounded-lg text-[15px] font-semibold transition-opacity hover:opacity-90"
                      style={{ height: "48px", backgroundColor: "#f5b45a", color: "#0d1b2e" }}
                    >
                      View in browser
                    </a>
                    <div className="flex items-center gap-2 rounded-lg border border-dash-border bg-[#0d1b2e] px-3 py-2.5">
                      <span className="min-w-0 flex-1 truncate font-mono text-[14px] text-[#94a3b8]">
                        {buildShareReportUrl(shareToken)}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyShareLink}
                        className="shrink-0 rounded-md px-2.5 py-1 text-[14px] font-medium text-dash-accent hover:bg-dash-border"
                      >
                        Copy
                      </button>
                    </div>
                  </>
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
                      className="flex items-center justify-center rounded-lg border border-[#f5b45a]/50 bg-[#0d1b2e] px-3 py-3 text-[14px] font-medium text-white hover:border-[#f5b45a]"
                    >
                      PPTX
                    </a>
                    {showDrive ? (
                      <button
                        type="button"
                        onClick={handleSaveButtonClick}
                        disabled={driveSaving}
                        className="flex items-center justify-center rounded-lg border border-[#68d391]/50 bg-[#0d1b2e] px-3 py-3 text-[14px] font-medium text-white hover:border-[#68d391] disabled:opacity-50"
                      >
                        {driveSaving ? "Saving…" : driveSaveUrl ? "Drive (update)" : "Google Drive"}
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
                  <details className="group rounded-lg border border-dash-border bg-[#0d1b2e]">
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
                          href={buildWhatsAppShareUrl(`https://${buildShareReportUrl(shareToken)}`)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-md border border-dash-border px-3 py-2 text-[14px] text-dash-ink hover:bg-dash-border"
                        >
                          <svg viewBox="0 0 24 24" fill="#25D366" width={16} height={16} aria-hidden="true">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.862L0 24l6.324-1.51A11.933 11.933 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.007-1.37l-.36-.213-3.724.889.933-3.617-.235-.374A9.818 9.818 0 012.182 12C2.182 6.578 6.578 2.182 12 2.182S21.818 6.578 21.818 12 17.422 21.818 12 21.818z" />
                          </svg>
                          WhatsApp
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
                          href={buildSlackShareUrl(`https://${buildShareReportUrl(shareToken)}`)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-md border border-dash-border px-3 py-2 text-[14px] text-dash-ink hover:bg-dash-border"
                        >
                          <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden="true">
                            <path
                              d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52z"
                              fill="#36C5F0"
                            />
                            <path
                              d="M6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834z"
                              fill="#2EB67D"
                            />
                            <path
                              d="M8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z"
                              fill="#ECB22E"
                            />
                            <path
                              d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"
                              fill="#E01E5A"
                            />
                          </svg>
                          Slack
                        </a>
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
                      placeholder="e.g. Reports or Alonzo Carr / Reports"
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
            </>
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
              primaryLabel={
                generateStatus === "loading"
                  ? "Generating…"
                  : generateStatus === "error"
                    ? "Try again"
                    : "Generate Report"
              }
              onPrimary={handleGenerate}
              primaryDisabled={generateStatus === "loading" || previewStatus === "loading"}
              primaryLoading={generateStatus === "loading"}
            />
          ) : null}
        </div>

  );
}
