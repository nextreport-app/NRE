"use client";

import { useState } from "react";
import Link from "next/link";
import type { ReportData } from "@/lib/nre/report-data";
import type { ValidationIssue } from "@/lib/nre/validate";
import { extractDriveFolderIdFromLink } from "@/lib/drive-link";
import { getAvailableMetrics, selectMetrics, type SelectedMetric } from "@/lib/nre/metric-selector";
import { detectGoogleObjectiveKey } from "@/lib/nre/detect-objective";

// Ad-set-level filtering was removed from the wizard (product decision: it
// produced MTD totals that no longer matched real account spend, which
// misled clients). The underlying filter logic still lives in
// lib/nre/ad-sets.ts and report-data.ts's selectedAdSets param — untouched,
// just never called from here — so it can come back without re-deriving it.
// Preview + Generate are one screen (see the step === 5 block below) — the
// action row at the bottom swaps between "Generate" button, a loading
// spinner, the download/slides links, or an error + Try Again, all without
// navigating away, so the step indicator only ever needs to count 5 steps.
type Step = 1 | 2 | 3 | 4 | 5;
const STEP_LABELS: Record<Step, string> = {
  1: "Upload",
  2: "Metrics",
  3: "Campaigns",
  4: "Dates",
  5: "Preview",
};

// Soft, non-blocking guidance only (product fix — the hard 4-8 cap was
// removed: users can select as few or as many metrics as they want, and a
// campaign whose selection exceeds 8 cards simply spans multiple slides at
// generation time — see dynamic-metrics.ts's buildDynamicMetricSlides).
const RECOMMENDED_MIN_METRICS = 4;

// "detected" pauses on step 1 after a successful analyze, showing the
// platform badge + override dropdown + a Continue button — see
// handleAnalyze/handleContinueAfterDetect — before dispatching into either
// Meta's multi-step (campaigns/dates) flow or Google Ads' direct-to-preview
// one, so the user has a chance to fix a wrong auto-detection first.
type AnalyzeStatus = "idle" | "loading" | "invalid" | "error" | "detected";
type PreviewStatus = "idle" | "loading" | "invalid" | "error";
type GenerateStatus = "idle" | "loading" | "done" | "error";
type DateMode = "last7" | "prev7" | "custom";
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

// Matches fill-tags.ts's DEFAULT_REPORT_TITLE/DEFAULT_MONTHLY_REPORT_TITLE —
// kept as separate constants here rather than imported, since that module
// pulls in the whole PPTX generation stack (JSZip etc.) which has no
// business in the client bundle.
const DEFAULT_REPORT_TITLE = "Weekly Performance Report";
const DEFAULT_MONTHLY_REPORT_TITLE = "Monthly Performance Report";

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

// Step 1's "what to download" tips — static, not day-of-month-dependent.
// "This Month" never reliably covers a full 7-day weekly period (it's
// empty on the 1st and still short of 7 days through the 7th), so "Last
// 30 Days" is the one setting that always works, every day of the month,
// for either platform.
const META_UPLOAD_TIP =
  "Tip: In Meta Ads Manager, set your date range to Last 30 Days and Time Increment to Day before downloading. This works correctly every day of the month and ensures your weekly report always has complete 7-day data.";
const GOOGLE_UPLOAD_TIP =
  "Tip: In Google Ads, set your date range to Last 30 days and segment by Day before downloading.";

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
    <div className="rounded-lg border border-amber-900 bg-amber-950/30 p-4 text-sm text-amber-200">
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
  const subject = encodeURIComponent("Your Weekly Performance Report");
  const body = encodeURIComponent(`Please find your report here: ${reportUrl}`);
  return `mailto:?subject=${subject}&body=${body}`;
}

