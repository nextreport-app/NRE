"use client";

import { useState } from "react";
import Link from "next/link";
import type { ReportData, ComparisonReportData } from "@/lib/nre/report-data";
import type { ValidationIssue } from "@/lib/nre/validate";
import { extractDriveFolderIdFromLink } from "@/lib/drive-link";
import type { AvailableMetric, SelectedMetric } from "@/lib/nre/available-metrics";

// Ad-set-level filtering was removed from the wizard (product decision: it
// produced MTD totals that no longer matched real account spend, which
// misled clients). The underlying filter logic still lives in
// lib/nre/ad-sets.ts and report-data.ts's selectedAdSets param — untouched,
// just never called from here — so it can come back without re-deriving it.
// Preview + Generate are one screen (see the step === 5 block below) — the
// action row at the bottom swaps between "Generate" button, a loading
// spinner, the download/slides links, or an error + Try Again, all without
// navigating away.
//
// Step 3 (Metrics — Part 3) is Meta-only and optional: skipping it (or
// never touching it) leaves the engine's own automatic per-objective 8-slot
// assignment in place, exactly as before this step existed. Google Ads
// still skips straight from Upload to Preview (step 5) — see
// dispatchAfterAnalyze — since it has no campaign-selection step for a
// Metric Review to meaningfully follow either.
type Step = 1 | 2 | 3 | 4 | 5;
const STEP_LABELS: Record<Step, string> = {
  1: "Upload",
  2: "Campaigns",
  3: "Metrics",
  4: "Dates",
  5: "Preview",
};

const MIN_SELECTED_METRICS = 4;
const MAX_METRICS_PER_SLIDE = 8;
const MAX_TOTAL_METRICS = 16;

type AnalyzeStatus = "idle" | "loading" | "invalid" | "error";
type PreviewStatus = "idle" | "loading" | "invalid" | "error";
type GenerateStatus = "idle" | "loading" | "done" | "error";
type DateMode = "last7" | "prev7" | "custom";
type ReportTypeValue = "WEEKLY" | "MONTHLY" | "COMPARISON";
type ComparisonPreset = "thisWeek" | "thisMonth" | "custom";
// Which data shape the current preview holds — set from the /preview
// response's `isComparison` flag (see comparisonData/data below, and
// applyPreviewResult, the one place that decides which of the two gets
// populated for a given preview response).
type PreviewKind = "normal" | "comparison";
// Which panel the download screen's Drive section shows: "collapsed" (just
// the "Save to Google Drive" button, plus a "Saving to: X — Change" line
// underneath if a folder is already remembered for this client) ->
// "editing" (the paste-a-link input, reached by clicking the button with no
// remembered folder, or "Change" with one) -> "success" (the button/input
// are both hidden, replaced by the shareable link + share buttons).
// Saving-in-flight and errors are tracked separately (driveSaving,
// driveSaveError below) since they can happen from either "collapsed" (the
// one-click save-to-remembered-folder path) or "editing" (the paste-link
// path) without changing which panel is showing.
type DriveView = "collapsed" | "editing" | "success";

interface RememberedDriveFolder {
  id: string;
  name: string;
}

interface DateRangeIso {
  startIso: string;
  endIso: string;
}

interface DateSelection {
  mode: DateMode;
  customStart?: string;
  customEnd?: string;
}

// Matches fill-tags.ts's DEFAULT_REPORT_TITLE/DEFAULT_MONTHLY_REPORT_TITLE/
// DEFAULT_COMPARISON_REPORT_TITLE — kept as separate constants here rather
// than imported, since that module pulls in the whole PPTX generation stack
// (JSZip etc.) which has no business in the client bundle.
const DEFAULT_REPORT_TITLE = "Weekly Performance Report";
const DEFAULT_MONTHLY_REPORT_TITLE = "Monthly Performance Report";
const DEFAULT_COMPARISON_REPORT_TITLE = "Comparison Performance Report";

function defaultReportTitleFor(reportType: ReportTypeValue): string {
  if (reportType === "MONTHLY") return DEFAULT_MONTHLY_REPORT_TITLE;
  if (reportType === "COMPARISON") return DEFAULT_COMPARISON_REPORT_TITLE;
  return DEFAULT_REPORT_TITLE;
}

// Sent as real File objects (multipart/form-data), never decoded to text in
// the browser — .xlsx/.xls are binary and non-UTF-8 text files would be
// mis-decoded by File.text() (which always assumes UTF-8). The server
// detects format from file content and decodes/parses appropriately.
const ACCEPTED_FILE_TYPES = ".csv,.tsv,.txt,.xlsx,.xls,.ods";

function buildUploadFormData(mtdFile: File, extra: Record<string, unknown> = {}): FormData {
  const formData = new FormData();
  formData.append("mtdDailyCsv", mtdFile);
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined) formData.append(key, JSON.stringify(value));
  }
  return formData;
}

/** "2026-07-18" -> "July 18" (full month name, matching the PPTX). Parsed as UTC so the date can't shift a day off by the viewer's timezone. */
function formatIso(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "UTC" }).format(d);
}

function formatIsoRange(range: DateRangeIso): string {
  return `${formatIso(range.startIso)} - ${formatIso(range.endIso)}`;
}

/** Same as formatIsoRange, with the end date's year appended — used for the Month to Date / Full Month Period card, whose range always ends within the current reporting year. */
function formatIsoRangeWithYear(range: DateRangeIso): string {
  return `${formatIsoRange(range)}, ${range.endIso.slice(0, 4)}`;
}

/** validate.ts's "no usable data rows at all" error (see NO_DATA_ROWS_MESSAGE) — rendered as its own amber, actionable warning box rather than lumped into the generic red error list, since it's the one validation failure with real "here's what to check" steps for the user. */
function isNoDataRowsError(e: ValidationIssue): boolean {
  return e.field === "rows";
}

// validate.ts's specific, actionable per-column-mistake messages (Fix 7) —
// each gets its own amber warning box with a Download Guide link, same
// treatment as isNoDataRowsError above, rather than being lumped into the
// generic red bullet list below.
const SPECIFIC_FIELD_ERRORS = new Set(["campaign_name", "spend", "results", "date_granularity"]);

function isSpecificFieldError(e: ValidationIssue): boolean {
  return SPECIFIC_FIELD_ERRORS.has(e.field);
}

function SpecificFieldWarning({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-amber-900 bg-amber-950/30 p-4 text-[13px] text-amber-200">
      <p>{message}</p>
      <Link href="/help/download" className="mt-2 inline-block text-amber-300 underline hover:text-amber-100">
        See our Download Guide →
      </Link>
    </div>
  );
}

function buildWhatsAppShareUrl(reportUrl: string): string {
  return `https://wa.me/?text=${encodeURIComponent(`Your report is ready: ${reportUrl}`)}`;
}

function buildEmailShareUrl(reportUrl: string): string {
  const subject = encodeURIComponent("Your Performance Report");
  const body = encodeURIComponent(`Please find your report here: ${reportUrl}`);
  return `mailto:?subject=${subject}&body=${body}`;
}

