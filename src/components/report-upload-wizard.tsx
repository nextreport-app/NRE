"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import type { ReportData, ComparisonReportData } from "@/lib/nre/report-data";
import type { ValidationIssue } from "@/lib/nre/validate";
import { extractDriveFolderIdFromLink } from "@/lib/drive-link";
import { MIN_SECOND_SLIDE_METRICS, type AvailableMetric, type SelectedMetric } from "@/lib/nre/available-metrics";
import { OBJECTIVE_DROPDOWN_OPTIONS, type ObjectiveInfo } from "@/lib/nre/result-type-map";
import { normalizeCampaignName } from "@/lib/nre/objective";
import { adSetKey, type AdSetGroup } from "@/lib/nre/ad-sets";
import { useToast } from "@/components/toast";

// 3-screen wizard (originally 6 — Upload / Campaigns / Objectives / Metrics
// / Dates / Preview+Generate — merged down, see git history for the prior
// per-step layout if it's ever useful as a reference). Nothing was dropped
// in the merge, only reorganised:
//
// Step 1 — Upload (unchanged): platform selector, file upload, Analyze.
//
// Step 2 — Campaigns, Objectives & Metrics (Meta only): Section A is a
// single per-campaign row combining what used to be three separate steps —
// checkbox, campaign name, an inline ad-set expand arrow (Improvement 2,
// see ad-sets.ts), and the objective dropdown + confidence badge (the
// permanent objective-detection fix — objective.ts's
// resolveCampaignObjective, backed by result-type-map.ts). The dropdown/
// ad-set list/confidence badge for a campaign are only meaningful while
// that campaign is checked, so they're hidden (not cleared — the state
// underneath is untouched) the moment its checkbox is unchecked. Section B
// (Metric Cards) is the old Metrics step, now collapsed by default behind a
// one-line "N metrics selected: ..." summary — expanding it shows the exact
// same review-card UI as before. The old per-step /metrics fetch (used to
// fire on the Campaigns step's own "Continue" click) now fires once,
// automatically, right after Analyze succeeds — see
// fetchObjectivesAndMetrics/dispatchAfterAnalyze — using the same
// analyze-resolved default campaign selection that would otherwise have
// been sent; toggling a campaign checkbox afterwards doesn't re-fetch (each
// campaign's objective dropdown and the metric cards stay fully editable by
// hand either way, so nothing is lost).
//
// Step 3 — Report Period & Generate (Meta) / Preview & Generate (Google):
// merges the old Dates step and Preview+Generate step onto one screen. The
// preview (and the objective-confirmed campaign list it needs) can no
// longer wait for an explicit "Continue" click between the two, so it's now
// refetched automatically by a useEffect keyed on `step`/reportType/date
// fields — see fetchPreview — every time the user changes something in the
// Reporting Period section while on this step. Since applyPreviewResult
// already calls resetGenerateState() on every successful fetch, changing
// dates after a report has already been generated naturally clears the old
// download links and shows the Generate button again, with no separate
// "back to dates" navigation needed — the date controls are already right
// there on the same screen. Google Ads' simpler pipeline (no weekly/
// monthly/comparison choice, no campaign selection — see
// google-report-data.ts's own file header) skips the Reporting Period
// section and the refetch effect entirely, landing here with whatever
// /preview response dispatchAfterAnalyze already fetched directly.
type Step = 1 | 2 | 3;
const STEP_LABELS: Record<Step, string> = {
  1: "Upload",
  2: "Campaigns & Objectives",
  3: "Period & Generate",
};