export function ReportUploadWizard({
  clientId,
  hasGoogleDriveConnected,
  initialLastDriveFolderId,
  initialLastDriveFolderName,
}: {
  clientId: string;
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

  // Step 1 — Upload
  const [mtdFile, setMtdFile] = useState<File | null>(null);
  const [analyzeStatus, setAnalyzeStatus] = useState<AnalyzeStatus>("idle");
  const [analyzeErrors, setAnalyzeErrors] = useState<ValidationIssue[]>([]);
  const [analyzeMessage, setAnalyzeMessage] = useState<string | null>(null);
  // Auto-detected from the CSV's own column headers (see
  // lib/nre/google-columns.ts's detectPlatform) — `platform` starts equal
  // to it and only diverges if the user picks a different value from the
  // override dropdown. Both are set together in handleAnalyze and read by
  // handleContinueAfterDetect once the user confirms/overrides and clicks
  // Continue.
  const [detectedPlatform, setDetectedPlatform] = useState<"META" | "GOOGLE" | null>(null);
  const [platform, setPlatform] = useState<"META" | "GOOGLE">("META");
  const [continueStatus, setContinueStatus] = useState<"idle" | "loading">("idle");
  // Raw CSV column headers from /analyze — the input to the Step 2 metric
  // selector (see handleContinueAfterDetect, which computes
  // availableMetrics/selectedMetrics from these once the platform is
  // confirmed).
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  // Meta only — one objective key PER campaign detected server-side (see
  // the /analyze route's detectCampaignObjectives), not a single account-
  // wide guess. A mixed-objective account (Reach + Traffic + Lead Gen
  // campaigns in one CSV) needs every campaign's own objective considered,
  // or the auto-suggested selection silently favors whichever objective an
  // account-wide heuristic happened to guess and hides the rest — see
  // metric-selector.ts's selectMetrics, which now accepts this whole array
  // and unions every campaign's relevant secondaries into one suggestion.
  const [detectedObjectives, setDetectedObjectives] = useState<string[]>([]);

  // Step 2 — Metrics (dynamic metric dictionary system). availableMetrics is
  // the full detected candidate pool (both included and not-included come
  // from it); selectedMetrics is the "Included" list, in priority-descending
  // order — that fixed order becomes the PPT card grid's left-to-right/
  // top-to-bottom order (see dynamic-cards.ts). No manual reordering: order
  // is entirely priority-driven. Pre-selected automatically by
  // selectMetrics() in handleContinueAfterDetect; the user can freely add/
  // remove metrics from here, with no minimum or maximum — a campaign whose
  // selection exceeds 8 cards simply spans multiple slides at generation
  // time instead of forcing a choice here.
  const [availableMetrics, setAvailableMetrics] = useState<SelectedMetric[]>([]);
  const [selectedMetrics, setSelectedMetrics] = useState<SelectedMetric[]>([]);

  // Step 3 — Campaigns (populated by /analyze). Always shown in full for
  // Meta uploads — see handleAnalyze and lib/nre/campaigns.ts's
  // resolveCampaignSelection, which the /analyze route calls to decide the
  // pre-checked default (everything, for a first-ever upload; last time's
  // saved selection, for a returning one) without ever skipping the step.
  const [campaigns, setCampaigns] = useState<string[]>([]);
  const [selectedCampaigns, setSelectedCampaigns] = useState<Set<string>>(new Set());

  // Step 3 — Dates (populated by /analyze)
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
  // only — see handleDatesContinue/handleGenerate, which skip sending a
  // dateSelection at all when Monthly (buildReportData then has no weekly
  // window to use, by design — see report-data.ts's primaryRows).
  const [reportType, setReportType] = useState<"WEEKLY" | "MONTHLY">("WEEKLY");

  // Step 4 — Preview
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>("idle");
  const [previewErrors, setPreviewErrors] = useState<ValidationIssue[]>([]);
  const [previewMessage, setPreviewMessage] = useState<string | null>(null);
  const [data, setData] = useState<ReportData | null>(null);
  const [reportTitle, setReportTitle] = useState(DEFAULT_REPORT_TITLE);
  // False until the user actually types in the Report Title field — while
  // false, switching Report Type keeps swapping the title's own default
  // text (Weekly/Monthly Performance Report) to match; once true, their
  // custom title is left alone regardless of which Report Type is picked.
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

  /** Report Type radio's onChange — also swaps the Report Title default text, unless the user has already typed their own. */
  function handleReportTypeChange(next: "WEEKLY" | "MONTHLY") {
    setReportType(next);
    if (!reportTitleTouched) {
      setReportTitle(next === "MONTHLY" ? DEFAULT_MONTHLY_REPORT_TITLE : DEFAULT_REPORT_TITLE);
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

  // ── Step 1 -> 2: Analyze ────────────────────────────────────────────────
  async function handleAnalyze() {
    if (!mtdFile) return;
    setAnalyzeStatus("loading");
    setAnalyzeErrors([]);
    setAnalyzeMessage(null);

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
    setPlatform(json.platform || detected);

    if (!json.valid) {
      setAnalyzeStatus("invalid");
      setAnalyzeErrors(json.errors || []);
      return;
    }

    setCsvHeaders(json.headers || []);
    setDetectedObjectives(json.detectedObjectives || []);
    setCampaigns(json.campaigns || []);
    setSelectedCampaigns(new Set<string>(json.selectedCampaigns || []));
    setDateBounds(json.dateBounds || null);
    setWeeklyOptions(json.weeklyOptions || null);
    setMtdRange(json.mtdRange || null);
    const savedSelection: DateSelection = json.dateSelection || { mode: "last7" };
    setDateMode(savedSelection.mode);
    setCustomStart(savedSelection.customStart || "");
    setCustomEnd(savedSelection.customEnd || "");
    setLongRangeConfirmed(false);

    // Pause on step 1 so the platform badge/override is visible before
    // dispatching further — see handleContinueAfterDetect.
    setAnalyzeStatus("detected");
  }

  // ── Step 1 (post-detect): confirm platform, seed the metric selector ────
  // Both platforms now land on Step 2 (Metrics) — see handleMetricsContinue
  // below for where the Meta-vs-Google dispatch actually happens (Meta into
  // its existing multi-step campaigns/dates flow, Google straight to the
  // preview, same split as before, just one step later).
  function handleContinueAfterDetect() {
    setAnalyzeStatus("idle");
    const platformKey = platform === "GOOGLE" ? "google" : "meta";
    // Google: single account-wide objective (unchanged — Google Ads
    // accounts don't mix campaign types the way a Meta account testing
    // Reach + Traffic + Lead Gen together does). Meta: the union of every
    // campaign's own detected objective (see the /analyze route's
    // detectCampaignObjectives) — falls back to an empty array (no
    // objective filter at all, i.e. every detected secondary metric
    // qualifies) only in the defensive case where the server sent none.
    const objectiveKeys: string | string[] =
      platform === "GOOGLE" ? detectGoogleObjectiveKey(csvHeaders) : detectedObjectives;
    setAvailableMetrics(getAvailableMetrics(csvHeaders, platformKey));
    setSelectedMetrics(selectMetrics(csvHeaders, platformKey, objectiveKeys));
    setStep(2);
  }

  // ── Step 2: Metrics ──────────────────────────────────────────────────────
  function addMetric(metric: SelectedMetric) {
    if (selectedMetrics.some((m) => m.key === metric.key)) return;
    setSelectedMetrics((prev) => [...prev, metric].sort((a, b) => b.priority - a.priority));
  }

  function removeMetric(key: string) {
    setSelectedMetrics((prev) => prev.filter((m) => m.key !== key));
  }

  // Meta keeps its existing multi-step campaigns/dates flow unchanged.
  // Google Ads skips straight to the preview — no campaign selection, no
  // weekly/monthly toggle, no Previous Month Data (see google-report-data.ts's
  // own file header for why this pipeline is deliberately simpler for v1).
  async function handleMetricsContinue() {
    if (platform === "META") {
      setStep(3);
      return;
    }

    if (!mtdFile) return;
    setContinueStatus("loading");
    setPreviewStatus("loading");
    setPreviewErrors([]);
    setPreviewMessage(null);

    const res = await fetch(`/api/clients/${clientId}/reports/preview`, {
      method: "POST",
      body: buildUploadFormData(mtdFile, { platform, selectedMetrics }),
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

    setData(json.data);
    setPreviewStatus("idle");
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
    setStep(5);
  }

  // ── Step 3: Campaigns ───────────────────────────────────────────────────
  function toggleCampaign(name: string) {
    setSelectedCampaigns((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  async function handleCampaignsContinue() {
    await saveSelection({ campaigns, selectedCampaigns: Array.from(selectedCampaigns) });
    setStep(4);
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

  async function handleDatesContinue() {
    // Monthly has no weekly period selector at all — none of the custom-
    // range validation/confirmation below applies, and no dateSelection is
    // sent (buildReportData then uses the full MTD data with no weekly
    // window — see report-data.ts's primaryRows).
    if (reportType === "WEEKLY") {
      if (!validateCustomRange()) return;
      const spanDays = customSpanDays();
      if (dateMode === "custom" && spanDays !== null && spanDays > 7 && !longRangeConfirmed) {
        return; // the inline "Continue anyway?" prompt handles confirmation
      }
    }

    const dateSelection = reportType === "WEEKLY" ? currentDateSelection() : undefined;
    // Only persist a weekly preference when one was actually made — a
    // Monthly run shouldn't overwrite the client's remembered weekly
    // date-mode with nothing.
    if (dateSelection) await saveSelection({ dateSelection });

    if (!mtdFile) return;
    setPreviewStatus("loading");
    setPreviewErrors([]);
    setPreviewMessage(null);

    const res = await fetch(`/api/clients/${clientId}/reports/preview`, {
      method: "POST",
      body: buildUploadFormData(mtdFile, {
        selectedCampaigns: Array.from(selectedCampaigns),
        dateSelection,
        reportType,
        platform,
        selectedMetrics,
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

    setData(json.data);
    setPreviewStatus("idle");
    // A fresh preview means a fresh Preview screen — clear out any
    // generate/slides state left over from a previous attempt so returning
    // here (e.g. after changing the date range) never shows a stale error,
    // download link, or Google Slides link from before.
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
        dateSelection: reportType === "WEEKLY" ? currentDateSelection() : undefined,
        reportTitle:
          reportTitle.trim() || (reportType === "MONTHLY" ? DEFAULT_MONTHLY_REPORT_TITLE : DEFAULT_REPORT_TITLE),
        reportType,
        platform,
        selectedMetrics,
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

  const spanDays = customSpanDays();
  const needsLongRangeConfirm =
    dateMode === "custom" && spanDays !== null && spanDays > 7 && !customRangeError && !longRangeConfirmed;
  const weeklyRangeIso = currentWeeklyRangeIso();
  const availableNotIncludedMetrics = availableMetrics.filter(
    (m) => !selectedMetrics.some((s) => s.key === m.key),
  );

  return (
    <div className="space-y-6">
      <StepIndicator step={step} />

      {step === 1 && (
        <div className="space-y-4 rounded-lg border border-dash-border bg-dash-card p-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-dash-ink-secondary">
              MTD Daily CSV <span className="text-red-400">*</span>
            </label>
            <p className="mb-2 text-[13px] text-dash-ink-secondary">
              Meta Ads Manager → Reporting → Time Increment = Day → Export. CSV, TSV, TXT, or Excel
              (.xlsx/.xls) — any delimiter or encoding.
            </p>
            <div className="mb-2 space-y-2">
              <p className="rounded-md border border-dash-border bg-dash-bg px-3 py-2 text-[13px] text-dash-ink-secondary">
                {META_UPLOAD_TIP}
              </p>
              <p className="rounded-md border border-dash-border bg-dash-bg px-3 py-2 text-[13px] text-dash-ink-secondary">
                {GOOGLE_UPLOAD_TIP}
              </p>
            </div>
            <input
              type="file"
              accept={ACCEPTED_FILE_TYPES}
              onChange={(e) => setMtdFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-dash-ink-secondary file:mr-4 file:rounded-md file:border-0 file:bg-dash-accent file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-dash-ink hover:file:bg-dash-accent-hover"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleAnalyze}
              disabled={!mtdFile || analyzeStatus === "loading"}
              className="rounded-md bg-dash-accent px-4 py-2 text-sm font-medium text-dash-ink hover:bg-dash-accent-hover disabled:opacity-50"
            >
              {analyzeStatus === "loading" ? "Analyzing…" : "Analyze CSV"}
            </button>
            <Link href="/help/download" className="text-sm text-dash-accent hover:underline">
              Not sure how to download? See our guide
            </Link>
          </div>

          {analyzeStatus === "detected" && (
            <div className="flex flex-wrap items-center gap-3 rounded-md border border-dash-border bg-dash-bg px-3 py-2.5">
              <span
                className={`rounded-full px-2.5 py-1 text-[13px] font-medium ${
                  detectedPlatform === "GOOGLE" ? "bg-amber-900/40 text-amber-300" : "bg-blue-900/40 text-blue-300"
                }`}
              >
                {detectedPlatform === "GOOGLE" ? "Google Ads detected" : "Meta Ads detected"}
              </span>
              <label className="flex items-center gap-2 text-[13px] text-dash-ink-secondary">
                Platform:
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value as "META" | "GOOGLE")}
                  className="rounded-md border border-dash-border bg-dash-card px-2 py-1 text-[13px] text-dash-ink outline-none focus:border-dash-accent"
                >
                  <option value="META">Meta Ads</option>
                  <option value="GOOGLE">Google Ads</option>
                </select>
              </label>
              <button
                onClick={handleContinueAfterDetect}
                disabled={continueStatus === "loading"}
                className="ml-auto rounded-md bg-dash-accent px-3 py-1.5 text-[13px] font-medium text-dash-ink hover:bg-dash-accent-hover disabled:opacity-50"
              >
                {continueStatus === "loading" ? "Loading…" : "Continue"}
              </button>
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
                  <p className="mb-2 text-sm font-medium text-red-300">
                    This CSV can&apos;t be used to generate a report yet:
                  </p>
                  <ul className="list-inside list-disc space-y-1 text-sm text-red-300">
                    {analyzeErrors.filter((e) => !isNoDataRowsError(e) && !isSpecificFieldError(e)).map((e, i) => (
                      <li key={i}>{e.message}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          {analyzeStatus === "error" && analyzeMessage && (
            <div className="rounded-lg border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
              {analyzeMessage}
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5 rounded-lg border border-dash-border bg-dash-card p-5">
          <div>
            <h3 className="text-sm font-medium text-dash-ink-secondary">Select metrics for your report</h3>
            <p className="mt-1 text-[13px] text-dash-ink-secondary">
              We found {availableMetrics.length} performance metric{availableMetrics.length === 1 ? "" : "s"}{" "}
              in your CSV. We&apos;ve pre-selected {selectedMetrics.length} most relevant to your campaigns —
              add or remove any of them below. A campaign with more than 8 selected metrics automatically spans
              multiple slides, so include everything relevant.
            </p>
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-[13px] font-semibold text-dash-ink">✅ Included in report</h4>
              <span className="text-[13px] text-dash-ink-secondary">{selectedMetrics.length} metrics selected</span>
            </div>
            <ul className="divide-y divide-dash-border rounded-lg border border-dash-border">
              {selectedMetrics.map((m) => (
                <li key={m.key} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="flex-1 text-sm text-dash-ink">{m.label}</span>
                  <button
                    type="button"
                    onClick={() => removeMetric(m.key)}
                    className="rounded-md border border-dash-border px-3 py-1 text-[13px] text-dash-ink-secondary hover:bg-dash-border"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {availableNotIncludedMetrics.length > 0 && (
            <div>
              <h4 className="mb-2 text-[13px] font-semibold text-dash-ink">➕ Available but not included</h4>
              <ul className="divide-y divide-dash-border rounded-lg border border-dash-border">
                {availableNotIncludedMetrics.map((m) => (
                  <li key={m.key} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="flex-1 text-sm text-dash-ink-secondary">{m.label}</span>
                    <button
                      type="button"
                      onClick={() => addMetric(m)}
                      className="rounded-md border border-dash-border px-3 py-1 text-[13px] text-dash-ink-secondary hover:bg-dash-border"
                    >
                      + Add
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {selectedMetrics.length > 0 && selectedMetrics.length < RECOMMENDED_MIN_METRICS && (
            <div className="rounded-md border border-amber-900 bg-amber-950/30 px-3 py-2 text-[13px] text-amber-200">
              Only {selectedMetrics.length} metric{selectedMetrics.length === 1 ? "" : "s"} selected — for the
              clearest report we recommend at least {RECOMMENDED_MIN_METRICS}, but you can continue with fewer.
            </div>
          )}
          {selectedMetrics.length === 0 && (
            <div className="rounded-md border border-amber-900 bg-amber-950/30 px-3 py-2 text-[13px] text-amber-200">
              Select at least one metric to continue.
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="rounded-md border border-dash-border px-4 py-2 text-sm font-medium text-dash-ink hover:bg-dash-border"
            >
              Back
            </button>
            <button
              onClick={handleMetricsContinue}
              disabled={selectedMetrics.length === 0 || continueStatus === "loading"}
              className="rounded-md bg-dash-accent px-4 py-2 text-sm font-medium text-dash-ink hover:bg-dash-accent-hover disabled:opacity-50"
            >
              {continueStatus === "loading" ? "Loading…" : "Continue"}
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4 rounded-lg border border-dash-border bg-dash-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-medium text-dash-ink-secondary">Select campaigns to include</h3>
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
                <label htmlFor={`campaign-${name}`} className="cursor-pointer text-sm text-dash-ink">
                  {name}
                </label>
              </li>
            ))}
          </ul>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(2)}
              className="rounded-md border border-dash-border px-4 py-2 text-sm font-medium text-dash-ink hover:bg-dash-border"
            >
              Back
            </button>
            <button
              onClick={handleCampaignsContinue}
              disabled={selectedCampaigns.size === 0}
              className="rounded-md bg-dash-accent px-4 py-2 text-sm font-medium text-dash-ink hover:bg-dash-accent-hover disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-5">
          <h3 className="text-sm font-medium text-dash-ink-secondary">Reporting period</h3>

          {/* Section 1 — Report Type */}
          <section className="rounded-lg border border-dash-border bg-dash-card p-5">
            <h4 className="text-[16px] font-semibold text-white">Report Type</h4>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                        className="rounded-md border border-dash-border bg-dash-bg px-2 py-1.5 text-sm text-dash-ink outline-none focus:border-dash-accent"
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
                        className="rounded-md border border-dash-border bg-dash-bg px-2 py-1.5 text-sm text-dash-ink outline-none focus:border-dash-accent"
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

          {/* Section 3 — Month to Date / Full Month Period */}
          <section className="rounded-lg border border-dash-border border-l-4 border-l-dash-accent bg-dash-card p-5">
            <h4 className="text-[16px] font-semibold text-white">
              {reportType === "MONTHLY" ? "Full Month Period" : "Month to Date Period"}
            </h4>
            <p className="mt-3 text-sm text-dash-ink">
              {mtdRange
                ? `${formatIsoRangeWithYear(mtdRange)} (auto-detected from your CSV)`
                : "Month to Date period unavailable"}
            </p>
            <p className="mt-1 text-[13px] text-dash-ink-secondary">
              This is automatically calculated from your uploaded CSV data.
            </p>
          </section>

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
                  <p className="mb-2 text-sm font-medium text-red-300">Can&apos;t build a preview yet:</p>
                  <ul className="list-inside list-disc space-y-1 text-sm text-red-300">
                    {previewErrors.filter((e) => !isNoDataRowsError(e) && !isSpecificFieldError(e)).map((e, i) => (
                      <li key={i}>{e.message}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          {previewStatus === "error" && previewMessage && (
            <div className="rounded-lg border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
              {previewMessage}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep(3)}
              className="rounded-md border border-dash-border px-4 py-2 text-sm font-medium text-dash-ink hover:bg-dash-border"
            >
              Back
            </button>
            <button
              onClick={handleDatesContinue}
              disabled={
                previewStatus === "loading" ||
                (reportType === "WEEKLY" &&
                  ((dateMode === "custom" && (!customStart || !customEnd)) || needsLongRangeConfirm))
              }
              className="rounded-md bg-dash-accent px-4 py-2 text-sm font-medium text-dash-ink hover:bg-dash-accent-hover disabled:opacity-50"
            >
              {previewStatus === "loading" ? "Loading preview…" : "Continue"}
            </button>
          </div>
        </div>
      )}

      {step === 5 && data && (
        <div className="space-y-6">
          <ReportPreview data={data} />

          <div className="rounded-lg border border-dash-border bg-dash-card p-4 text-sm text-dash-ink-secondary">
            Generating report for {selectedCampaigns.size} campaign{selectedCampaigns.size === 1 ? "" : "s"}
            {reportType === "WEEKLY" && weeklyRangeIso && <> — Week: {formatIsoRange(weeklyRangeIso)}</>}
            {mtdRange && <> — MTD: {formatIsoRange(mtdRange)}</>}
          </div>

          <div>
            <label className="mb-1 block text-sm text-dash-ink-secondary">Report title</label>
            <input
              value={reportTitle}
              onChange={(e) => {
                setReportTitle(e.target.value);
                setReportTitleTouched(true);
              }}
              placeholder={reportType === "MONTHLY" ? DEFAULT_MONTHLY_REPORT_TITLE : DEFAULT_REPORT_TITLE}
              maxLength={100}
              disabled={generateStatus === "loading" || generateStatus === "done"}
              className="w-full max-w-md rounded-md border border-dash-border bg-dash-card px-3 py-2 text-sm text-dash-ink outline-none focus:border-dash-accent disabled:opacity-60"
            />
            <p className="mt-1 text-[13px] text-dash-ink-secondary">
              Shown on the cover slide in place of &quot;
              {reportType === "MONTHLY" ? DEFAULT_MONTHLY_REPORT_TITLE : DEFAULT_REPORT_TITLE}&quot; — e.g. &quot;Monthly Campaign Summary&quot; or &quot;Q3 Performance Review&quot;.
            </p>
          </div>

          {/* Same screen throughout: only this action row changes as
              generateStatus moves idle -> loading -> done/error, so there's
              no navigation between "getting ready" and "here's your file". */}
          {generateStatus === "idle" && (
            <div className="flex gap-3">
              <button
                onClick={() => setStep(4)}
                className="rounded-md border border-dash-border px-4 py-2 text-sm font-medium text-dash-ink hover:bg-dash-border"
              >
                Back
              </button>
              <button
                onClick={handleGenerate}
                className="rounded-md bg-dash-accent px-4 py-2 text-sm font-medium text-dash-ink hover:bg-dash-accent-hover"
              >
                Generate & download PPTX
              </button>
            </div>
          )}

          {generateStatus === "loading" && (
            <div className="flex items-center gap-3 rounded-lg border border-dash-border bg-dash-card p-4 text-sm text-dash-ink-secondary">
              <Spinner />
              Generating your report…
            </div>
          )}

          {generateStatus === "error" && (
            <div className="space-y-3">
              <div className="rounded-lg border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
                {generateMessage}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(4)}
                  className="rounded-md border border-dash-border px-4 py-2 text-sm font-medium text-dash-ink hover:bg-dash-border"
                >
                  Back
                </button>
                <button
                  onClick={handleGenerate}
                  className="rounded-md bg-dash-accent px-4 py-2 text-sm font-medium text-dash-ink hover:bg-dash-accent-hover"
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
                onClick={handleBackToDates}
                className="text-[13px] text-dash-ink-secondary hover:text-dash-ink-secondary hover:underline"
              >
                ← Back to dates
              </button>

              <div className="flex flex-wrap items-start gap-3">
                <a
                  href={downloadUrl}
                  className="inline-block rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-dash-ink hover:bg-emerald-500"
                >
                  Download PPTX
                </a>

                {/* State 4 (not connected): nothing Drive-related renders at all. */}
                {hasGoogleDriveConnected && driveView === "collapsed" && (
                  <div>
                    <button
                      onClick={handleSaveButtonClick}
                      disabled={driveSaving}
                      className="inline-flex items-center gap-2 rounded-md bg-dash-accent px-4 py-2 text-sm font-medium text-dash-ink hover:bg-dash-accent-hover disabled:opacity-50"
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
                    <label className="block text-sm text-dash-ink-secondary">Folder link:</label>
                    <input
                      type="text"
                      value={driveFolderLinkInput}
                      onChange={(e) => {
                        setDriveFolderLinkInput(e.target.value);
                        setDriveLinkFormatError(null);
                      }}
                      placeholder="https://drive.google.com/drive/folders/1ABC123xyz"
                      className="mt-1 w-full rounded-md border border-dash-border bg-dash-bg px-3 py-2 text-sm text-dash-ink outline-none focus:border-dash-accent"
                    />
                    <p className="mt-1 text-[13px] text-dash-ink-secondary">
                      Open Google Drive → navigate to your folder → right-click → Get link → Copy link → paste it
                      here
                    </p>
                    {driveLinkFormatError && <p className="mt-1 text-[13px] text-red-400">{driveLinkFormatError}</p>}
                  </div>

                  <div>
                    <label className="block text-sm text-dash-ink-secondary">
                      Folder name <span className="text-dash-ink-secondary">— optional, but recommended</span>:
                    </label>
                    <input
                      type="text"
                      value={driveFolderNameInput}
                      onChange={(e) => setDriveFolderNameInput(e.target.value)}
                      placeholder="e.g. Reports or Alonzo Carr / Reports"
                      className="mt-1 w-full rounded-md border border-dash-border bg-dash-bg px-3 py-2 text-sm text-dash-ink outline-none focus:border-dash-accent"
                    />
                    <p className="mt-1 text-[13px] text-dash-ink-secondary">
                      Type a name to help you identify this folder — shown as &quot;Saving to: ...&quot; next time.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={handleSaveToFolderLink}
                      disabled={!driveFolderLinkInput.trim() || driveSaving}
                      className="rounded-md bg-dash-accent px-4 py-2 text-sm font-medium text-dash-ink hover:bg-dash-accent-hover disabled:opacity-50"
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

              {driveSaveError && <p className="text-sm text-red-400">{driveSaveError}</p>}

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
                    className="mb-3 block break-all text-sm text-dash-accent hover:underline"
                  >
                    {driveSaveUrl}
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
    <div className="space-y-3 rounded-lg border border-amber-900 bg-amber-950/30 p-4 text-sm text-amber-200">
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

/** Section 1's two large Report Type cards (Weekly vs Monthly) — plain buttons rather than native radios, since the visual design calls for full selectable cards, not a radio dot + label row. */
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

/** Section 2's three weekly-period pill options (Last 7 days / Previous 7 days / Custom range) — same button-based selection pattern as ReportTypeCard above, just smaller. */
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
      <span className="block text-sm font-medium text-white">{label}</span>
      {sublabel && <span className="mt-0.5 block text-[12px] text-dash-ink-secondary">{sublabel}</span>}
    </button>
  );
}

function ReportPreview({ data }: { data: ReportData }) {
  if (data.isPaused) {
    return (
      <div className="rounded-lg border border-amber-900 bg-amber-950/30 p-4 text-sm text-amber-200">
        {data.pausedMessage}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {data.objectiveWarnings.length > 0 && (
        <div className="space-y-2">
          {data.objectiveWarnings.map((w) => (
            <div
              key={w.campaignName}
              className="rounded-lg border border-amber-900 bg-amber-950/30 p-4 text-sm text-amber-200"
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

      <div className="rounded-lg border border-dash-border bg-dash-card p-4">
        <p className="text-[13px] uppercase tracking-wide text-dash-ink-secondary">Cover</p>
        <p className="mt-1 text-dash-ink">{data.cover.dateRange}</p>
        <p className="text-sm text-dash-ink-secondary">{data.cover.healthBadge}</p>
        {data.cover.budgetSummary && (
          <p className="mt-1 text-[13px] text-dash-ink-secondary">{data.cover.budgetSummary}</p>
        )}
      </div>

      <div>
        <p className="mb-2 text-[13px] uppercase tracking-wide text-dash-ink-secondary">
          Campaign summary slides ({data.campaignSlides.length})
        </p>
        <ul className="divide-y divide-dash-border rounded-lg border border-dash-border bg-dash-card">
          {data.campaignSlides.map((s) => (
            <li key={s.campaignName} className="flex items-center justify-between px-4 py-2 text-sm">
              <span className="text-dash-ink">{s.campaignName}</span>
              <span className="text-dash-ink-secondary">
                {s.metrics.spend} · {s.resultLabel} {s.metrics.results} · {s.metrics.cpr}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {data.adSetSlides.length > 0 && (
        <div>
          <p className="mb-2 text-[13px] uppercase tracking-wide text-dash-ink-secondary">
            Ad set slides ({data.adSetSlides.length})
          </p>
          <ul className="divide-y divide-dash-border rounded-lg border border-dash-border bg-dash-card">
            {data.adSetSlides.map((s) => (
              <li
                key={`${s.campaignName}/${s.adSetName}`}
                className="flex items-center justify-between px-4 py-2 text-sm"
              >
                <span className="text-dash-ink">
                  {s.campaignName} / {s.adSetName}
                </span>
                <span className="text-dash-ink-secondary">
                  {s.metrics.spend} · {s.resultLabel} {s.metrics.results}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* A Monthly report's Combined Total slide shows only the MTD row — no
          separate weekly/period comparison — so the preview mirrors that
          instead of showing an always-hidden Period card (see fill-tags.ts's
          buildTableSlideXml). */}
      <div className={data.reportType === "MONTHLY" ? "grid grid-cols-1 gap-4" : "grid grid-cols-2 gap-4"}>
        {data.reportType !== "MONTHLY" && (
          <div className="rounded-lg border border-dash-border bg-dash-card p-4">
            <p className="text-[13px] uppercase tracking-wide text-dash-ink-secondary">Period ({data.periodRow.monthLabel})</p>
            <p className="mt-1 text-sm text-dash-ink">{data.periodRow.spend}</p>
          </div>
        )}
        <div className="rounded-lg border border-dash-border bg-dash-card p-4">
          <p className="text-[13px] uppercase tracking-wide text-dash-ink-secondary">MTD ({data.mtdRow.monthLabel})</p>
          <p className="mt-1 text-sm text-dash-ink">{data.mtdRow.spend}</p>
        </div>
      </div>
    </div>
  );
}