export function ReportUploadWizard({
  clientId,
  clientName,
  hasGoogleDriveConnected,
  initialLastDriveFolderId,
  initialLastDriveFolderName,
}: {
  clientId: string;
  /** Client.accountName — used for the "Generate Another Report for [Client Name]" button (B3) and the friendly Drive link label. */
  clientName: string;
  /** Whether the account has a Google Drive account connected — gates showing the "Save to Google Drive" button on the download screen at all. */
  hasGoogleDriveConnected: boolean;
  /** Client.lastDriveFolderId/lastDriveFolderName — the folder this client's reports were last saved to, if any. Pre-navigates the folder picker into it as a convenience. */
  initialLastDriveFolderId: string | null;
  initialLastDriveFolderName: string | null;
}) {
  const [step, setStep] = useState<Step>(1);
  const initialRememberedFolder: RememberedDriveFolder | null =
    initialLastDriveFolderId && initialLastDriveFolderName
      ? { id: initialLastDriveFolderId, name: initialLastDriveFolderName }
      : null;

  // Step 1 — Upload. selectedPlatformCard is the user's own pre-upload
  // choice (B1's two platform cards) — separate from detectedPlatform
  // (what the CSV's headers actually look like) and platform (the value
  // ultimately sent to the server). A mismatch between the two pauses on
  // step 1 with an inline warning instead of dispatching forward — see
  // handleAnalyze/handleMismatchContinueAnyway/handleMismatchGoBack.
  const [selectedPlatformCard, setSelectedPlatformCard] = useState<"META" | "GOOGLE" | null>(null);
  const [mtdFile, setMtdFile] = useState<File | null>(null);
  const [analyzeStatus, setAnalyzeStatus] = useState<AnalyzeStatus>("idle");
  const [analyzeErrors, setAnalyzeErrors] = useState<ValidationIssue[]>([]);
  const [analyzeMessage, setAnalyzeMessage] = useState<string | null>(null);
  const [mismatchWarning, setMismatchWarning] = useState(false);
  const [detectedPlatform, setDetectedPlatform] = useState<"META" | "GOOGLE" | null>(null);
  const [platform, setPlatform] = useState<"META" | "GOOGLE">("META");
  const [continueStatus, setContinueStatus] = useState<"idle" | "loading">("idle");

  // Step 2 — Campaigns (populated by /analyze). Always shown in full for
  // Meta uploads — see handleAnalyze and lib/nre/campaigns.ts's
  // resolveCampaignSelection, which the /analyze route calls to decide the
  // pre-checked default (everything, for a first-ever upload; last time's
  // saved selection, for a returning one) without ever skipping the step.
  const [campaigns, setCampaigns] = useState<string[]>([]);
  const [selectedCampaigns, setSelectedCampaigns] = useState<Set<string>>(new Set());

  // Step 3 — Metrics (Part 3, Meta only — populated by /metrics, called
  // right after Campaign Selection so the engine's default 8 reflects the
  // objective of the campaigns actually being reported on). `selectedMetrics`
  // is the wizard's own ordered pick list (up to MAX_TOTAL_METRICS); empty
  // means "use the engine's automatic assignment" (never sent to the
  // generate/preview APIs in that case — see currentSelectedMetricsPayload).
  const [availableMetrics, setAvailableMetrics] = useState<AvailableMetric[]>([]);
  const [selectedMetrics, setSelectedMetrics] = useState<SelectedMetric[]>([]);
  const [metricsStatus, setMetricsStatus] = useState<"idle" | "loading" | "error">("idle");
  const [metricsTouched, setMetricsTouched] = useState(false);
  const [openMetricDropdownIndex, setOpenMetricDropdownIndex] = useState<number | null>(null);
  const [metricsLimitMessage, setMetricsLimitMessage] = useState<string | null>(null);
  const [showIndividualCampaignMetrics, setShowIndividualCampaignMetrics] = useState(false);

  // Step 4 — Dates (populated by /analyze)
  const [dateBounds, setDateBounds] = useState<{ minIso: string; maxIso: string } | null>(null);
  const [weeklyOptions, setWeeklyOptions] = useState<{ last7: DateRangeIso; prev7: DateRangeIso } | null>(null);
  const [mtdRange, setMtdRange] = useState<DateRangeIso | null>(null);
  const [dateMode, setDateMode] = useState<DateMode>("last7");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [customRangeError, setCustomRangeError] = useState<string | null>(null);
  const [longRangeConfirmed, setLongRangeConfirmed] = useState(false);
  // Fix 8 — Report Type selector, top of the Dates step. Monthly hides the
  // weekly period selector entirely and generates from the full MTD data
  // only. Comparison (A1) hides both the weekly picker AND the MTD Period
  // card, showing its own Period A/B preset picker instead — see
  // handleDatesContinue/handleGenerate, which branch on this value.
  const [reportType, setReportType] = useState<ReportTypeValue>("WEEKLY");

  // Step 3 — Comparison Report's Period A/B pickers (A1). Seeded from
  // weeklyOptions (This week vs Last week, the default preset) as soon as
  // /analyze returns — see applyAnalyzeResult — so switching to the
  // Comparison tab always starts with something sensible pre-filled even
  // before the user touches a preset.
  const [comparisonPreset, setComparisonPreset] = useState<ComparisonPreset>("thisWeek");
  const [comparisonPeriodA, setComparisonPeriodA] = useState<DateRangeIso | null>(null);
  const [comparisonPeriodB, setComparisonPeriodB] = useState<DateRangeIso | null>(null);
  const [monthComparisonOptions, setMonthComparisonOptions] = useState<{ periodA: DateRangeIso; periodB: DateRangeIso } | null>(null);

  // Step 5 — Preview. Comparison reports populate comparisonData instead of
  // data — previewKind (set alongside both in applyPreviewResult) is what
  // the step === 5 JSX actually branches on.
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>("idle");
  const [previewErrors, setPreviewErrors] = useState<ValidationIssue[]>([]);
  const [previewMessage, setPreviewMessage] = useState<string | null>(null);
  const [previewKind, setPreviewKind] = useState<PreviewKind>("normal");
  const [data, setData] = useState<ReportData | null>(null);
  const [comparisonData, setComparisonData] = useState<ComparisonReportData | null>(null);
  const [slidesListExpanded, setSlidesListExpanded] = useState(false);
  const [reportTitle, setReportTitle] = useState(DEFAULT_REPORT_TITLE);
  // False until the user actually types in the Report Title field — while
  // false, switching Report Type keeps swapping the title's own default
  // text to match; once true, their custom title is left alone regardless
  // of which Report Type is picked.
  const [reportTitleTouched, setReportTitleTouched] = useState(false);

  // Step 5 — Generate (same screen as Preview above, see the step === 5 JSX block)
  const [generateStatus, setGenerateStatus] = useState<GenerateStatus>("idle");
  const [generateMessage, setGenerateMessage] = useState<string | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  // "Save to Google Drive" — an explicit, per-report action the user takes
  // right here on the download screen (see handleSaveToDrive below), not
  // anything the generate request itself touches. rememberedFolder mirrors
  // Client.lastDriveFolderId/Name — seeded from the server, then kept in
  // sync locally after every successful save so "Saving to: X ✓" updates
  // immediately without a page reload.
  const [rememberedFolder, setRememberedFolder] = useState<RememberedDriveFolder | null>(initialRememberedFolder);
  const [driveView, setDriveView] = useState<DriveView>("collapsed");
  const [driveSaving, setDriveSaving] = useState(false);
  const [driveFolderLinkInput, setDriveFolderLinkInput] = useState("");
  // Free-typed, optional — there's no Drive API call to resolve the
  // folder's real name (see lib/google-drive.ts's file header for why),
  // so the user names it themselves. Blank is fine; the server applies
  // DEFAULT_DRIVE_FOLDER_NAME ("Drive Folder") if they skip it.
  const [driveFolderNameInput, setDriveFolderNameInput] = useState("");
  const [driveLinkFormatError, setDriveLinkFormatError] = useState<string | null>(null);
  const [driveSaveUrl, setDriveSaveUrl] = useState<string | null>(null);
  const [driveSaveError, setDriveSaveError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  /** Report Type card's onSelect — also swaps the Report Title default text, unless the user has already typed their own. */
  function handleReportTypeChange(next: ReportTypeValue) {
    setReportType(next);
    if (!reportTitleTouched) {
      setReportTitle(defaultReportTitleFor(next));
    }
  }

  function currentDateSelection(): DateSelection {
    if (dateMode === "custom") return { mode: "custom", customStart, customEnd };
    return { mode: dateMode };
  }

  function currentWeeklyRangeIso(): DateRangeIso | null {
    if (dateMode === "custom") {
      return customStart && customEnd ? { startIso: customStart, endIso: customEnd } : null;
    }
    if (!weeklyOptions) return null;
    return dateMode === "prev7" ? weeklyOptions.prev7 : weeklyOptions.last7;
  }

  function customSpanDays(): number | null {
    if (!customStart || !customEnd) return null;
    const startTs = Date.parse(customStart + "T00:00:00Z");
    const endTs = Date.parse(customEnd + "T00:00:00Z");
    if (Number.isNaN(startTs) || Number.isNaN(endTs)) return null;
    return Math.round((endTs - startTs) / (24 * 60 * 60 * 1000)) + 1;
  }

  /** Comparison Report's preset pill onSelect (A1) — This week/This month presets recompute Period A/B from the server-provided options; Custom just switches to the date-picker view, leaving whatever dates are already there. */
  function handleComparisonPresetSelect(preset: ComparisonPreset) {
    setComparisonPreset(preset);
    if (preset === "thisWeek" && weeklyOptions) {
      setComparisonPeriodA(weeklyOptions.last7);
      setComparisonPeriodB(weeklyOptions.prev7);
    } else if (preset === "thisMonth" && monthComparisonOptions) {
      setComparisonPeriodA(monthComparisonOptions.periodA);
      setComparisonPeriodB(monthComparisonOptions.periodB);
    }
  }

  function updateComparisonPeriodA(field: "startIso" | "endIso", value: string) {
    setComparisonPeriodA((prev) => ({ startIso: prev?.startIso ?? "", endIso: prev?.endIso ?? "", [field]: value }));
  }

  function updateComparisonPeriodB(field: "startIso" | "endIso", value: string) {
    setComparisonPeriodB((prev) => ({ startIso: prev?.startIso ?? "", endIso: prev?.endIso ?? "", [field]: value }));
  }

  async function saveSelection(payload: {
    campaigns?: string[];
    selectedCampaigns?: string[];
    dateSelection?: DateSelection;
  }) {
    try {
      await fetch(`/api/clients/${clientId}/reports/selection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      // Best-effort — losing a saved preference isn't worth blocking the wizard over.
    }
  }

  /** Resets everything the Preview/Generate/Download screen (step 4) owns — shared by every place a fresh preview or a full wizard reset needs to guarantee no stale generate/Drive state survives. */
  function resetGenerateState() {
    setGenerateStatus("idle");
    setGenerateMessage(null);
    setReportId(null);
    setDownloadUrl(null);
    setDriveView("collapsed");
    setDriveSaving(false);
    setDriveFolderLinkInput("");
    setDriveFolderNameInput("");
    setDriveLinkFormatError(null);
    setDriveSaveUrl(null);
    setDriveSaveError(null);
    setCopied(false);
  }

  /** Populates campaigns/date state from a successful /analyze response — shared by handleAnalyze (natural detection) and handleMismatchContinueAnyway (forced platform). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function applyAnalyzeResult(json: any) {
    setCampaigns(json.campaigns || []);
    setSelectedCampaigns(new Set<string>(json.selectedCampaigns || []));
    setDateBounds(json.dateBounds || null);
    setWeeklyOptions(json.weeklyOptions || null);
    setMtdRange(json.mtdRange || null);
    setMonthComparisonOptions(json.monthComparisonOptions || null);
    const savedSelection: DateSelection = json.dateSelection || { mode: "last7" };
    setDateMode(savedSelection.mode);
    setCustomStart(savedSelection.customStart || "");
    setCustomEnd(savedSelection.customEnd || "");
    setLongRangeConfirmed(false);
    setComparisonPreset("thisWeek");
    setComparisonPeriodA(json.weeklyOptions?.last7 || null);
    setComparisonPeriodB(json.weeklyOptions?.prev7 || null);
  }

  /** Populates data/comparisonData from a successful /preview response, and clears any stale generate/Drive state left over from a previous attempt. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function applyPreviewResult(json: any) {
    if (json.isComparison) {
      setPreviewKind("comparison");
      setComparisonData(json.data);
      setData(null);
    } else {
      setPreviewKind("normal");
      setData(json.data);
      setComparisonData(null);
    }
    setSlidesListExpanded(false);
    setPreviewStatus("idle");
    resetGenerateState();
  }

  /** Meta keeps its existing multi-step campaigns/dates flow. Google Ads skips straight to the preview — no campaign selection, no report-type toggle, no Previous Month Data (see google-report-data.ts's own file header for why this pipeline is deliberately simpler for v1). */
  async function dispatchAfterAnalyze(platformValue: "META" | "GOOGLE") {
    if (platformValue === "META") {
      setStep(2);
      return;
    }

    if (!mtdFile) return;
    setContinueStatus("loading");
    setPreviewStatus("loading");
    setPreviewErrors([]);
    setPreviewMessage(null);

    const res = await fetch(`/api/clients/${clientId}/reports/preview`, {
      method: "POST",
      body: buildUploadFormData(mtdFile, { platform: platformValue }),
    });
    const json = await res.json().catch(() => null);
    setContinueStatus("idle");

    if (!res.ok || !json) {
      setPreviewStatus("error");
      setPreviewMessage("Something went wrong building the preview. Please try again.");
      return;
    }
    if (!json.valid) {
      setPreviewStatus("invalid");
      setPreviewErrors(json.errors || []);
      return;
    }

    applyPreviewResult(json);
    setStep(5);
  }

  // ── Step 1 -> 2: Analyze ────────────────────────────────────────────────
  // Sends the CSV for natural auto-detection first (no platform override —
  // matches how detection has always worked). If the detected platform
  // matches the card the user picked before uploading, dispatch forward
  // immediately (B1 removes the old "Meta Ads detected — Confirm" screen
  // entirely). If it doesn't match, hold on step 1 and show an inline
  // mismatch warning instead — see handleMismatchContinueAnyway/
  // handleMismatchGoBack for the two ways out of it.
  async function handleAnalyze() {
    if (!mtdFile || !selectedPlatformCard) return;
    setAnalyzeStatus("loading");
    setAnalyzeErrors([]);
    setAnalyzeMessage(null);
    setMismatchWarning(false);

    const res = await fetch(`/api/clients/${clientId}/reports/analyze`, {
      method: "POST",
      body: buildUploadFormData(mtdFile),
    });
    const json = await res.json().catch(() => null);

    if (!res.ok || !json) {
      setAnalyzeStatus("error");
      setAnalyzeMessage("Something went wrong analyzing the CSV. Please try again.");
      return;
    }

    // Platform is detected even on an invalid CSV (see the analyze route) —
    // shown alongside the error list so a wrong detection is diagnosable
    // even when validation also failed for an unrelated reason.
    const detected: "META" | "GOOGLE" = json.detectedPlatform || "META";
    setDetectedPlatform(detected);

    if (!json.valid) {
      setPlatform(detected);
      setAnalyzeStatus("invalid");
      setAnalyzeErrors(json.errors || []);
      return;
    }

    if (detected !== selectedPlatformCard) {
      setPlatform(detected);
      setAnalyzeStatus("idle");
      setMismatchWarning(true);
      return;
    }

    setPlatform(detected);
    applyAnalyzeResult(json);
    setAnalyzeStatus("idle");
    await dispatchAfterAnalyze(detected);
  }

  /** Mismatch warning's "Continue anyway" — re-analyzes with the user's selected platform forced as an override, so a genuinely wrong-platform CSV fails validation honestly instead of silently being parsed as the wrong thing. */
  async function handleMismatchContinueAnyway() {
    if (!mtdFile || !selectedPlatformCard) return;
    setContinueStatus("loading");
    setAnalyzeErrors([]);
    setAnalyzeMessage(null);

    const res = await fetch(`/api/clients/${clientId}/reports/analyze`, {
      method: "POST",
      body: buildUploadFormData(mtdFile, { platform: selectedPlatformCard }),
    });
    const json = await res.json().catch(() => null);
    setContinueStatus("idle");
    setMismatchWarning(false);

    if (!res.ok || !json) {
      setAnalyzeStatus("error");
      setAnalyzeMessage("Something went wrong analyzing the CSV. Please try again.");
      return;
    }

    const detected: "META" | "GOOGLE" = json.detectedPlatform || selectedPlatformCard;
    setDetectedPlatform(detected);
    setPlatform(json.platform || selectedPlatformCard);

    if (!json.valid) {
      setAnalyzeStatus("invalid");
      setAnalyzeErrors(json.errors || []);
      return;
    }

    applyAnalyzeResult(json);
    await dispatchAfterAnalyze(selectedPlatformCard);
  }

  /** Mismatch warning's "Go back" — just clears the warning locally, no re-fetch, so the user can reconsider the platform card or re-upload a different file. */
  function handleMismatchGoBack() {
    setMismatchWarning(false);
  }

  // ── Step 2: Campaigns ───────────────────────────────────────────────────
  function toggleCampaign(name: string) {
    setSelectedCampaigns((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  // ── Step 2 -> 3: Campaigns -> Metrics ───────────────────────────────────
  async function handleCampaignsContinue() {
    await saveSelection({ campaigns, selectedCampaigns: Array.from(selectedCampaigns) });

    if (!mtdFile) return;
    setMetricsStatus("loading");
    setMetricsTouched(false);
    setMetricsLimitMessage(null);
    setShowIndividualCampaignMetrics(false);
    setOpenMetricDropdownIndex(null);

    const res = await fetch(`/api/clients/${clientId}/reports/metrics`, {
      method: "POST",
      body: buildUploadFormData(mtdFile, { platform, selectedCampaigns: Array.from(selectedCampaigns) }),
    });
    const json = await res.json().catch(() => null);

    if (!res.ok || !json || json.error) {
      // The Metric Review step is a nice-to-have preview, not a hard
      // requirement — a failure here shouldn't strand the wizard. Fall
      // through with an empty selection (the engine's automatic
      // assignment) and let the user continue past step 3 regardless.
      setMetricsStatus("error");
      setAvailableMetrics([]);
      setSelectedMetrics([]);
      setStep(3);
      return;
    }

    setAvailableMetrics(json.availableMetrics || []);
    setSelectedMetrics(json.defaultSelection || []);
    setMetricsStatus("idle");
    setStep(3);
  }

  // ── Step 3: Metrics (Part 3) ────────────────────────────────────────────
  /** Metrics available for the dropdown, minus whatever's already selected. */
  function unselectedAvailableMetrics(): AvailableMetric[] {
    const selectedKeys = new Set(selectedMetrics.map((m) => m.key));
    return availableMetrics.filter((m) => !selectedKeys.has(m.key));
  }

  function swapMetricAt(index: number, replacement: AvailableMetric) {
    setMetricsTouched(true);
    setSelectedMetrics((prev) => prev.map((m, i) => (i === index ? { ...replacement } : m)));
    setOpenMetricDropdownIndex(null);
  }

  function removeMetricAt(index: number) {
    if (selectedMetrics.length <= MIN_SELECTED_METRICS) {
      setMetricsLimitMessage(`Keep at least ${MIN_SELECTED_METRICS} metrics.`);
      return;
    }
    setMetricsLimitMessage(null);
    setMetricsTouched(true);
    setSelectedMetrics((prev) => prev.filter((_, i) => i !== index));
  }

  function addMetric(metric: AvailableMetric) {
    if (selectedMetrics.length >= MAX_TOTAL_METRICS) {
      setMetricsLimitMessage(`Maximum ${MAX_TOTAL_METRICS} metrics (2 slides) per campaign.`);
      return;
    }
    setMetricsLimitMessage(null);
    setMetricsTouched(true);
    setSelectedMetrics((prev) => [...prev, metric]);
  }

  function handleMetricsContinue() {
    setStep(4);
  }

  /** Only sent to the preview/generate APIs once the user actually changes something on the Metric Review step — leaving it untouched (the common case: "Most users will just click Continue") keeps the engine's own true per-campaign automatic assignment, rather than pinning every campaign to the single majority-objective default shown in the wizard. */
  function currentSelectedMetricsPayload(): SelectedMetric[] | undefined {
    return metricsTouched && selectedMetrics.length > 0 ? selectedMetrics : undefined;
  }

  // ── Step 4: Dates ───────────────────────────────────────────────────────
  function validateCustomRange(): boolean {
    if (dateMode !== "custom") return true;
    if (!customStart || !customEnd) {
      setCustomRangeError("Choose a start and end date.");
      return false;
    }
    if (dateBounds && (customStart < dateBounds.minIso || customEnd > dateBounds.maxIso)) {
      setCustomRangeError(
        `The uploaded CSV only has data from ${formatIso(dateBounds.minIso)} to ${formatIso(dateBounds.maxIso)}. Choose dates within that range.`,
      );
      return false;
    }
    if (customStart > customEnd) {
      setCustomRangeError("Start date must be before end date.");
      return false;
    }
    setCustomRangeError(null);
    return true;
  }

  function comparisonPeriodsReady(): boolean {
    return !!(comparisonPeriodA?.startIso && comparisonPeriodA?.endIso && comparisonPeriodB?.startIso && comparisonPeriodB?.endIso);
  }

  async function handleDatesContinue() {
    // Monthly has no weekly period selector at all — none of the custom-
    // range validation/confirmation below applies, and no dateSelection is
    // sent (buildReportData then uses the full MTD data with no weekly
    // window — see report-data.ts's primaryRows). Comparison has its own
    // Period A/B requirement instead.
    if (reportType === "WEEKLY") {
      if (!validateCustomRange()) return;
      const spanDays = customSpanDays();
      if (dateMode === "custom" && spanDays !== null && spanDays > 7 && !longRangeConfirmed) {
        return; // the inline "Continue anyway?" prompt handles confirmation
      }
    }

    if (reportType === "COMPARISON" && !comparisonPeriodsReady()) {
      setPreviewStatus("invalid");
      setPreviewErrors([{ field: "comparisonPeriod", message: "Choose both Period A and Period B date ranges." }]);
      return;
    }

    const dateSelection = reportType === "WEEKLY" ? currentDateSelection() : undefined;
    // Only persist a weekly preference when one was actually made — a
    // Monthly/Comparison run shouldn't overwrite the client's remembered
    // weekly date-mode with nothing.
    if (dateSelection) await saveSelection({ dateSelection });

    if (!mtdFile) return;
    setPreviewStatus("loading");
    setPreviewErrors([]);
    setPreviewMessage(null);

    const res = await fetch(`/api/clients/${clientId}/reports/preview`, {
      method: "POST",
      body: buildUploadFormData(mtdFile, {
        selectedCampaigns: Array.from(selectedCampaigns),
        selectedMetrics: currentSelectedMetricsPayload(),
        dateSelection,
        reportType,
        platform,
        comparisonPeriodA: reportType === "COMPARISON" ? comparisonPeriodA : undefined,
        comparisonPeriodB: reportType === "COMPARISON" ? comparisonPeriodB : undefined,
      }),
    });
    const json = await res.json().catch(() => null);

    if (!res.ok || !json) {
      setPreviewStatus("error");
      setPreviewMessage("Something went wrong building the preview. Please try again.");
      return;
    }
    if (!json.valid) {
      setPreviewStatus("invalid");
      setPreviewErrors(json.errors || []);
      return;
    }

    applyPreviewResult(json);
    setStep(5);
  }

  // ── Step 5: Preview + Generate (one screen) ─────────────────────────────
  async function handleGenerate() {
    if (!mtdFile) return;
    setGenerateStatus("loading");
    setGenerateMessage(null);
    setDriveView("collapsed");
    setDriveSaving(false);
    setDriveFolderLinkInput("");
    setDriveFolderNameInput("");
    setDriveLinkFormatError(null);
    setDriveSaveUrl(null);
    setDriveSaveError(null);
    setCopied(false);

    const res = await fetch(`/api/clients/${clientId}/reports`, {
      method: "POST",
      body: buildUploadFormData(mtdFile, {
        selectedCampaigns: Array.from(selectedCampaigns),
        selectedMetrics: currentSelectedMetricsPayload(),
        dateSelection: reportType === "WEEKLY" ? currentDateSelection() : undefined,
        reportTitle: reportTitle.trim() || defaultReportTitleFor(reportType),
        reportType,
        platform,
        comparisonPeriodA: reportType === "COMPARISON" ? comparisonPeriodA : undefined,
        comparisonPeriodB: reportType === "COMPARISON" ? comparisonPeriodB : undefined,
      }),
    });
    const json = await res.json().catch(() => null);

    if (!res.ok || !json?.ok) {
      setGenerateStatus("error");
      setGenerateMessage(json?.error || "Report generation failed. Please try again.");
      return;
    }

    setReportId(json.reportId);
    setDownloadUrl(`/api/reports/${json.reportId}/download`);
    setGenerateStatus("done");
  }

  async function handleSaveToDrive(folderId: string, folderName?: string) {
    if (!reportId) return;
    setDriveSaving(true);
    setDriveSaveError(null);

    const res = await fetch(`/api/reports/${reportId}/save-to-drive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderId, folderName }),
    });
    const json = await res.json().catch(() => null);

    if (!res.ok || !json?.url) {
      setDriveSaving(false);
      setDriveSaveError(json?.message || json?.error || `Request failed with status ${res.status}.`);
      return;
    }

    setDriveSaveUrl(json.url);
    // json.folderName is whatever the user typed, or the server's
    // DEFAULT_DRIVE_FOLDER_NAME fallback if they left it blank — never a
    // raw folder id (see the "Folder name" field below).
    setRememberedFolder({ id: folderId, name: json.folderName });
    setDriveFolderLinkInput("");
    setDriveFolderNameInput("");
    setDriveSaving(false);
    setDriveView("success");
  }

  /** The main "Save to Google Drive" button (collapsed view): one click straight to the remembered folder if there is one, otherwise expands to the paste-a-link input. */
  function handleSaveButtonClick() {
    if (rememberedFolder) {
      // Already has a name from last time — no need to ask again.
      void handleSaveToDrive(rememberedFolder.id, rememberedFolder.name);
    } else {
      setDriveSaveError(null);
      setDriveView("editing");
    }
  }

  /** "Save to this folder" in the paste-a-link input — extracts and validates the id client-side first, so an obviously-wrong paste never even hits the network. */
  function handleSaveToFolderLink() {
    const folderId = extractDriveFolderIdFromLink(driveFolderLinkInput);
    if (!folderId) {
      setDriveLinkFormatError(
        "That doesn't look like a Google Drive folder link. Paste a link like https://drive.google.com/drive/folders/1ABC123xyz",
      );
      return;
    }
    setDriveLinkFormatError(null);
    void handleSaveToDrive(folderId, driveFolderNameInput.trim());
  }

  async function handleCopyLink() {
    if (!driveSaveUrl) return;
    await navigator.clipboard.writeText(driveSaveUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  /** Download screen's "back to dates" navigation — the already-uploaded mtdFile and selectedCampaigns are untouched, so clicking Continue on Step 4 again re-runs the preview against the same CSV with just a different date range, no re-upload needed. */
  function handleBackToDates() {
    setStep(4);
  }

  /** B3's "Generate Another Report for [Client Name]" — a full reset back to Step 1 for the same client, without leaving the wizard (no trip through My Clients). */
  function handleGenerateAnother() {
    setSelectedPlatformCard(null);
    setMtdFile(null);
    setAnalyzeStatus("idle");
    setAnalyzeErrors([]);
    setAnalyzeMessage(null);
    setMismatchWarning(false);
    setDetectedPlatform(null);
    setPlatform("META");

    setCampaigns([]);
    setSelectedCampaigns(new Set());

    setAvailableMetrics([]);
    setSelectedMetrics([]);
    setMetricsStatus("idle");
    setMetricsTouched(false);
    setOpenMetricDropdownIndex(null);
    setMetricsLimitMessage(null);
    setShowIndividualCampaignMetrics(false);

    setDateBounds(null);
    setWeeklyOptions(null);
    setMtdRange(null);
    setDateMode("last7");
    setCustomStart("");
    setCustomEnd("");
    setCustomRangeError(null);
    setLongRangeConfirmed(false);
    setReportType("WEEKLY");
    setComparisonPreset("thisWeek");
    setComparisonPeriodA(null);
    setComparisonPeriodB(null);
    setMonthComparisonOptions(null);

    setPreviewStatus("idle");
    setPreviewErrors([]);
    setPreviewMessage(null);
    setPreviewKind("normal");
    setData(null);
    setComparisonData(null);
    setSlidesListExpanded(false);
    setReportTitle(DEFAULT_REPORT_TITLE);
    setReportTitleTouched(false);

    resetGenerateState();
    setStep(1);
  }

  const spanDays = customSpanDays();
  const needsLongRangeConfirm =
    dateMode === "custom" && spanDays !== null && spanDays > 7 && !customRangeError && !longRangeConfirmed;
  const weeklyRangeIso = currentWeeklyRangeIso();

  /** B2 Section 1's report summary line. */
  function reportSummaryLine(): string {
    if (previewKind === "comparison" && comparisonData) {
      const n = comparisonData.campaigns.length;
      return `${n} campaign${n === 1 ? "" : "s"} · ${comparisonData.periodALabel} vs ${comparisonData.periodBLabel}`;
    }
    if (data) {
      const n = selectedCampaigns.size;
      const parts = [`${n} campaign${n === 1 ? "" : "s"}`];
      if (reportType === "WEEKLY" && weeklyRangeIso) parts.push(`Week: ${formatIsoRange(weeklyRangeIso)}`);
      if (mtdRange) parts.push(`MTD: ${formatIsoRange(mtdRange)}`);
      return parts.join(" · ");
    }
    return "";
  }

  /** B2 Section 2's collapsed slide list. */
  function buildSlideList(): string[] {
    if (previewKind === "comparison" && comparisonData) {
      return [
        "Cover slide",
        ...comparisonData.campaigns.map((c) => `${c.campaignName} — Comparison`),
        "Campaign Comparison Summary",
      ];
    }
    if (data) {
      const list = ["Cover slide"];
      data.campaignSlides.forEach((s) => list.push(`${s.campaignName} — Campaign`));
      data.adSetSlides.forEach((s) => list.push(`${s.campaignName} — ${s.adSetName} — Ad Set`));
      list.push("MTD Performance Chart", "Campaign Performance Overview", "Metric Guide");
      return list;
    }
    return [];
  }

  function reportTypeLabel(): string {
    if (previewKind === "comparison") return "Comparison Report";
    return reportType === "MONTHLY" ? "Monthly Report" : "Weekly Report";
  }

  function driveDateRangeLabel(): string {
    if (previewKind === "comparison" && comparisonData) return `${comparisonData.periodALabel} vs ${comparisonData.periodBLabel}`;
    if (reportType === "WEEKLY" && weeklyRangeIso) return formatIsoRange(weeklyRangeIso);
    if (mtdRange) return formatIsoRange(mtdRange);
    return "";
  }

  /** B3's friendly Drive link label, shown in place of the raw URL. */
  function driveDisplayLabel(): string {
    const range = driveDateRangeLabel();
    return `📊 ${clientName} — ${reportTypeLabel()}${range ? " " + range : ""}`;
  }

  return (
    <div className="space-y-6">
      <StepIndicator step={step} />

      {step === 1 && (
        <div className="space-y-4 rounded-lg border border-dash-border bg-dash-card p-5">
          <h3 className="text-[16px] font-semibold text-white">Select platform</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ReportTypeCard
              icon="📘"
              heading="Meta Ads"
              description="Upload your Meta Ads Manager CSV export"
              selected={selectedPlatformCard === "META"}
              onSelect={() => {
                setSelectedPlatformCard("META");
                setMismatchWarning(false);
                setAnalyzeStatus("idle");
                setAnalyzeErrors([]);
                setAnalyzeMessage(null);
              }}
            />
            <ReportTypeCard
              icon="🔵"
              heading="Google Ads"
              description="Upload your Google Ads CSV export"
              selected={selectedPlatformCard === "GOOGLE"}
              onSelect={() => {
                setSelectedPlatformCard("GOOGLE");
                setMismatchWarning(false);
                setAnalyzeStatus("idle");
                setAnalyzeErrors([]);
                setAnalyzeMessage(null);
              }}
            />
          </div>

          {selectedPlatformCard && (
            <div className="space-y-3">
              <UploadDropzone file={mtdFile} onFileSelected={setMtdFile} />
              <p className="text-[13px] text-dash-ink-secondary">Accepted formats: CSV, Excel, TSV, TXT</p>
              <p className="rounded-md border border-dash-border bg-dash-bg px-3 py-2 text-[13px] text-dash-ink-secondary">
                Tip:{" "}
                {selectedPlatformCard === "META"
                  ? "Set date range to Last 30 Days and Time Increment to Day (Day-Wise Breakdown Sheet)"
                  : "Set date range to Last 30 days and segment by Day"}
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={handleAnalyze}
                  disabled={!mtdFile || analyzeStatus === "loading"}
                  className="rounded-md bg-dash-accent px-4 py-2 text-[13px] font-medium text-dash-ink hover:bg-dash-accent-hover disabled:opacity-50"
                >
                  {analyzeStatus === "loading" ? "Analyzing…" : "Analyze CSV"}
                </button>
                <Link href="/help/download" className="text-[13px] text-dash-accent hover:underline">
                  Not sure how to download? See our guide
                </Link>
              </div>
            </div>
          )}

          {mismatchWarning && (
            <div className="space-y-2 rounded-md border border-amber-900 bg-amber-950/30 p-3">
              <p className="text-[13px] text-amber-200">
                This looks like a {detectedPlatform === "GOOGLE" ? "Google Ads" : "Meta Ads"} CSV, but you selected{" "}
                {selectedPlatformCard === "GOOGLE" ? "Google Ads" : "Meta Ads"} above.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleMismatchContinueAnyway}
                  disabled={continueStatus === "loading"}
                  className="rounded-md bg-dash-accent px-3 py-1.5 text-[13px] font-medium text-dash-ink hover:bg-dash-accent-hover disabled:opacity-50"
                >
                  {continueStatus === "loading" ? "Loading…" : "Continue anyway"}
                </button>
                <button
                  onClick={handleMismatchGoBack}
                  className="rounded-md border border-dash-border px-3 py-1.5 text-[13px] text-dash-ink-secondary hover:bg-dash-border"
                >
                  Go back
                </button>
              </div>
            </div>
          )}

          {analyzeStatus === "invalid" && (
            <div className="space-y-3">
              {analyzeErrors.filter(isNoDataRowsError).map((e, i) => (
                <NoDataRowsWarning key={i} message={e.message} />
              ))}
              {analyzeErrors.filter(isSpecificFieldError).map((e, i) => (
                <SpecificFieldWarning key={i} message={e.message} />
              ))}
              {analyzeErrors.some((e) => !isNoDataRowsError(e) && !isSpecificFieldError(e)) && (
                <div className="rounded-lg border border-red-900 bg-red-950/40 p-4">
                  <p className="mb-2 text-[13px] font-medium text-red-300">
                    This CSV can&apos;t be used to generate a report yet:
                  </p>
                  <ul className="list-inside list-disc space-y-1 text-[13px] text-red-300">
                    {analyzeErrors.filter((e) => !isNoDataRowsError(e) && !isSpecificFieldError(e)).map((e, i) => (
                      <li key={i}>{e.message}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          {analyzeStatus === "error" && analyzeMessage && (
            <div className="rounded-lg border border-red-900 bg-red-950/40 p-4 text-[13px] text-red-300">
              {analyzeMessage}
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4 rounded-lg border border-dash-border bg-dash-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-[16px] font-semibold text-white">Select campaigns to include</h3>
              <p className="text-[13px] text-dash-ink-secondary">
                {selectedCampaigns.size} of {campaigns.length} campaigns selected
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedCampaigns(new Set(campaigns))}
                className="rounded-md border border-dash-border px-3 py-1.5 text-[13px] text-dash-ink-secondary hover:bg-dash-border"
              >
                Select All
              </button>
              <button
                onClick={() => setSelectedCampaigns(new Set())}
                className="rounded-md border border-dash-border px-3 py-1.5 text-[13px] text-dash-ink-secondary hover:bg-dash-border"
              >
                Deselect All
              </button>
            </div>
          </div>

          <ul className="divide-y divide-dash-border rounded-lg border border-dash-border">
            {campaigns.map((name) => (
              <li key={name} className="flex items-center gap-3 px-4 py-2.5">
                <input
                  type="checkbox"
                  id={`campaign-${name}`}
                  checked={selectedCampaigns.has(name)}
                  onChange={() => toggleCampaign(name)}
                  className="h-4 w-4 accent-accent"
                />
                <label htmlFor={`campaign-${name}`} className="cursor-pointer text-[13px] text-dash-ink">
                  {name}
                </label>
              </li>
            ))}
          </ul>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="rounded-md border border-dash-border px-4 py-2 text-[13px] font-medium text-dash-ink hover:bg-dash-border"
            >
              Back
            </button>
            <button
              onClick={handleCampaignsContinue}
              disabled={selectedCampaigns.size === 0 || metricsStatus === "loading"}
              className="rounded-md bg-dash-accent px-4 py-2 text-[13px] font-medium text-dash-ink hover:bg-dash-accent-hover disabled:opacity-50"
            >
              {metricsStatus === "loading" ? "Loading…" : "Continue"}
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4 rounded-lg border border-dash-border bg-dash-card p-5">
          <div>
            <h3 className="text-[16px] font-semibold text-white">Review Metric Cards</h3>
            <p className="mt-1 text-[13px] text-dash-ink-secondary">
              Your report will show these {Math.min(selectedMetrics.length, MAX_METRICS_PER_SLIDE) || MAX_METRICS_PER_SLIDE} metrics
              per campaign slide. Tap any card to change it, or continue with our recommended selection.
            </p>
          </div>

          {metricsStatus === "error" && (
            <div className="rounded-md border border-amber-900 bg-amber-950/30 p-3 text-[13px] text-amber-200">
              Couldn&apos;t load the full metric list — continuing with the engine&apos;s automatic selection.
            </div>
          )}

          {selectedMetrics.length > 0 && (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                {selectedMetrics.map((metric, i) => (
                  <div key={`${metric.key}-${i}`} className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenMetricDropdownIndex(openMetricDropdownIndex === i ? null : i)}
                      className="flex w-full items-center justify-between gap-2 rounded-md border border-dash-border bg-dash-bg px-3 py-2.5 text-left text-[13px] text-dash-ink hover:border-dash-accent"
                    >
                      <span className="truncate">{metric.label}</span>
                      <span className="text-dash-ink-secondary">▼</span>
                    </button>
                    {openMetricDropdownIndex === i && (
                      <div className="absolute z-10 mt-1 max-h-64 w-full min-w-[220px] overflow-y-auto rounded-md border border-dash-border bg-dash-card shadow-lg">
                        <button
                          type="button"
                          onClick={() => removeMetricAt(i)}
                          className="block w-full px-3 py-2 text-left text-[13px] text-red-300 hover:bg-dash-border"
                        >
                          Remove this card
                        </button>
                        <div className="border-t border-dash-border" />
                        {unselectedAvailableMetrics().map((candidate) => (
                          <button
                            key={candidate.key}
                            type="button"
                            onClick={() => swapMetricAt(i, candidate)}
                            className="block w-full px-3 py-2 text-left text-[13px] text-dash-ink hover:bg-dash-border"
                          >
                            {candidate.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {unselectedAvailableMetrics().length > 0 && (
                <div>
                  <p className="mb-2 text-[13px] text-dash-ink-secondary">Add another metric:</p>
                  <div className="flex flex-wrap gap-2">
                    {unselectedAvailableMetrics().map((candidate) => (
                      <button
                        key={candidate.key}
                        type="button"
                        onClick={() => addMetric(candidate)}
                        className="rounded-full border border-dash-border px-3 py-1 text-[12px] text-dash-ink-secondary hover:border-dash-accent hover:text-dash-ink"
                      >
                        + {candidate.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {metricsLimitMessage && <p className="text-[13px] text-amber-300">{metricsLimitMessage}</p>}

              {selectedMetrics.length > MAX_METRICS_PER_SLIDE && (
                <div className="rounded-md border border-dash-accent/40 bg-dash-accent/10 p-3 text-[13px] text-dash-ink">
                  Your selection will generate 2 slides for this campaign. Slide 1: first {MAX_METRICS_PER_SLIDE} metrics.
                  Slide 2: remaining {selectedMetrics.length - MAX_METRICS_PER_SLIDE} metrics.
                </div>
              )}

              <div className="border-t border-dash-border pt-4">
                {!showIndividualCampaignMetrics ? (
                  <button
                    type="button"
                    onClick={() => setShowIndividualCampaignMetrics(true)}
                    className="text-[13px] text-dash-ink-secondary underline hover:text-dash-ink"
                  >
                    ← Change for individual campaigns
                  </button>
                ) : (
                  <div className="rounded-md border border-dash-border bg-dash-bg p-3 text-[13px] text-dash-ink-secondary">
                    Per-campaign metric customization is coming soon. For now, this selection applies to every campaign in
                    the report.{" "}
                    <button
                      type="button"
                      onClick={() => setShowIndividualCampaignMetrics(false)}
                      className="text-dash-accent underline hover:no-underline"
                    >
                      Back
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep(2)}
              className="rounded-md border border-dash-border px-4 py-2 text-[13px] font-medium text-dash-ink hover:bg-dash-border"
            >
              Back
            </button>
            <button
              onClick={handleMetricsContinue}
              disabled={selectedMetrics.length > 0 && selectedMetrics.length < MIN_SELECTED_METRICS}
              className="rounded-md bg-dash-accent px-6 py-2 text-[13px] font-semibold text-dash-ink hover:bg-dash-accent-hover disabled:opacity-50"
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-5">
          <h3 className="text-[13px] font-medium text-dash-ink-secondary">Reporting period</h3>

          {/* Section 1 — Report Type */}
          <section className="rounded-lg border border-dash-border bg-dash-card p-5">
            <h4 className="text-[16px] font-semibold text-white">Report Type</h4>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <ReportTypeCard
                icon="📊"
                heading="Weekly Performance Report"
                description="Shows last 7 days performance with month-to-date comparison"
                selected={reportType === "WEEKLY"}
                onSelect={() => handleReportTypeChange("WEEKLY")}
              />
              <ReportTypeCard
                icon="📅"
                heading="Monthly Performance Report"
                description="Shows full month performance using your complete MTD data"
                selected={reportType === "MONTHLY"}
                onSelect={() => handleReportTypeChange("MONTHLY")}
              />
              <ReportTypeCard
                icon="🔀"
                heading="Comparison Report"
                description="Compares two custom periods side by side, campaign by campaign"
                selected={reportType === "COMPARISON"}
                onSelect={() => handleReportTypeChange("COMPARISON")}
              />
            </div>
          </section>

          <div className="border-t border-dash-border" />

          {/* Section 2 — Date Range (Weekly only) */}
          {reportType === "WEEKLY" && (
            <section className="rounded-lg border border-dash-border bg-dash-card p-5">
              <h4 className="text-[16px] font-semibold text-white">Select Weekly Period</h4>
              <div className="mt-4 flex flex-wrap gap-3">
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
                <WeeklyPeriodOption
                  selected={dateMode === "custom"}
                  label="Custom range"
                  sublabel={
                    dateBounds
                      ? `CSV covers ${formatIso(dateBounds.minIso)} - ${formatIso(dateBounds.maxIso)}`
                      : undefined
                  }
                  onSelect={() => setDateMode("custom")}
                />
              </div>

              {dateMode === "custom" && (
                <div className="mt-4 space-y-3 rounded-md border border-dash-border p-3">
                  <div className="flex flex-wrap gap-3">
                    <div>
                      <label className="mb-1 block text-[13px] text-dash-ink-secondary">Start date</label>
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
                        className="rounded-md border border-dash-border bg-dash-bg px-2 py-1.5 text-[13px] text-dash-ink outline-none focus:border-dash-accent"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[13px] text-dash-ink-secondary">End date</label>
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
                        className="rounded-md border border-dash-border bg-dash-bg px-2 py-1.5 text-[13px] text-dash-ink outline-none focus:border-dash-accent"
                      />
                    </div>
                  </div>

                  {customRangeError && <p className="text-[13px] text-red-400">{customRangeError}</p>}

                  {needsLongRangeConfirm && (
                    <div className="rounded-md border border-amber-900 bg-amber-950/30 p-3">
                      <p className="mb-2 text-[13px] text-amber-200">
                        Weekly reports work best with 7 days or less. Continue anyway?
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setLongRangeConfirmed(true)}
                          className="rounded-md bg-dash-accent px-3 py-1 text-[13px] font-medium text-dash-ink hover:bg-dash-accent-hover"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setCustomEnd("")}
                          className="rounded-md border border-dash-border px-3 py-1 text-[13px] text-dash-ink-secondary hover:bg-dash-border"
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
                  label="This month vs Last month"
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
                    <p className="mb-1 text-[13px] text-dash-ink-secondary">Period A (current)</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="date"
                        value={comparisonPeriodA?.startIso ?? ""}
                        min={dateBounds?.minIso}
                        max={dateBounds?.maxIso}
                        onChange={(e) => updateComparisonPeriodA("startIso", e.target.value)}
                        className="rounded-md border border-dash-border bg-dash-bg px-2 py-1.5 text-[13px] text-dash-ink outline-none focus:border-dash-accent"
                      />
                      <span className="text-[13px] text-dash-ink-secondary">to</span>
                      <input
                        type="date"
                        value={comparisonPeriodA?.endIso ?? ""}
                        min={dateBounds?.minIso}
                        max={dateBounds?.maxIso}
                        onChange={(e) => updateComparisonPeriodA("endIso", e.target.value)}
                        className="rounded-md border border-dash-border bg-dash-bg px-2 py-1.5 text-[13px] text-dash-ink outline-none focus:border-dash-accent"
                      />
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-[13px] text-dash-ink-secondary">Period B (compare)</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="date"
                        value={comparisonPeriodB?.startIso ?? ""}
                        min={dateBounds?.minIso}
                        max={dateBounds?.maxIso}
                        onChange={(e) => updateComparisonPeriodB("startIso", e.target.value)}
                        className="rounded-md border border-dash-border bg-dash-bg px-2 py-1.5 text-[13px] text-dash-ink outline-none focus:border-dash-accent"
                      />
                      <span className="text-[13px] text-dash-ink-secondary">to</span>
                      <input
                        type="date"
                        value={comparisonPeriodB?.endIso ?? ""}
                        min={dateBounds?.minIso}
                        max={dateBounds?.maxIso}
                        onChange={(e) => updateComparisonPeriodB("endIso", e.target.value)}
                        className="rounded-md border border-dash-border bg-dash-bg px-2 py-1.5 text-[13px] text-dash-ink outline-none focus:border-dash-accent"
                      />
                    </div>
                  </div>
                </div>
              )}

              <p className="mt-4 rounded-md border border-dash-border bg-dash-bg px-3 py-2 text-[13px] text-dash-ink-secondary">
                Tip: Your CSV must cover both date ranges. Download a custom date range from Meta Ads Manager that
                includes all dates from both periods.
              </p>
            </section>
          )}

          {/* Section 3 — Month to Date / Full Month Period (not shown for Comparison) */}
          {reportType !== "COMPARISON" && (
            <section className="rounded-lg border border-dash-border border-l-4 border-l-dash-accent bg-dash-card p-5">
              <h4 className="text-[16px] font-semibold text-white">
                {reportType === "MONTHLY" ? "Full Month Period" : "Month to Date Period"}
              </h4>
              <p className="mt-3 text-[13px] text-dash-ink">
                {mtdRange
                  ? `${formatIsoRangeWithYear(mtdRange)} (auto-detected from your CSV)`
                  : "Month to Date period unavailable"}
              </p>
              <p className="mt-1 text-[13px] text-dash-ink-secondary">
                This is automatically calculated from your uploaded CSV data.
              </p>
            </section>
          )}

          {previewStatus === "invalid" && (
            <div className="space-y-3">
              {previewErrors.filter(isNoDataRowsError).map((e, i) => (
                <NoDataRowsWarning key={i} message={e.message} />
              ))}
              {previewErrors.filter(isSpecificFieldError).map((e, i) => (
                <SpecificFieldWarning key={i} message={e.message} />
              ))}
              {previewErrors.some((e) => !isNoDataRowsError(e) && !isSpecificFieldError(e)) && (
                <div className="rounded-lg border border-red-900 bg-red-950/40 p-4">
                  <p className="mb-2 text-[13px] font-medium text-red-300">Can&apos;t build a preview yet:</p>
                  <ul className="list-inside list-disc space-y-1 text-[13px] text-red-300">
                    {previewErrors.filter((e) => !isNoDataRowsError(e) && !isSpecificFieldError(e)).map((e, i) => (
                      <li key={i}>{e.message}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          {previewStatus === "error" && previewMessage && (
            <div className="rounded-lg border border-red-900 bg-red-950/40 p-4 text-[13px] text-red-300">
              {previewMessage}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep(3)}
              className="rounded-md border border-dash-border px-4 py-2 text-[13px] font-medium text-dash-ink hover:bg-dash-border"
            >
              Back
            </button>
            <button
              onClick={handleDatesContinue}
              disabled={
                previewStatus === "loading" ||
                (reportType === "WEEKLY" &&
                  ((dateMode === "custom" && (!customStart || !customEnd)) || needsLongRangeConfirm)) ||
                (reportType === "COMPARISON" && !comparisonPeriodsReady())
              }
              className="rounded-md bg-dash-accent px-4 py-2 text-[13px] font-medium text-dash-ink hover:bg-dash-accent-hover disabled:opacity-50"
            >
              {previewStatus === "loading" ? "Loading preview…" : "Continue"}
            </button>
          </div>
        </div>
      )}

      {step === 5 && (data || comparisonData) && (
        <div className="space-y-6">
          {/* Section 1 — Report Summary */}
          <div className="rounded-lg border border-dash-border border-l-4 border-l-dash-accent bg-dash-card p-4">
            <p className="text-[13px] text-dash-ink">{reportSummaryLine()}</p>
          </div>

          {previewKind === "normal" && data?.isPaused && (
            <div className="rounded-lg border border-amber-900 bg-amber-950/30 p-4 text-[13px] text-amber-200">
              {data.pausedMessage}
            </div>
          )}

          {previewKind === "normal" && data && !data.isPaused && data.objectiveWarnings.length > 0 && (
            <div className="space-y-2">
              {data.objectiveWarnings.map((w) => (
                <div
                  key={w.campaignName}
                  className="rounded-lg border border-amber-900 bg-amber-950/30 p-4 text-[13px] text-amber-200"
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

          {/* Section 2 — Slides Preview */}
          <div className="rounded-lg border border-dash-border bg-dash-card p-4">
            <button
              type="button"
              onClick={() => setSlidesListExpanded((v) => !v)}
              className="text-[13px] font-medium text-dash-ink-secondary hover:text-dash-ink"
            >
              Slides Preview {slidesListExpanded ? "▲" : "▼"}
            </button>
            {slidesListExpanded && (
              <ul className="mt-3 space-y-1 text-[13px] text-dash-ink-secondary">
                {buildSlideList().map((s, i) => (
                  <li key={i}>• {s}</li>
                ))}
              </ul>
            )}
          </div>

          {/* Section 3 — Custom title */}
          <div>
            <label className="mb-1 block text-[13px] text-dash-ink-secondary">Custom title (optional)</label>
            <input
              value={reportTitle}
              onChange={(e) => {
                setReportTitle(e.target.value);
                setReportTitleTouched(true);
              }}
              placeholder={defaultReportTitleFor(reportType)}
              maxLength={100}
              disabled={generateStatus === "loading" || generateStatus === "done"}
              className="w-full max-w-md rounded-md border border-dash-border bg-dash-card px-3 py-2 text-[13px] text-dash-ink outline-none focus:border-dash-accent disabled:opacity-60"
            />
            <p className="mt-1 text-[13px] text-dash-ink-secondary">
              Replaces the report type title on the cover slide.
            </p>
          </div>

          {/* Same screen throughout: only this action row changes as
              generateStatus moves idle -> loading -> done/error, so there's
              no navigation between "getting ready" and "here's your file". */}
          {generateStatus === "idle" && (
            <div className="flex gap-3">
              <button
                onClick={() => setStep(4)}
                className="rounded-md border border-dash-border px-4 py-2 text-[13px] font-medium text-dash-ink hover:bg-dash-border"
              >
                Back
              </button>
              <button
                onClick={handleGenerate}
                className="rounded-md bg-dash-accent px-6 py-3 text-base font-semibold text-dash-ink hover:bg-dash-accent-hover"
              >
                Generate Report
              </button>
            </div>
          )}

          {generateStatus === "loading" && (
            <div className="flex items-center gap-3 rounded-lg border border-dash-border bg-dash-card p-4 text-[13px] text-dash-ink-secondary">
              <Spinner />
              Generating your report…
            </div>
          )}

          {generateStatus === "error" && (
            <div className="space-y-3">
              <div className="rounded-lg border border-red-900 bg-red-950/40 p-4 text-[13px] text-red-300">
                {generateMessage}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(4)}
                  className="rounded-md border border-dash-border px-4 py-2 text-[13px] font-medium text-dash-ink hover:bg-dash-border"
                >
                  Back
                </button>
                <button
                  onClick={handleGenerate}
                  className="rounded-md bg-dash-accent px-4 py-2 text-[13px] font-medium text-dash-ink hover:bg-dash-accent-hover"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {generateStatus === "done" && downloadUrl && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleGenerateAnother}
                className="rounded-[6px] border border-[#4a90d9] bg-[#1e3a5f] px-5 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-[#2d4f7c]"
              >
                ← Generate Another Report for {clientName}
              </button>

              <button
                type="button"
                onClick={handleBackToDates}
                className="block text-[13px] text-dash-ink-secondary hover:text-dash-ink-secondary hover:underline"
              >
                ← Back to dates
              </button>

              <div className="flex flex-wrap items-start gap-3">
                <a
                  href={downloadUrl}
                  className="inline-block rounded-md bg-emerald-600 px-4 py-2 text-[13px] font-medium text-dash-ink hover:bg-emerald-500"
                >
                  Download PPTX
                </a>

                {/* State 4 (not connected): nothing Drive-related renders at all. */}
                {hasGoogleDriveConnected && driveView === "collapsed" && (
                  <div>
                    <button
                      onClick={handleSaveButtonClick}
                      disabled={driveSaving}
                      className="inline-flex items-center gap-2 rounded-md bg-dash-accent px-4 py-2 text-[13px] font-medium text-dash-ink hover:bg-dash-accent-hover disabled:opacity-50"
                    >
                      <DriveIcon />
                      {driveSaving ? "Saving to Drive…" : "Save to Google Drive"}
                    </button>
                    {/* State 2: a folder is already remembered for this client. */}
                    {rememberedFolder && (
                      <p className="mt-1.5 text-[13px] text-dash-ink-secondary">
                        Saving to: <span className="text-dash-ink">{rememberedFolder.name}</span>{" "}
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
                    )}
                  </div>
                )}
              </div>

              {/* State 1 (no remembered folder) / "Change" from State 2 — the paste-a-link input, hidden behind the button until clicked. */}
              {hasGoogleDriveConnected && driveView === "editing" && (
                <div className="space-y-3 rounded-lg border border-dash-border bg-dash-card p-4">
                  <div>
                    <label className="block text-[13px] text-dash-ink-secondary">Folder link:</label>
                    <input
                      type="text"
                      value={driveFolderLinkInput}
                      onChange={(e) => {
                        setDriveFolderLinkInput(e.target.value);
                        setDriveLinkFormatError(null);
                      }}
                      placeholder="https://drive.google.com/drive/folders/1ABC123xyz"
                      className="mt-1 w-full rounded-md border border-dash-border bg-dash-bg px-3 py-2 text-[13px] text-dash-ink outline-none focus:border-dash-accent"
                    />
                    <p className="mt-1 text-[13px] text-dash-ink-secondary">
                      Open Google Drive → navigate to your folder → right-click → Get link → Copy link → paste it
                      here
                    </p>
                    {driveLinkFormatError && <p className="mt-1 text-[13px] text-red-400">{driveLinkFormatError}</p>}
                  </div>

                  <div>
                    <label className="block text-[13px] text-dash-ink-secondary">
                      Folder name <span className="text-dash-ink-secondary">— optional, but recommended</span>:
                    </label>
                    <input
                      type="text"
                      value={driveFolderNameInput}
                      onChange={(e) => setDriveFolderNameInput(e.target.value)}
                      placeholder="e.g. Reports or Alonzo Carr / Reports"
                      className="mt-1 w-full rounded-md border border-dash-border bg-dash-bg px-3 py-2 text-[13px] text-dash-ink outline-none focus:border-dash-accent"
                    />
                    <p className="mt-1 text-[13px] text-dash-ink-secondary">
                      Type a name to help you identify this folder — shown as &quot;Saving to: ...&quot; next time.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={handleSaveToFolderLink}
                      disabled={!driveFolderLinkInput.trim() || driveSaving}
                      className="rounded-md bg-dash-accent px-4 py-2 text-[13px] font-medium text-dash-ink hover:bg-dash-accent-hover disabled:opacity-50"
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
                      className="rounded-md border border-dash-border px-3 py-2 text-[13px] text-dash-ink-secondary hover:bg-dash-border disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {driveSaveError && <p className="text-[13px] text-red-400">{driveSaveError}</p>}

              {/* State 3: button/input are both gone, replaced by the shareable link + share row. */}
              {driveView === "success" && driveSaveUrl && (
                <div className="rounded-lg border border-emerald-800 bg-emerald-950/30 p-4">
                  <p className="mb-2 text-[13px] uppercase tracking-wide text-emerald-300">
                    Saved to Google Drive ✓
                  </p>
                  <a
                    href={driveSaveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mb-3 block break-all text-[13px] text-dash-accent hover:underline"
                  >
                    {driveDisplayLabel()}
                  </a>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={handleCopyLink}
                      className="inline-flex items-center gap-1.5 rounded-md bg-dash-accent px-3 py-1.5 text-[13px] font-medium text-dash-ink hover:bg-dash-accent-hover"
                    >
                      <CopyIcon />
                      {copied ? "Copied!" : "Copy Link"}
                    </button>
                    <a
                      href={buildWhatsAppShareUrl(driveSaveUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md border border-dash-border bg-dash-bg px-3 py-1.5 text-[13px] text-dash-ink-secondary hover:bg-dash-border"
                    >
                      <WhatsAppIcon />
                      WhatsApp
                    </a>
                    <a
                      href={buildEmailShareUrl(driveSaveUrl)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-dash-border bg-dash-bg px-3 py-1.5 text-[13px] text-dash-ink-secondary hover:bg-dash-border"
                    >
                      <MailIcon />
                      Email
                    </a>
                  </div>
                  <button
                    onClick={() => {
                      setDriveView("editing");
                      setDriveSaveUrl(null);
                    }}
                    className="mt-3 text-[13px] text-dash-ink-secondary hover:underline"
                  >
                    Save to a different folder
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={handleBackToDates}
                className="block text-[13px] text-dash-ink-secondary hover:text-dash-ink-secondary hover:underline"
              >
                Change dates and regenerate
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StepIndicator({ step }: { step: Step }) {
  const steps: Step[] = [1, 2, 3, 4, 5];
  return (
    <div className="flex flex-wrap items-center gap-2 text-[13px]">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <span
            className={
              s === step
                ? "rounded-full bg-dash-accent px-3 py-1 font-medium text-dash-ink"
                : s < step
                  ? "rounded-full border border-dash-accent px-3 py-1 text-dash-accent"
                  : "rounded-full border border-dash-border px-3 py-1 text-dash-ink-secondary"
            }
          >
            {STEP_LABELS[s]}
          </span>
          {i < steps.length - 1 && <span className="text-dash-ink-secondary">→</span>}
        </div>
      ))}
    </div>
  );
}

/** Small inline spinner for the Preview screen's "Generating your report…" state — no extra dependency needed for one spinning icon. */
function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin text-dash-accent" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// Small inline icons for the Drive share row (Copy Link / WhatsApp / Email)
// — no icon library dependency for three glyphs.
function CopyIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 3a9 9 0 00-7.75 13.5L3 21l4.65-1.22A9 9 0 1012 3z" />
      <path d="M8.5 8.5c0 4 3 7 7 7 .8 0 1-.7 1-1.2v-1c0-.3-.2-.5-.5-.6l-1.7-.5c-.3 0-.5 0-.6.3l-.4.7c-1.3-.6-2.3-1.6-2.9-2.9l.7-.4c.2-.1.3-.4.2-.6l-.5-1.7c0-.3-.3-.5-.6-.5h-1c-.5 0-1.2.2-1.2 1z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}

/** Simple triangular drive/folder pictogram for the "Save to Google Drive" button — a generic glyph, not a reproduction of Google's own logo artwork. */
function DriveIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8.5 3h7l6 10.5-3.5 6h-12l-3.5-6L8.5 3z" fill="currentColor" opacity="0.9" />
      <path d="M8.5 3h7l6 10.5h-7L8.5 3z" fill="currentColor" opacity="0.55" />
    </svg>
  );
}

/**
 * Renders NO_DATA_ROWS_MESSAGE's paragraph / bulleted-causes / numbered-steps
 * structure as real list markup instead of a wall of text — the message is
 * plain text with blank-line-separated blocks so it also reads fine
 * anywhere else it might surface (API responses, logs), and this is the one
 * place that turns it into proper `<ul>`/`<ol>` elements.
 */
function NoDataRowsWarning({ message }: { message: string }) {
  const blocks = message.split("\n\n").map((block) => block.split("\n").filter((line) => line.trim() !== ""));

  return (
    <div className="space-y-3 rounded-lg border border-amber-900 bg-amber-950/30 p-4 text-[13px] text-amber-200">
      {blocks.map((lines, i) => {
        if (lines.every((l) => l.startsWith("• "))) {
          return (
            <ul key={i} className="list-inside list-disc space-y-1">
              {lines.map((l, j) => (
                <li key={j}>{l.replace(/^•\s*/, "")}</li>
              ))}
            </ul>
          );
        }
        if (lines.every((l) => /^\d+\.\s/.test(l))) {
          return (
            <ol key={i} className="list-inside list-decimal space-y-1">
              {lines.map((l, j) => (
                <li key={j}>{l.replace(/^\d+\.\s*/, "")}</li>
              ))}
            </ol>
          );
        }
        return (
          <p key={i} className="font-medium text-amber-100">
            {lines.join(" ")}
          </p>
        );
      })}
    </div>
  );
}

/** Step 1's platform cards and Step 3's Report Type cards share this same "full selectable card" shape (icon/heading/description) — plain buttons rather than native radios, since the visual design calls for full selectable cards, not a radio dot + label row. */
function ReportTypeCard({
  icon,
  heading,
  description,
  selected,
  onSelect,
}: {
  icon: string;
  heading: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`rounded-lg border p-4 text-left transition-colors ${
        selected
          ? "border-dash-accent bg-dash-accent/10"
          : "border-dash-border bg-dash-bg hover:bg-dash-border/30"
      }`}
    >
      <span className="text-2xl" aria-hidden="true">
        {icon}
      </span>
      <p className="mt-2 text-[15px] font-semibold text-white">{heading}</p>
      <p className="mt-1 text-[13px] text-dash-ink-secondary">{description}</p>
    </button>
  );
}

/** Section 2's weekly-period / comparison-preset pill options — same button-based selection pattern as ReportTypeCard above, just smaller. */
function WeeklyPeriodOption({
  selected,
  label,
  sublabel,
  onSelect,
}: {
  selected: boolean;
  label: string;
  sublabel?: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`rounded-lg border px-4 py-2.5 text-left transition-colors ${
        selected
          ? "border-dash-accent bg-dash-accent/10"
          : "border-dash-border bg-dash-bg hover:bg-dash-border/30"
      }`}
    >
      <span className="block text-[13px] font-medium text-white">{label}</span>
      {sublabel && <span className="mt-0.5 block text-[12px] text-dash-ink-secondary">{sublabel}</span>}
    </button>
  );
}

/** Step 1's drag-and-drop CSV upload zone (B1) — a plain file input wrapped in a `<label>` so a click anywhere in the zone opens the file picker, with native HTML5 drag-and-drop events layered on top for the "drop here" path. */
function UploadDropzone({ file, onFileSelected }: { file: File | null; onFileSelected: (f: File | null) => void }) {
  const [dragOver, setDragOver] = useState(false);
  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const dropped = e.dataTransfer.files?.[0];
        if (dropped) onFileSelected(dropped);
      }}
      className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
        dragOver ? "border-dash-accent bg-dash-accent/10" : "border-dash-border bg-dash-bg hover:bg-dash-border/20"
      }`}
    >
      <input
        type="file"
        accept={ACCEPTED_FILE_TYPES}
        onChange={(e) => onFileSelected(e.target.files?.[0] ?? null)}
        className="hidden"
      />
      <span className="text-[13px] font-medium text-dash-ink">
        {file ? file.name : "Drop your CSV here or click to browse"}
      </span>
      {!file && <span className="text-[13px] text-dash-ink-secondary">CSV, Excel, TSV, TXT</span>}
    </label>
  );
}