// Fix 2 — context-specific wizard heading per step, replacing the generic
// "Generate Report" heading that used to be static on every screen.
const STEP_HEADINGS: Record<Step, string> = {
  1: "Upload Your CSV",
  2: "Campaigns, Objectives & Metrics",
  3: "Report Period & Generate",
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

/** "August 2026" — used by the Report Summary card's Monthly "Full Month" line (Fix 1). */
function formatIsoMonthYear(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(d);
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

/** The public read-only share page's URL (see app/r/[token]/page.tsx) — a plain domain/path, no protocol, matching how it's shown/copied everywhere in the product spec. */
function buildShareReportUrl(shareToken: string): string {
  return `nextreport.in/r/${shareToken}`;
}

export function ReportUploadWizard({
  clientId,
  clientName,
  hasGoogleDriveConnected,
  initialLastDriveFolderId,
  initialLastDriveFolderName,
  hasPreviousMonthData,
  clientTemplate,
}: {
  clientId: string;
  /** Client.accountName — used for the "Generate Another Report for [Client Name]" button (B3) and the friendly Drive link label. */
  clientName: string;
  /** Whether the account has a Google Drive account connected — gates showing the "Save to Google Drive" button on the download screen at all. */
  hasGoogleDriveConnected: boolean;
  /** Client.lastDriveFolderId/lastDriveFolderName — the folder this client's reports were last saved to, if any. Pre-navigates the folder picker into it as a convenience. */
  initialLastDriveFolderId: string | null;
  initialLastDriveFolderName: string | null;
  /** Whether Client.previousMonthDataUrl is set — drives Fix 1's "Missing previous month comparison" notice on the download screen for a WEEKLY/MONTHLY report. */
  hasPreviousMonthData: boolean;
  /** Client.template (Prisma ReportTemplate enum) — shown as a read-only "Template: Dark/Light" line on the Preview & Generate step's summary card. Only DARK/LIGHT are user-selectable (see the client form), so anything else falls back to "Dark". */
  clientTemplate: string;
}) {
  const [step, setStepState] = useState<Step>(1);
  // Which steps this session has actually passed through — the Google Ads
  // flow jumps straight from step 1 to step 6 (see dispatchAfterAnalyze),
  // so a plain "s < step" numeric check would wrongly offer steps 2-5 as
  // clickable/completed in the step indicator even though they were never
  // shown. Only grows (a step, once visited, stays "completed" even after
  // navigating back to it and forward again).
  const [visitedSteps, setVisitedSteps] = useState<Set<Step>>(new Set([1]));
  /** Every step transition in the wizard goes through this — records the step as visited alongside switching to it. */
  function setStep(s: Step) {
    setStepState(s);
    setVisitedSteps((prev) => (prev.has(s) ? prev : new Set(prev).add(s)));
  }
  const { showToast } = useToast();
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

  // Improvement 2 — ad-set selection, collapsible under each campaign row
  // (populated by /analyze's adSetGroups, only ad sets with real spend —
  // see ad-sets.ts's extractSpendingAdSetGroups). Every ad set starts
  // pre-checked; there's no saved memory for this like campaigns have (see
  // ad-sets.ts's file header). expandedCampaigns tracks which campaigns'
  // ad-set lists are currently shown — collapsed by default, per campaign.
  const [adSetGroups, setAdSetGroups] = useState<AdSetGroup[]>([]);
  const [selectedAdSets, setSelectedAdSets] = useState<Set<string>>(new Set());
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());

  // Step 3 — Objective Confirmation (the permanent objective-detection fix,
  // Meta only — populated by the same /metrics call as Step 4 below, right
  // after Campaign Selection). Keyed by objective.ts's normalizeCampaignName
  // so lookups always agree with what buildReportData itself uses. A
  // campaign present here means the user has SEEN (and possibly corrected)
  // the engine's detection; only entries the user actually touches need to
  // be sent back to the server as an override (see
  // currentCampaignObjectivesPayload) — leaving everything untouched keeps
  // the engine's own true per-campaign detection, not a copy of whatever
  // happened to be pre-filled.
  const [campaignObjectives, setCampaignObjectives] = useState<Map<string, ObjectiveInfo>>(new Map());
  const [touchedObjectiveCampaigns, setTouchedObjectiveCampaigns] = useState<Set<string>>(new Set());
  // Objective Confirmation memory cache (Part 6) — per-campaign confidence
  // tag from the /metrics response, keyed the same way campaignObjectives
  // is (normalizeCampaignName). Drives the badge under each dropdown:
  // "cached" -> green "Previously confirmed" (this exact client has
  // confirmed this campaign before, on some earlier report), "resultType"
  // -> blue "Detected from result type" (the engine found real result_type
  // text), "columnData" -> grey "Please verify" (the engine had to fall
  // back to column presence/data values/ad-set name). Cleared the moment a
  // campaign is touched (see setCampaignObjective) — once the user has
  // picked a value themselves, a badge describing where the PRE-fill came
  // from is no longer meaningful.
  const [campaignObjectiveConfidence, setCampaignObjectiveConfidence] = useState<
    Map<string, "cached" | "resultType" | "columnData">
  >(new Map());

  // Step 4 — Metrics (Part 3, Meta only — populated by /metrics, called
  // right after Campaign Selection so the engine's default 8 reflects the
  // objective of the campaigns actually being reported on). `selectedMetrics`
  // is the wizard's own ordered pick list (up to MAX_TOTAL_METRICS); empty
  // means "use the engine's automatic assignment" (never sent to the
  // generate/preview APIs in that case — see currentSelectedMetricsPayload).
  const [availableMetrics, setAvailableMetrics] = useState<AvailableMetric[]>([]);
  const [selectedMetrics, setSelectedMetrics] = useState<SelectedMetric[]>([]);
  const [metricsStatus, setMetricsStatus] = useState<"idle" | "loading" | "error">("idle");
  const [metricsTouched, setMetricsTouched] = useState(false);
  const [metricsLimitMessage, setMetricsLimitMessage] = useState<string | null>(null);
  // Section B (Metric Cards) on the merged Step 2 — collapsed by default,
  // showing just a one-line summary; expanding it reveals the same review-
  // card UI the old standalone Metrics step had.
  const [metricsSectionExpanded, setMetricsSectionExpanded] = useState(false);

  // Step 5 — Dates (populated by /analyze)
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
  // fetchPreview/handleGenerate, which branch on this value.
  const [reportType, setReportType] = useState<ReportTypeValue>("WEEKLY");

  // Step 5 — Comparison Report's Period A/B pickers (A1). Seeded from
  // weeklyOptions (This week vs Last week, the default preset) as soon as
  // /analyze returns — see applyAnalyzeResult — so switching to the
  // Comparison tab always starts with something sensible pre-filled even
  // before the user touches a preset.
  const [comparisonPreset, setComparisonPreset] = useState<ComparisonPreset>("thisWeek");
  const [comparisonPeriodA, setComparisonPeriodA] = useState<DateRangeIso | null>(null);
  const [comparisonPeriodB, setComparisonPeriodB] = useState<DateRangeIso | null>(null);
  const [monthComparisonOptions, setMonthComparisonOptions] = useState<{ periodA: DateRangeIso; periodB: DateRangeIso } | null>(null);

  // Step 6 — Preview. Comparison reports populate comparisonData instead of
  // data — previewKind (set alongside both in applyPreviewResult) is what
  // the step === 6 JSX actually branches on.
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>("idle");
  const [previewErrors, setPreviewErrors] = useState<ValidationIssue[]>([]);
  const [previewMessage, setPreviewMessage] = useState<string | null>(null);
  const [previewKind, setPreviewKind] = useState<PreviewKind>("normal");
  const [data, setData] = useState<ReportData | null>(null);
  const [comparisonData, setComparisonData] = useState<ComparisonReportData | null>(null);
  const [reportTitle, setReportTitle] = useState(DEFAULT_REPORT_TITLE);
  // False until the user actually types in the Report Title field — while
  // false, switching Report Type keeps swapping the title's own default
  // text to match; once true, their custom title is left alone regardless
  // of which Report Type is picked.
  const [reportTitleTouched, setReportTitleTouched] = useState(false);
  // Custom title input starts collapsed behind an "Add custom title +"
  // link on the merged Step 3 — expanding it once (or having already typed
  // a title) keeps it expanded for the rest of the session.
  const [customTitleExpanded, setCustomTitleExpanded] = useState(false);

  // Step 6 — Generate (same screen as Preview above, see the step === 6 JSX block)
  const [generateStatus, setGenerateStatus] = useState<GenerateStatus>("idle");
  const [generateMessage, setGenerateMessage] = useState<string | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [shareToken, setShareToken] = useState<string | null>(null);
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

  // Email modal — sends the public share link via Resend (api/reports/[id]/
  // send-email/route.ts), replacing the old mailto: Email button. Errors
  // surface as a toast (per spec) rather than inline, so emailModalError
  // only tracks the in-flight/loading state's button label, not a message.
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [emailSending, setEmailSending] = useState(false);

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

  /** Resets everything the Preview/Generate/Download screen (step 6) owns — shared by every place a fresh preview or a full wizard reset needs to guarantee no stale generate/Drive state survives. */
  function resetGenerateState() {
    setGenerateStatus("idle");
    setGenerateMessage(null);
    setReportId(null);
    setDownloadUrl(null);
    setShareToken(null);
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
    const groups: AdSetGroup[] = json.adSetGroups || [];
    setAdSetGroups(groups);
    setSelectedAdSets(new Set(groups.flatMap((g) => g.adSetNames.map((name) => adSetKey(g.campaignName, name)))));
    setExpandedCampaigns(new Set());
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
    setPreviewStatus("idle");
    resetGenerateState();
  }

  /** Meta keeps its existing campaigns/objectives/dates flow, now spread across just 2 more screens instead of 4. Google Ads skips straight to the preview — no campaign selection, no report-type toggle, no Previous Month Data (see google-report-data.ts's own file header for why this pipeline is deliberately simpler for v1). */
  async function dispatchAfterAnalyze(platformValue: "META" | "GOOGLE") {
    if (platformValue === "META") {
      // Section A's objective dropdowns + Section B's metric cards both need
      // the /metrics response before Step 2 can render anything meaningful —
      // fetch it now (using the analyze-resolved default campaign
      // selection), same call the old standalone Campaigns step's "Continue"
      // button used to make, just moved one click earlier since Campaigns
      // and Objectives are now the same screen.
      await fetchObjectivesAndMetrics();
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
    setStep(3);
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

  /**
   * The Objective Confirmation dropdown's fixed option list is the common
   * 16 objectives (see result-type-map.ts's OBJECTIVE_DROPDOWN_OPTIONS) —
   * but the engine's own detection can legitimately return something rarer
   * that isn't one of them (e.g. "AD RECALL LIFT"). Rather than silently
   * mis-mapping that to the nearest dropdown entry (misrepresenting what
   * the engine actually found), this synthesizes a matching option carrying
   * the real detected label/cost text so the dropdown always shows ground
   * truth as its pre-selected value, even outside the common list.
   */
  function objectiveInfoForResultLabel(resultLabel: string, costLabel: string): ObjectiveInfo {
    const match = OBJECTIVE_DROPDOWN_OPTIONS.find((o) => o.resultLabel === resultLabel);
    if (match) return match;
    return { key: resultLabel.toLowerCase().replace(/[^a-z0-9]+/g, "_"), resultLabel, costLabel, isReach: false };
  }

  /** Converts the /metrics route's `campaignObjectives` JSON (plain object, `{resultLabel, costLabel, source}` per normalized campaign name — source is "cached" | "resultType" | "columnData", see objective.ts's ObjectiveConfidence) into the wizard's own Map<string, ObjectiveInfo> + confidence state shapes. */
  function campaignObjectivesFromJson(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    json: Record<string, any> | undefined | null,
  ): { objectives: Map<string, ObjectiveInfo>; confidence: Map<string, "cached" | "resultType" | "columnData"> } {
    const objectives = new Map<string, ObjectiveInfo>();
    const confidence = new Map<string, "cached" | "resultType" | "columnData">();
    if (!json) return { objectives, confidence };
    for (const [name, info] of Object.entries(json)) {
      if (!info?.resultLabel || !info?.costLabel) continue;
      objectives.set(name, objectiveInfoForResultLabel(info.resultLabel, info.costLabel));
      if (info.source === "cached" || info.source === "resultType" || info.source === "columnData") {
        confidence.set(name, info.source);
      }
    }
    return { objectives, confidence };
  }

  // ── Step 1 -> 2: populate Section A's objective dropdowns + Section B's
  // metric cards, using the analyze-resolved default campaign selection —
  // see dispatchAfterAnalyze. Purely a data fetch: no navigation, no
  // saveSelection (that now happens on Step 2's own Continue button, once
  // the user is done with campaigns/ad sets/objectives/metrics together).
  async function fetchObjectivesAndMetrics() {
    if (!mtdFile) return;
    setMetricsStatus("loading");
    setMetricsTouched(false);
    setMetricsLimitMessage(null);
    setTouchedObjectiveCampaigns(new Set());

    const res = await fetch(`/api/clients/${clientId}/reports/metrics`, {
      method: "POST",
      body: buildUploadFormData(mtdFile, { platform, selectedCampaigns: Array.from(selectedCampaigns) }),
    });
    const json = await res.json().catch(() => null);

    if (!res.ok || !json || json.error) {
      // Objectives/Metrics are a nice-to-have preview, not a hard
      // requirement — a failure here shouldn't strand the wizard. Fall
      // through with an empty selection (the engine's automatic
      // assignment) and an empty objective map (Section A falls back to
      // RESULTS for every campaign in that case) and let the user continue
      // past Step 2 regardless.
      setMetricsStatus("error");
      setAvailableMetrics([]);
      setSelectedMetrics([]);
      setCampaignObjectives(new Map());
      setCampaignObjectiveConfidence(new Map());
      return;
    }

    setAvailableMetrics(json.availableMetrics || []);
    setSelectedMetrics(json.defaultSelection || []);
    const { objectives, confidence } = campaignObjectivesFromJson(json.campaignObjectives);
    setCampaignObjectives(objectives);
    setCampaignObjectiveConfidence(confidence);
    setMetricsStatus("idle");
  }

  // ── Step 2 -> 3: Campaigns/Objectives/Metrics -> Report Period & Generate ──
  async function handleCampaignsObjectivesContinue() {
    await saveSelection({ campaigns, selectedCampaigns: Array.from(selectedCampaigns) });
    setStep(3);
  }

  // ── Improvement 2: ad-set selection (nested under each campaign row) ────
  function toggleCampaignExpanded(campaignName: string) {
    setExpandedCampaigns((prev) => {
      const next = new Set(prev);
      if (next.has(campaignName)) next.delete(campaignName);
      else next.add(campaignName);
      return next;
    });
  }

  function toggleAdSet(campaignName: string, adSetName: string) {
    const key = adSetKey(campaignName, adSetName);
    setSelectedAdSets((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectAllAdSetsForCampaign(campaignName: string, adSetNames: string[]) {
    setSelectedAdSets((prev) => {
      const next = new Set(prev);
      for (const name of adSetNames) next.add(adSetKey(campaignName, name));
      return next;
    });
  }

  function deselectAllAdSetsForCampaign(campaignName: string, adSetNames: string[]) {
    setSelectedAdSets((prev) => {
      const next = new Set(prev);
      for (const name of adSetNames) next.delete(adSetKey(campaignName, name));
      return next;
    });
  }

  // ── Step 3: Objective Confirmation (the permanent objective-detection fix) ──
  /** Dropdown onChange — records the user's choice AND marks the campaign as touched, so only campaigns the user actually reviewed/changed are sent back as an override (see currentCampaignObjectivesPayload) — an untouched campaign keeps the engine's own true detection rather than a copy of whatever was pre-filled. Keyed by normalizeCampaignName, matching the server's own campaignObjectiveMap keys exactly. Also clears any confidence badge for this campaign — once the user has picked a value themselves, a badge describing where the PRE-fill came from is no longer meaningful. */
  function setCampaignObjective(campaignName: string, objectiveKey: string) {
    const option = OBJECTIVE_DROPDOWN_OPTIONS.find((o) => o.key === objectiveKey);
    if (!option) return;
    const normalized = normalizeCampaignName(campaignName);
    setCampaignObjectives((prev) => new Map(prev).set(normalized, option));
    setTouchedObjectiveCampaigns((prev) => new Set(prev).add(normalized));
    setCampaignObjectiveConfidence((prev) => {
      if (!prev.has(normalized)) return prev;
      const next = new Map(prev);
      next.delete(normalized);
      return next;
    });
  }

  /**
   * Sent to the preview/generate APIs as the objective override actually
   * used to BUILD this report — campaigns the user manually touched, PLUS
   * campaigns pre-filled from the Objective Confirmation memory cache
   * (confidence "cached"). The cache badge tells the user "Previously
   * confirmed", so the report itself must actually use that value rather
   * than silently letting the engine re-detect fresh (which could disagree
   * with what's displayed if this month's data pattern is more ambiguous
   * than the report that originally confirmed it). A campaign that's merely
   * engine-detected (confidence "resultType"/"columnData") and never
   * touched keeps the engine's own true per-campaign detection, exactly as
   * before this cache existed.
   */
  function currentCampaignObjectivesPayload(): Record<string, { resultLabel: string; costLabel: string }> | undefined {
    const relevant = new Set(touchedObjectiveCampaigns);
    for (const [name, tier] of campaignObjectiveConfidence) {
      if (tier === "cached") relevant.add(name);
    }
    if (relevant.size === 0) return undefined;
    const out: Record<string, { resultLabel: string; costLabel: string }> = {};
    for (const name of relevant) {
      const info = campaignObjectives.get(name);
      if (info) out[name] = { resultLabel: info.resultLabel, costLabel: info.costLabel };
    }
    return Object.keys(out).length > 0 ? out : undefined;
  }

  /**
   * Part 3 — the full set of every campaign shown on the Objective
   * Confirmation step (cached pre-fills, engine detections the user never
   * touched, AND anything the user manually edited) — clicking Continue
   * past that step is an implicit confirmation of whatever it currently
   * shows, so ALL of it (not just the touched subset above) is what gets
   * written back to the client's objective memory cache once the report
   * actually generates (see handleGenerate). Only sent on the final
   * generate request, never preview — the cache should only grow from a
   * report the user actually committed to.
   */
  function confirmedCampaignObjectivesPayload(): Record<string, { key: string; resultLabel: string; costLabel: string }> | undefined {
    if (campaignObjectives.size === 0) return undefined;
    const out: Record<string, { key: string; resultLabel: string; costLabel: string }> = {};
    for (const [name, info] of campaignObjectives) {
      out[name] = { key: info.key, resultLabel: info.resultLabel, costLabel: info.costLabel };
    }
    return out;
  }

  /**
   * Part 6 — the three confidence tiers the Objective Confirmation step
   * shows below each campaign's dropdown. "cached" (green check) is the
   * highest confidence: this exact client has confirmed this exact campaign
   * before. "resultType" (blue dot) is the engine finding real result_type
   * text (objective.ts's resolveCampaignObjectiveWithConfidence "high"
   * tier). "columnData" (grey dot) is everything else the engine had to
   * fall back to — column presence, data values, or ad-set name — genuinely
   * lower confidence, worth a second look. Returns null for a campaign with
   * no confidence tag at all (the user has already touched its dropdown —
   * see setCampaignObjective — so nothing needs to be shown).
   */
  function objectiveConfidenceBadge(tier: "cached" | "resultType" | "columnData" | undefined) {
    if (tier === "cached") {
      return { icon: "✓", text: "Previously confirmed", className: "text-[#68d391]" };
    }
    if (tier === "resultType") {
      return { icon: "●", text: "Detected from result type", className: "text-[#63b3ed]" };
    }
    if (tier === "columnData") {
      return { icon: "●", text: "Please verify", className: "text-dash-ink-secondary" };
    }
    return null;
  }

  // ── Step 4: Metrics (Part 3) ────────────────────────────────────────────
  /**
   * "Add another metric" pool, minus whatever's already showing as a card.
   * Filters on both key AND label: the dictionary can map two different CSV
   * columns to the same display label under different keys (e.g. a
   * "Website Leads" objective's default slot 4 resolves to the generic
   * `results` key relabeled "WEBSITE LEADS", while the CSV's own "Website
   * Leads" column separately maps to dictionary key `website_leads` with
   * that same label) — a key-only filter misses that case and "WEBSITE
   * LEADS" would show up as both a card and an add-option (Fix 2).
   */
  function unselectedAvailableMetrics(): AvailableMetric[] {
    const selectedKeys = new Set(selectedMetrics.map((m) => m.key));
    const selectedLabels = new Set(selectedMetrics.map((m) => m.label));
    return availableMetrics.filter((m) => !selectedKeys.has(m.key) && !selectedLabels.has(m.label));
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

  /**
   * The "Adding a second slide" warning shown once a 9th metric is added.
   * Only relevant while slide 2 is genuinely thin (1-3 metrics) — once it
   * reaches MIN_SECOND_SLIDE_METRICS the second slide is already
   * professional-looking, so there's nothing left to warn about and the
   * whole box goes away (also true, trivially, once the user removes back
   * down to 8 or fewer and slide2Count returns to 0).
   */
  function slide2Warning(): { scenario: "A" | "B"; slide2Count: number; remaining: number; needed: number } | null {
    const slide2Count = Math.max(0, selectedMetrics.length - MAX_METRICS_PER_SLIDE);
    if (slide2Count === 0 || slide2Count >= MIN_SECOND_SLIDE_METRICS) return null;
    const remaining = unselectedAvailableMetrics().length;
    return {
      scenario: remaining >= 3 ? "A" : "B",
      slide2Count,
      remaining,
      needed: MIN_SECOND_SLIDE_METRICS - slide2Count,
    };
  }

  /** Fix 1, Scenario C — the single remaining candidate is disabled if adding it can't possibly get slide 2 to a professional length (nothing else left in the CSV to add after it). */
  function wouldLeaveSlide2TooShort(candidate: AvailableMetric): boolean {
    const remaining = unselectedAvailableMetrics();
    if (remaining.length !== 1 || remaining[0].key !== candidate.key) return false;
    const slide2CountAfter = Math.max(0, selectedMetrics.length + 1 - MAX_METRICS_PER_SLIDE);
    return slide2CountAfter < MIN_SECOND_SLIDE_METRICS;
  }

  /** Only sent to the preview/generate APIs once the user actually changes something on the Metric Review step — leaving it untouched (the common case: "Most users will just click Continue") keeps the engine's own true per-campaign automatic assignment, rather than pinning every campaign to the single majority-objective default shown in the wizard. */
  function currentSelectedMetricsPayload(): SelectedMetric[] | undefined {
    return metricsTouched && selectedMetrics.length > 0 ? selectedMetrics : undefined;
  }

  // ── Step 5: Dates ───────────────────────────────────────────────────────
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

  /**
   * Step 3's Reporting Period section and its Generate section share one
   * screen now, so there's no separate "Continue" click left to hang this
   * fetch off of — see the useEffect right below, which calls this
   * automatically whenever the user changes something here while on Step 3
   * (and once, right on arrival). Self-guarding: bails out silently while
   * a WEEKLY custom range is incomplete/needs the >7-day confirmation, or
   * shows the inline error for an incomplete Comparison period, exactly the
   * same validation the old standalone Dates step's "Continue" button used
   * to gate on.
   */
  async function fetchPreview() {
    if (!mtdFile) return;
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

    setPreviewStatus("loading");
    setPreviewErrors([]);
    setPreviewMessage(null);

    const res = await fetch(`/api/clients/${clientId}/reports/preview`, {
      method: "POST",
      body: buildUploadFormData(mtdFile, {
        selectedCampaigns: Array.from(selectedCampaigns),
        selectedAdSets: Array.from(selectedAdSets),
        selectedMetrics: currentSelectedMetricsPayload(),
        campaignObjectives: currentCampaignObjectivesPayload(),
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
  }

  // Google Ads has no Reporting Period section on Step 3 at all (see this
  // file's header) — dispatchAfterAnalyze already fetched its one-shot
  // preview directly, so this effect only ever runs for Meta. Re-fires
  // fetchPreview on every arrival at Step 3 and on every subsequent change
  // to the Reporting Period inputs while already there; applyPreviewResult
  // calls resetGenerateState() on each success, so editing dates after a
  // report was already generated naturally clears the stale download links
  // and brings the Generate button back — no separate "back to dates"
  // navigation needed.
  useEffect(() => {
    if (step !== 3 || platform !== "META") return;
    // fetchPreview's first line sets state (previewStatus "loading") — a
    // microtask hop keeps that out of this effect's own synchronous call
    // stack, matching react-hooks/set-state-in-effect's expectations
    // without changing when the fetch actually starts.
    void Promise.resolve().then(() => fetchPreview());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    step,
    platform,
    reportType,
    dateMode,
    customStart,
    customEnd,
    longRangeConfirmed,
    comparisonPreset,
    comparisonPeriodA?.startIso,
    comparisonPeriodA?.endIso,
    comparisonPeriodB?.startIso,
    comparisonPeriodB?.endIso,
  ]);

  // ── Step 6: Preview + Generate (one screen) ─────────────────────────────
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
    setShareToken(null);

    const res = await fetch(`/api/clients/${clientId}/reports`, {
      method: "POST",
      body: buildUploadFormData(mtdFile, {
        selectedCampaigns: Array.from(selectedCampaigns),
        selectedAdSets: Array.from(selectedAdSets),
        selectedMetrics: currentSelectedMetricsPayload(),
        campaignObjectives: currentCampaignObjectivesPayload(),
        // Part 3 — every campaign the Objective Confirmation step showed,
        // saved back to this client's objective memory cache once the
        // report actually generates. Only sent here, never on preview.
        confirmedCampaignObjectives: confirmedCampaignObjectivesPayload(),
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
    // Comparison reports don't get a share page (see share-report.ts's
    // header) — json.shareToken is simply absent for that reportType, so
    // this naturally stays null and the Share Report button never renders.
    setShareToken(json.shareToken ?? null);
    setGenerateStatus("done");
  }

  async function handleCopyShareLink() {
    if (!shareToken) return;
    await navigator.clipboard.writeText(buildShareReportUrl(shareToken));
    showToast("Share link copied!");
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

  function openEmailModal() {
    setEmailTo("");
    setEmailMessage("");
    setEmailModalOpen(true);
  }

  async function handleSendEmail() {
    if (!reportId || !emailTo.trim()) return;
    setEmailSending(true);
    try {
      const res = await fetch(`/api/reports/${reportId}/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: emailTo.trim(), message: emailMessage.trim() || undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        showToast(json?.error || "Could not send the email. Please try again.", "error");
        return;
      }
      showToast(`Report sent to ${emailTo.trim()}`, "success");
      setEmailModalOpen(false);
    } catch {
      showToast("Could not reach the server. Please try again.", "error");
    } finally {
      setEmailSending(false);
    }
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
    setAdSetGroups([]);
    setSelectedAdSets(new Set());
    setExpandedCampaigns(new Set());

    setCampaignObjectives(new Map());
    setTouchedObjectiveCampaigns(new Set());

    setAvailableMetrics([]);
    setSelectedMetrics([]);
    setMetricsStatus("idle");
    setMetricsTouched(false);
    setMetricsLimitMessage(null);
    setMetricsSectionExpanded(false);

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
    setReportTitle(DEFAULT_REPORT_TITLE);
    setReportTitleTouched(false);
    setCustomTitleExpanded(false);

    resetGenerateState();
    setStep(1);
  }

  const spanDays = customSpanDays();
  const needsLongRangeConfirm =
    dateMode === "custom" && spanDays !== null && spanDays > 7 && !customRangeError && !longRangeConfirmed;
  const weeklyRangeIso = currentWeeklyRangeIso();

  /**
   * B2 Section 1's report summary card content (Fix 1) — no longer a single
   * "N campaigns · Week: ... · MTD: ..." string: the campaign count is
   * dropped entirely, and each remaining piece becomes its own labelled
   * "Label: value" line, varying by report type.
   */
  function reportSummaryLines(): { label: string; value: string }[] {
    if (previewKind === "comparison" && comparisonData) {
      return [
        { label: "Period A", value: comparisonData.periodALabel },
        { label: "Period B", value: comparisonData.periodBLabel },
      ];
    }
    if (data) {
      if (reportType === "MONTHLY") {
        return mtdRange ? [{ label: "Full Month", value: formatIsoMonthYear(mtdRange.startIso) }] : [];
      }
      const lines: { label: string; value: string }[] = [];
      if (reportType === "WEEKLY" && weeklyRangeIso) lines.push({ label: "Week", value: formatIsoRange(weeklyRangeIso) });
      if (mtdRange) lines.push({ label: "Month till date (MTD)", value: formatIsoRange(mtdRange) });
      return lines;
    }
    return [];
  }

  function reportTypeLabel(): string {
    if (previewKind === "comparison") return "Comparison Report";
    return reportType === "MONTHLY" ? "Monthly Report" : "Weekly Report";
  }

  /** "Ready to generate" summary card's Report Type line — distinct wording from reportTypeLabel() above (which drives the Drive save label elsewhere), matching this card's own spec literally. */
  function reportTypeSummaryLabel(): string {
    if (previewKind === "comparison") return "Comparison Report";
    return reportType === "MONTHLY" ? "Monthly Performance Report" : "Weekly Performance Report";
  }

  /** "Ready to generate" summary card's Campaigns line — the actual campaigns that will appear in the generated report, not the wizard's own selectedCampaigns Set (which is empty for the Google Ads flow, since it has no campaign-selection step). */
  function summaryCampaignNames(): string[] {
    if (previewKind === "comparison" && comparisonData) return comparisonData.campaigns.map((c) => c.campaignName);
    if (data) return data.campaignSlides.map((s) => s.campaignName);
    return [];
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
      <div>
        <h1 className="mb-1 text-[24px] font-bold text-dash-ink">{STEP_HEADINGS[step]}</h1>
        <p className="text-[15px] text-dash-ink-secondary">{clientName}</p>
      </div>
      <StepIndicator step={step} visitedSteps={visitedSteps} onNavigate={setStep} />

      {step === 1 && (
        <div className="space-y-4 rounded-lg border border-dash-border bg-dash-card p-5">
          <h3 className="text-[16px] font-semibold text-white">Select platform</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ReportTypeCard
              icon={<MetaAdsIcon />}
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
              icon={<GoogleAdsIcon />}
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
        <div className="space-y-5">
          {/* Section A — campaigns, ad sets (Improvement 2), and objectives, one row per campaign. */}
          <div className="space-y-4 rounded-lg border border-dash-border bg-dash-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-[16px] font-semibold text-white">Campaigns &amp; objectives</h3>
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
              {campaigns.map((name) => {
                const isSelected = selectedCampaigns.has(name);
                const normalized = normalizeCampaignName(name);
                const current = campaignObjectives.get(normalized);
                // The dropdown always has a real, selectable value — a
                // campaign the engine (or a fetch failure) never resolved
                // falls back to the generic RESULTS option rather than
                // showing nothing selected.
                const currentKey = current?.key ?? "results";
                const options = OBJECTIVE_DROPDOWN_OPTIONS.some((o) => o.key === currentKey)
                  ? OBJECTIVE_DROPDOWN_OPTIONS
                  : [current!, ...OBJECTIVE_DROPDOWN_OPTIONS];
                const badge = objectiveConfidenceBadge(campaignObjectiveConfidence.get(normalized));
                const group = adSetGroups.find((g) => g.campaignName === name);
                const isExpanded = expandedCampaigns.has(name);
                const allAdSetsDeselected =
                  !!group && group.adSetNames.length > 0 && group.adSetNames.every((n) => !selectedAdSets.has(adSetKey(name, n)));
                return (
                  <li key={name} className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id={`campaign-${name}`}
                        checked={isSelected}
                        onChange={() => toggleCampaign(name)}
                        className="h-4 w-4 flex-shrink-0 accent-accent"
                      />
                      <label htmlFor={`campaign-${name}`} className="min-w-0 flex-1 cursor-pointer truncate text-[13px] text-dash-ink" title={name}>
                        {name}
                      </label>
                      <select
                        value={currentKey}
                        disabled={!isSelected}
                        onChange={(e) => setCampaignObjective(name, e.target.value)}
                        className="rounded-md border border-dash-border bg-dash-bg px-3 py-1.5 text-[13px] text-dash-ink outline-none focus:border-[#f6ad55] disabled:opacity-40"
                      >
                        {options.map((o) => (
                          <option key={o.key} value={o.key}>
                            {o.resultLabel}
                          </option>
                        ))}
                      </select>
                      {group && (
                        <button
                          type="button"
                          onClick={() => toggleCampaignExpanded(name)}
                          disabled={!isSelected}
                          aria-expanded={isExpanded}
                          aria-label={isExpanded ? `Hide ad sets for ${name}` : `Show ad sets for ${name}`}
                          className="flex-shrink-0 rounded-md px-1.5 py-1 text-[12px] text-dash-ink-secondary hover:text-dash-ink disabled:opacity-30"
                        >
                          {isExpanded ? "▲" : "▼"}
                        </button>
                      )}
                    </div>

                    {isSelected && badge && (
                      <div className={`mt-1 flex items-center justify-end gap-1 text-[11px] font-medium ${badge.className}`}>
                        <span aria-hidden="true">{badge.icon}</span>
                        <span>{badge.text}</span>
                      </div>
                    )}

                    {isSelected && group && isExpanded && (
                      <div className="mt-3 space-y-2 rounded-md border border-dash-border bg-dash-bg p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-[12px] text-dash-ink-secondary">Ad sets</p>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => selectAllAdSetsForCampaign(name, group.adSetNames)}
                              className="text-[12px] text-dash-accent hover:underline"
                            >
                              Select all
                            </button>
                            <button
                              type="button"
                              onClick={() => deselectAllAdSetsForCampaign(name, group.adSetNames)}
                              className="text-[12px] text-dash-accent hover:underline"
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
                                <label htmlFor={`adset-${key}`} className="min-w-0 flex-1 cursor-pointer truncate text-[12px] text-dash-ink-secondary" title={adSetName}>
                                  {adSetName}
                                </label>
                              </li>
                            );
                          })}
                        </ul>
                        {allAdSetsDeselected && (
                          <p className="text-[12px] text-amber-300">No ad set slides will be generated for this campaign.</p>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            <p className="text-[13px] text-dash-ink-secondary">
              The detected objective is shown for each campaign — change it if incorrect. Expand a campaign&apos;s ▼
              to choose which of its ad sets get their own slide.
            </p>
          </div>

          {/* Section B — Metric Cards, collapsed by default. */}
          <div className="space-y-3 rounded-lg border border-dash-border bg-dash-card p-5">
            <button
              type="button"
              onClick={() => setMetricsSectionExpanded((v) => !v)}
              className="flex w-full items-center justify-between text-left"
            >
              <h3 className="text-[16px] font-semibold text-white">
                Metric Cards ({metricsStatus === "loading" ? "…" : selectedMetrics.length || MAX_METRICS_PER_SLIDE} auto-selected)
              </h3>
              <span className="text-[13px] text-dash-accent">{metricsSectionExpanded ? "▲ Hide" : "▼ Customise"}</span>
            </button>

            {!metricsSectionExpanded && (
              <p className="text-[13px] text-dash-ink-secondary">
                {metricsStatus === "loading"
                  ? "Loading metric selection…"
                  : selectedMetrics.length > 0
                    ? `${selectedMetrics.length} metrics selected: ${selectedMetrics.map((m) => m.label).join(", ")}`
                    : "Metrics will be auto-selected based on each campaign's objective."}
              </p>
            )}

            {metricsSectionExpanded && (
              <div className="space-y-4">
                <p className="text-[13px] text-dash-ink-secondary">
                  Your report will show these {Math.min(selectedMetrics.length, MAX_METRICS_PER_SLIDE) || MAX_METRICS_PER_SLIDE} metrics
                  per campaign slide. Tap any card to change it, or leave our recommended selection as-is.
                </p>

                {metricsStatus === "error" && (
                  <div className="rounded-md border border-amber-900 bg-amber-950/30 p-3 text-[13px] text-amber-200">
                    Couldn&apos;t load the full metric list — continuing with the engine&apos;s automatic selection.
                  </div>
                )}

                {selectedMetrics.length > 0 && (
                  <>
                    <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
                      {selectedMetrics.map((metric, i) => (
                        <div
                          key={`${metric.key}-${i}`}
                          className="relative flex min-h-[70px] cursor-pointer items-center justify-center rounded-lg border border-[#334155] bg-[#0d1b2e] p-3 hover:border-[#f6ad55]"
                        >
                          <span
                            className="line-clamp-2 text-center text-[12px] font-semibold uppercase text-white"
                            style={{ letterSpacing: "0.5px" }}
                          >
                            {metric.label}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeMetricAt(i)}
                            aria-label={`Remove ${metric.label}`}
                            className="absolute right-2 top-2 text-[16px] font-bold leading-none text-white hover:text-[#fc8181]"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>

                    {(() => {
                      const warning = slide2Warning();
                      if (!warning) return null;
                      return (
                        <div className="rounded-lg border border-dash-border border-l-4 border-l-dash-accent bg-dash-card p-4 text-[13px] text-dash-ink">
                          <p className="font-semibold">⚠️ Adding a second slide</p>
                          {warning.scenario === "A" ? (
                            <>
                              <p className="mt-1 text-dash-ink-secondary">
                                Your campaign slide shows {MAX_METRICS_PER_SLIDE} metrics — the recommended maximum for one
                                slide. Adding more creates a second slide for this campaign.
                              </p>
                              <p className="mt-1 text-dash-ink-secondary">
                                For slide 2 to look professional it needs at least {MIN_SECOND_SLIDE_METRICS} metrics. You
                                currently have {warning.slide2Count} metric(s) on slide 2 — add {warning.needed} more to
                                fill it properly, or remove a less important metric from slide 1 to keep everything on one
                                clean slide.
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="mt-1 text-dash-ink-secondary">
                                Your campaign slide shows {MAX_METRICS_PER_SLIDE} metrics. Adding more creates a second
                                slide, but you only have {warning.remaining} additional metric(s) available from your CSV —
                                slide 2 will show {warning.slide2Count} metric(s) which may look incomplete.
                              </p>
                              <p className="mt-1 text-dash-ink-secondary">
                                Consider removing a less important metric from slide 1 and swapping it for this one
                                instead.
                              </p>
                            </>
                          )}
                        </div>
                      );
                    })()}

                    {unselectedAvailableMetrics().length > 0 && (
                      <div>
                        <p className="mb-2 text-[13px] text-dash-ink-secondary">Add a metric from your CSV:</p>
                        <div className="flex flex-wrap gap-2">
                          {unselectedAvailableMetrics().map((candidate) => {
                            const disabled = wouldLeaveSlide2TooShort(candidate);
                            return (
                              <button
                                key={candidate.key}
                                type="button"
                                onClick={() => addMetric(candidate)}
                                disabled={disabled}
                                title={disabled ? "Adding this would create a 1-card slide. Remove a card above and swap it instead." : undefined}
                                className="rounded-full border border-dash-border bg-[#111f35] px-3 py-1 text-[12px] text-dash-ink-secondary hover:border-dash-accent hover:text-dash-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-dash-border disabled:hover:text-dash-ink-secondary"
                              >
                                + {candidate.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {metricsLimitMessage && <p className="text-[13px] text-amber-300">{metricsLimitMessage}</p>}
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="rounded-md border border-dash-border px-4 py-2 text-[13px] font-medium text-dash-ink hover:bg-dash-border"
            >
              Back
            </button>
            <button
              onClick={handleCampaignsObjectivesContinue}
              disabled={
                selectedCampaigns.size === 0 ||
                metricsStatus === "loading" ||
                (selectedMetrics.length > 0 && selectedMetrics.length < MIN_SELECTED_METRICS)
              }
              className="rounded-md bg-dash-accent px-6 py-2 text-[13px] font-semibold text-dash-ink hover:bg-dash-accent-hover disabled:opacity-50"
            >
              {metricsStatus === "loading" ? "Loading…" : "Continue →"}
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <button
            type="button"
            onClick={() => setStep(2)}
            className="inline-block text-[13px] text-dash-ink-secondary hover:text-dash-ink hover:underline"
          >
            ← Back
          </button>

          {platform === "META" && (
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
              {previewStatus === "loading" && !data && !comparisonData && (
                <div className="flex items-center gap-3 rounded-lg border border-dash-border bg-dash-card p-4 text-[13px] text-dash-ink-secondary">
                  <Spinner />
                  Loading preview…
                </div>
              )}
            </div>
          )}

          {(data || comparisonData) && (
            <>
            <div className="space-y-4">
              {/* Section 1 — Report summary card, amber left border. Merges
                  what used to be two separate cards (Reporting Period +
                  Ready to generate) into the one card the merged Step 3
                  spec calls for. */}
              <div className="rounded-lg border-l-4 border-l-[#f6ad55] bg-[#1e293b] p-5">
                <h3 className="text-[16px] font-semibold text-white">Ready to generate</h3>
                <hr className="my-3 border-t border-[#334155]" />
                <div className="space-y-2">
                  <p className="text-[13px] text-[#94a3b8]">
                    Client: <span className="text-[14px] text-white">{clientName}</span>
                  </p>
                  <p className="text-[13px] text-[#94a3b8]">
                    Report Type: <span className="text-[14px] text-white">{reportTypeSummaryLabel()}</span>
                  </p>
                  <div>
                    <p className="text-[13px] text-[#94a3b8]">
                      Campaigns:{" "}
                      <span className="text-[14px] text-white">{summaryCampaignNames().length} selected</span>
                    </p>
                    {summaryCampaignNames().length > 0 && (
                      <div className="mt-1 space-y-0.5 pl-3">
                        {summaryCampaignNames().map((name) => (
                          <p key={name} className="text-[13px] text-[#94a3b8]">
                            {name}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                  {reportSummaryLines().length > 0 && (
                    <div>
                      <p className="text-[13px] text-[#94a3b8]">Date range:</p>
                      <div className="mt-1 space-y-0.5 pl-3">
                        {reportSummaryLines().map((line) => (
                          <p key={line.label} className="text-[13px] text-[#94a3b8]">
                            {line.label}: <span className="text-white">{line.value}</span>
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                  <p className="text-[13px] text-[#94a3b8]">
                    Template: <span className="text-[14px] text-white">{clientTemplate === "LIGHT" ? "Light" : "Dark"}</span>
                  </p>
                  <p className="text-[13px] text-[#94a3b8]">
                    Platform: <span className="text-[14px] text-white">{platform === "GOOGLE" ? "Google Ads" : "Meta Ads"}</span>
                  </p>
                </div>
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

            {/* Section 2 — Custom title, collapsed behind a small link by default. */}
            <div className="rounded-lg bg-[#1e293b] p-5">
              {!customTitleExpanded && !reportTitleTouched ? (
                <button
                  type="button"
                  onClick={() => setCustomTitleExpanded(true)}
                  className="text-[13px] text-dash-accent hover:underline"
                >
                  Add custom title +
                </button>
              ) : (
                <>
                  <label className="mb-1 block text-[13px] text-[#94a3b8]">Custom report title</label>
                  <input
                    value={reportTitle}
                    onChange={(e) => {
                      setReportTitle(e.target.value);
                      setReportTitleTouched(true);
                    }}
                    placeholder="e.g. Monthly Campaign Summary or Q3 Performance Review"
                    maxLength={100}
                    disabled={generateStatus === "loading" || generateStatus === "done"}
                    className="w-full rounded-md border border-dash-border bg-dash-card px-3 py-2 text-[13px] text-dash-ink outline-none focus:border-dash-accent disabled:opacity-60"
                  />
                  <p className="mt-1 text-[12px] text-[#94a3b8]">Replaces the report type title on the cover slide.</p>
                </>
              )}
            </div>

            {/* Section 3 — Generate button. Same screen throughout: only
                this changes as generateStatus moves idle -> loading ->
                done/error, so there's no navigation between "getting ready"
                and "here's your file". */}
            {generateStatus === "idle" && (
              <div>
                <button
                  onClick={handleGenerate}
                  className="h-12 w-full rounded-md bg-dash-accent text-[16px] font-semibold text-white hover:bg-dash-accent-hover"
                >
                  Generate Report
                </button>
                <p className="mt-2 text-center text-[12px] text-[#94a3b8]">This usually takes 20-30 seconds</p>
              </div>
            )}
          </div>

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
              <button
                onClick={handleGenerate}
                className="rounded-md bg-dash-accent px-4 py-2 text-[13px] font-medium text-dash-ink hover:bg-dash-accent-hover"
              >
                Try Again
              </button>
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

              <div className="flex flex-wrap items-start gap-3">
                <a
                  href={downloadUrl}
                  className="inline-block rounded-md bg-emerald-600 px-4 py-2 text-[13px] font-medium text-dash-ink hover:bg-emerald-500"
                >
                  Download PPTX
                </a>

                {/* Public read-only share page — always available once the
                    report is generated (see share-token.ts/share-report.ts),
                    independent of the Google Drive save flow below. */}
                {shareToken && (
                  <div>
                    <a
                      href={`https://${buildShareReportUrl(shareToken)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md border border-dash-border bg-dash-card px-4 py-2 text-[13px] font-medium text-dash-ink hover:bg-dash-border"
                    >
                      🌐 View Report in Browser
                    </a>
                    <p className="mt-1.5 text-[12px] text-dash-ink-secondary">
                      {buildShareReportUrl(shareToken)} ·{" "}
                      <button type="button" onClick={handleCopyShareLink} className="text-dash-accent hover:underline">
                        Copy
                      </button>
                    </p>
                  </div>
                )}

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
                  {shareToken && (
                    <p className="mb-3 text-[13px] text-dash-ink-secondary">
                      Share link: {buildShareReportUrl(shareToken)} ·{" "}
                      <button type="button" onClick={handleCopyShareLink} className="text-dash-accent hover:underline">
                        Copy
                      </button>
                    </p>
                  )}
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
                    <button
                      type="button"
                      onClick={openEmailModal}
                      className="inline-flex items-center gap-1.5 rounded-md border border-dash-border bg-dash-bg px-3 py-1.5 text-[13px] text-dash-ink-secondary hover:bg-dash-border"
                    >
                      <MailIcon />
                      Email
                    </button>
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

              {/* Fix 1 — only for a real WEEKLY/MONTHLY report (comparison reports have no Previous Month Data row to be missing) and only when the client genuinely has none uploaded. */}
              {reportType !== "COMPARISON" && !hasPreviousMonthData && (
                <div className="rounded-lg border border-dash-border border-l-4 border-l-dash-accent bg-dash-card p-4 text-[13px] text-dash-ink">
                  <p className="font-semibold">📊 Missing previous month comparison</p>
                  <p className="mt-1 text-dash-ink-secondary">
                    Your Monthly Campaign Performance Overview slide does not have a previous month row.{" "}
                    <Link href={`/clients/${clientId}`} className="text-dash-accent hover:underline">
                      Upload previous month data in Client Settings
                    </Link>{" "}
                    to enable it.
                  </p>
                </div>
              )}

            </div>
          )}
            </>
          )}
        </div>
      )}

      {emailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg border border-dash-border bg-dash-card p-5">
            <h2 className="text-[16px] font-semibold text-dash-ink">Send Report by Email</h2>

            <div className="mt-4">
              <label className="mb-1 block text-sm text-dash-ink-secondary">To</label>
              <input
                autoFocus
                type="email"
                required
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="client@example.com"
                className="w-full rounded-md border border-dash-border bg-dash-bg px-3 py-2 text-sm text-dash-ink outline-none focus:border-dash-accent"
              />
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-sm text-dash-ink-secondary">Message (optional)</label>
              <textarea
                rows={3}
                value={emailMessage}
                onChange={(e) => setEmailMessage(e.target.value)}
                placeholder="Hi, please find your weekly performance report attached..."
                className="w-full resize-none rounded-md border border-dash-border bg-dash-bg px-3 py-2 text-sm text-dash-ink outline-none focus:border-dash-accent"
              />
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEmailModalOpen(false)}
                disabled={emailSending}
                className="rounded-md border border-dash-border px-4 py-2 text-[13px] text-dash-ink-secondary hover:bg-dash-bg disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendEmail}
                disabled={emailSending || !emailTo.trim()}
                className="rounded-md bg-dash-accent px-4 py-2 text-[13px] font-semibold text-dash-ink hover:bg-dash-accent-hover disabled:opacity-60"
              >
                {emailSending ? "Sending…" : "Send Email →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * `visitedSteps` (not just "s < step") decides whether a step is completed
 * and clickable — the Google Ads flow jumps straight from step 1 to step 3
 * (dispatchAfterAnalyze), so step 2 is numerically "less than" step 3
 * without ever having been shown; it must stay muted/unclickable rather
 * than falsely offering navigation into a step that was never populated.
 * Clicking a completed step just calls onNavigate(s) — a plain setStep,
 * identical to the wizard's existing per-screen "Back" buttons — so all
 * state (upload, campaigns, objectives, metrics, dates) is preserved automatically:
 * nothing here clears or resets any of it.
 */
function StepIndicator({
  step,
  visitedSteps,
  onNavigate,
}: {
  step: Step;
  visitedSteps: Set<Step>;
  onNavigate: (s: Step) => void;
}) {
  const steps: Step[] = [1, 2, 3];
  return (
    <div className="flex flex-wrap items-center gap-2 text-[13px]">
      {steps.map((s, i) => {
        const isCompleted = s < step && visitedSteps.has(s);
        return (
          <div key={s} className="flex items-center gap-2">
            {isCompleted ? (
              <button
                type="button"
                onClick={() => onNavigate(s)}
                className="rounded-full px-3 py-1 font-medium text-dash-accent hover:underline"
              >
                {STEP_LABELS[s]}
              </button>
            ) : (
              <span
                className={
                  s === step
                    ? "rounded-full bg-dash-accent px-3 py-1 font-medium text-dash-ink"
                    : "rounded-full border border-dash-border px-3 py-1 text-dash-ink-secondary"
                }
              >
                {STEP_LABELS[s]}
              </span>
            )}
            {i < steps.length - 1 && <span className="text-dash-ink-secondary">→</span>}
          </div>
        );
      })}
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

/** Meta Ads platform-selector icon — a plain solid blue circle, no text or brand glyphs. */
function MetaAdsIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="20" cy="20" r="20" fill="#1877F2" />
    </svg>
  );
}

/** Google Ads platform-selector icon — a plain solid blue rounded square, no text or brand glyphs. */
function GoogleAdsIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="40" height="40" rx="8" fill="#4285F4" />
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

/** Step 1's platform cards and Step 5's Report Type cards share this same "full selectable card" shape (icon/heading/description) — plain buttons rather than native radios, since the visual design calls for full selectable cards, not a radio dot + label row. */
function ReportTypeCard({
  icon,
  heading,
  description,
  selected,
  onSelect,
}: {
  icon: ReactNode;
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
      <span className="inline-flex text-2xl" aria-hidden="true">
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
