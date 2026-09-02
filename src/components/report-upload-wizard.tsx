"use client";

import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  clearWizardGenerateSnapshot,
  loadWizardGenerateSnapshot,
  saveWizardGenerateSnapshot,
  type WizardGenerateSnapshot,
} from "@/lib/nre/wizard-generate-snapshot";
import type { WizardReportType } from "@/lib/validators/report-wizard";
import type { ReportData, ComparisonReportData } from "@/lib/nre/report-data";
import type { ValidationIssue } from "@/lib/nre/validate";
import { extractDriveFolderIdFromLink } from "@/lib/drive-link";
import {
  evaluateAddMetric,
  filterAddableMetrics,
  findPrimaryResultCostPair,
  MAX_METRICS_PER_SLIDE,
  MAX_TOTAL_METRICS,
  type SelectedMetric,
} from "@/lib/nre/available-metrics";
import { OBJECTIVE_DROPDOWN_OPTIONS, type ObjectiveInfo } from "@/lib/nre/result-type-map";
import { normalizeCampaignName } from "@/lib/nre/objective";
import { LOW_SPEND_CAMPAIGN_THRESHOLD, isLowSpendCampaign } from "@/lib/nre/campaigns";
import { adSetKey, type AdSetGroup } from "@/lib/nre/ad-sets";
import { getMetaCsvDownloadTip, type CsvDateGuidance } from "@/lib/nre/csv-date-guidance";
import { useToast } from "@/components/toast";

// 5-screen wizard. Went 6 -> 3 -> 5 across two rounds: the 3-screen version
// crammed campaign checkboxes + ad-set expand sections + the objective
// dropdown + a collapsible metric-card section onto one screen, which
// turned out to feel cluttered once ad-set selection was added (a lot of
// interactive surface — checkboxes, an expand arrow, a per-ad-set checklist
// with its own select-all/deselect-all, a 16-option dropdown, and a
// confidence badge — all stacked in a single row, potentially repeated for
// many campaigns). Splitting Campaigns and Objectives back into two
// screens keeps each one focused; Metric Cards also got its own dedicated
// screen back (no longer collapsed behind a summary). Nothing about what
// each step DOES changed from the very first 6-step version except how
// ad-set selection is threaded through — see below.
//
// Step 1 — Upload (unchanged): platform selector, file upload, Analyze.
//
// Step 2 — Select Campaigns (Meta only): checkbox per campaign, plus an
// "Ad Sets ▼" expand arrow for any campaign with at least one spending ad
// set (ad-sets.ts's extractSpendingAdSetGroups). Expanding shows that
// campaign's ad sets as their own checklist with a Select all/Deselect all
// toggle. Default checked state (see applyAnalyzeResult): a campaign with
// exactly one ad set starts UNCHECKED (its own slide would just repeat the
// campaign slide — opt in if you want one anyway); a campaign with 2+ ad
// sets starts with all of them CHECKED. This only ever prunes which ad-set
// SLIDES get built (report-data.ts's Phase A2) — never campaign totals, the
// MTD chart, or the Combined Total table; see BuildReportDataInput.
// selectedAdSets's doc comment for the history of why that separation
// matters. Continuing from here (handleCampaignsContinue) is what fetches
// /metrics — using whatever selectedCampaigns the user has settled on by
// then, read at click-time, not synchronously right after analyze (that
// used to read stale pre-render state and made every objective dropdown
// fall back to RESULTS — see the regression fix in handleCampaignsContinue/
// fetchObjectivesAndMetrics if touching this again).
//
// Step 3 — Confirm Objectives (Meta only): one dropdown + confidence badge
// per SELECTED campaign, pre-filled from the /metrics response fetched on
// Step 2's Continue (objective.ts's resolveCampaignObjective / the
// Objective Confirmation memory cache — see objective-cache.ts). A fresh
// fetch on every arrival here (not cached across visits) so going back to
// Step 2 and changing the campaign selection is always reflected.
//
// Step 4 — Metric Cards (Meta only, optional): the review-card grid from
// the same /metrics response — tap a card to remove it, add more from the
// CSV's own columns, subject to the min/max bounds. Skipping it (or never
// touching it) leaves the engine's own automatic per-objective assignment.
//
// Step 5 — Report Period & Generate (Meta) / Preview & Generate (Google):
// merges the old Dates step and Preview+Generate step onto one screen. The
// preview can't wait for an explicit "Continue" click between the two, so
// it's refetched automatically by a useEffect keyed on `step`/reportType/
// date fields — see fetchPreview — every time the user changes something in
// the Reporting Period section while on this step. Since applyPreviewResult
// already calls resetGenerateState() on every successful fetch, changing
// dates after a report has already been generated naturally clears the old
// download links and shows the Generate button again, with no separate
// "back to dates" navigation needed — the date controls are already right
// there on the same screen. Google Ads' simpler pipeline (no weekly/
// monthly/comparison choice, no campaign selection — see
// google-report-data.ts's own file header) skips the Reporting Period
// section and the refetch effect entirely, landing here with whatever
// /preview response dispatchAfterAnalyze already fetched directly.
type Step = 1 | 2 | 3 | 4 | 5;
const STEP_LABELS: Record<Step, string> = {
  1: "Upload",
  2: "Campaigns",
  3: "Objectives",
  4: "Metrics",
  5: "Generate",
};

// Fix 2 — context-specific wizard heading per step, replacing the generic
// "Generate Report" heading that used to be static on every screen.
const STEP_HEADINGS: Record<Step, string> = {
  1: "Upload Your CSV",
  2: "Select Campaigns",
  3: "Confirm Objectives",
  4: "Review Metric Cards",
  5: "Choose report type and generate",
};

const STEP_SUBTITLES: Record<Step, string> = {
  1: "Upload a day-wise CSV from Ads Manager — the tip below shows the correct date range for today.",
  2: "Unchecked campaigns stay out of the deck. Ad-set slides are extra; campaign totals still include them.",
  3: "Wrong objective means wrong cards and Combined Total. Fix it here.",
  4: "These chips become the PPT cards. Remove or add; extras come only from this CSV.",
  5: "Pick a report type, set dates if needed, review the summary, then generate.",
};

const LAST_PLATFORM_STORAGE_KEY = "nre.lastAdPlatform";
const ADD_FROM_CSV_VISIBLE = 8;
const ADSET_CHIP_CLASS =
  "flex-shrink-0 rounded-md border border-dash-border bg-dash-bg px-2 py-1 text-[12px] font-medium text-dash-ink-secondary hover:text-dash-ink disabled:opacity-30";

const MIN_SELECTED_METRICS = 4;

function joinMetricLabels(metrics: SelectedMetric[]): string {
  const labels = metrics.map((item) => item.label);
  if (labels.length <= 1) return labels[0] ?? "";
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

type AnalyzeStatus = "idle" | "loading" | "invalid" | "error";
type PreviewStatus = "idle" | "loading" | "invalid" | "error";
type GenerateStatus = "idle" | "loading" | "done" | "error";
type DateMode = "last7" | "prev7" | "custom";
type ReportTypeValue = WizardReportType;
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

const DEFAULT_DAILY_REPORT_TITLE = "Daily Performance Report";
const DEFAULT_CREATIVE_REPORT_TITLE = "Creative Performance Report";

function defaultReportTitleFor(reportType: ReportTypeValue): string {
  if (reportType === "MONTHLY") return DEFAULT_MONTHLY_REPORT_TITLE;
  if (reportType === "DAILY") return DEFAULT_DAILY_REPORT_TITLE;
  if (reportType === "CREATIVE") return DEFAULT_CREATIVE_REPORT_TITLE;
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

/** "2026-07-18" -> "Jul 18" (abbreviated month), for the Report Summary card's Week period/Month to date rows — kept separate from formatIso's full-month format used elsewhere (date-bounds errors, the PPTX itself) so this display-only change can't affect those. */
function formatIsoShort(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(d);
}

/** "Aug 14 - Aug 20, 2026" — the year is taken from the range's end date and shown once, at the end. */
function formatSummaryRange(range: DateRangeIso): string {
  const year = new Date(range.endIso + "T00:00:00Z").getUTCFullYear();
  return `${formatIsoShort(range.startIso)} - ${formatIsoShort(range.endIso)}, ${year}`;
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

function buildTelegramShareUrl(reportUrl: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(reportUrl)}&text=${encodeURIComponent("Your performance report is ready")}`;
}

function buildSlackShareUrl(reportUrl: string): string {
  return `https://slack.com/share?url=${encodeURIComponent(reportUrl)}&text=${encodeURIComponent("Your performance report is ready")}`;
}

function buildMailtoShareUrl(reportUrl: string, accountName: string): string {
  const subject = encodeURIComponent(`${accountName} — Performance Report`);
  const body = encodeURIComponent(`Hi,\n\nYour report is ready to view:\n${reportUrl}\n\n`);
  return `mailto:?subject=${subject}&body=${body}`;
}

/** The public read-only share page's URL (see app/r/[token]/page.tsx) — a plain domain/path, no protocol, matching how it's shown/copied everywhere in the product spec. */
function buildShareReportUrl(shareToken: string): string {
  return `nextreport.in/r/${shareToken}`;
}

export function ReportUploadWizard({
  clientId,
  clientName,
  currencySymbol,
  hasGoogleDriveConnected,
  initialLastDriveFolderId,
  initialLastDriveFolderName,
  hasPreviousMonthData,
  clientTemplate,
}: {
  clientId: string;
  /** Client.accountName — used for the "Generate Another Report for [Client Name]" button (B3) and the friendly Drive link label. */
  clientName: string;
  /** Client currency symbol for campaign spend badges on Step 2. */
  currencySymbol: string;
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
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LAST_PLATFORM_STORAGE_KEY);
      if (stored === "META" || stored === "GOOGLE") setSelectedPlatformCard(stored);
    } catch {
      /* private mode */
    }
  }, []);

  function choosePlatform(next: "META" | "GOOGLE") {
    setSelectedPlatformCard(next);
    setMismatchWarning(false);
    setAnalyzeStatus("idle");
    setAnalyzeErrors([]);
    setAnalyzeMessage(null);
    try {
      localStorage.setItem(LAST_PLATFORM_STORAGE_KEY, next);
    } catch {
      /* private mode */
    }
  }
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
  const [selectedPlatformCard, setSelectedPlatformCard] = useState<"META" | "GOOGLE" | null>("META");
  const [mtdFile, setMtdFile] = useState<File | null>(null);
  const [analyzeStatus, setAnalyzeStatus] = useState<AnalyzeStatus>("idle");
  const [analyzeErrors, setAnalyzeErrors] = useState<ValidationIssue[]>([]);
  const [analyzeMessage, setAnalyzeMessage] = useState<string | null>(null);

  // Previous Month Summary — a small, self-contained state machine
  // independent of the rest of the wizard's step/data/generateStatus
  // machinery: it's offered right where a NO_DATA_ROWS_MESSAGE error would
  // otherwise show (Step 1's analyzeErrors, or Step 5's previewErrors),
  // BEFORE the normal campaign/dates/metrics steps ever run — none of them
  // apply when there's no current-period data to review. See
  // PreviousMonthSummaryOption below and handleGeneratePreviousMonthSummary.
  const [pmsStatus, setPmsStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [pmsError, setPmsError] = useState<string | null>(null);
  const [pmsResult, setPmsResult] = useState<{ reportId: string; downloadUrl: string; shareToken: string | null } | null>(null);
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
  const [campaignSpend, setCampaignSpend] = useState<Record<string, number>>({});
  const [lowSpendCampaigns, setLowSpendCampaigns] = useState<string[]>([]);
  const [selectedCampaigns, setSelectedCampaigns] = useState<Set<string>>(new Set());
  const [campaignSearch, setCampaignSearch] = useState("");
  const [expandedCsvExtras, setExpandedCsvExtras] = useState<Set<string>>(new Set());

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
  // Objective Confirmation memory cache, Thing 2 (three-layer objective
  // architecture rebuild) — per-campaign confidence tag from the /metrics
  // response, keyed the same way campaignObjectives is (normalizeCampaignName).
  // Drives the badge under each dropdown: "cached" -> green "Previously
  // confirmed" (this exact client has confirmed this campaign before),
  // "high" -> green "Detected" (real result_type text matched), "medium" ->
  // grey "Please verify" (one clean non-leads column signal), "low" -> amber
  // "Low confidence" (one lead-family column signal — the pair agencies most
  // often confuse), "verify" -> red "Confirmation required" (genuinely
  // ambiguous or no real signal at all — see campaignRequiresConfirmation
  // below). Cleared the moment a campaign is touched (see
  // setCampaignObjective) — once the user has picked a value themselves, a
  // badge describing where the PRE-fill came from is no longer meaningful.
  const [campaignObjectiveConfidence, setCampaignObjectiveConfidence] = useState<
    Map<string, "cached" | "high" | "medium" | "low" | "verify">
  >(new Map());
  // Thing 2 — true only for a "verify"-tier campaign: the Continue button on
  // Step 3 is disabled for that campaign until the user picks a value
  // (setCampaignObjective clears this the moment they do, alongside the
  // confidence tag above).
  const [campaignRequiresConfirmation, setCampaignRequiresConfirmation] = useState<Map<string, boolean>>(new Map());

  // Step 4 — Metrics, Thing 3 (three-layer objective architecture rebuild):
  // each selected campaign gets its OWN independently-computed metric
  // selection (populated by /metrics right after Campaign Selection, keyed
  // by normalizeCampaignName like campaignObjectives) — never a single
  // shared account-wide list narrowed per campaign, so a campaign whose
  // objective is META FORM LEADS never shows another campaign's WEBSITE
  // LEADS pair. perCampaignAvailablePool is that campaign's own "add a
  // metric" candidates (CSV columns not already selected for it,
  // objective-relevant per Thing 1's stripNeverKeys).
  const [perCampaignMetrics, setPerCampaignMetrics] = useState<Map<string, SelectedMetric[]>>(new Map());
  const [perCampaignAvailablePool, setPerCampaignAvailablePool] = useState<Map<string, SelectedMetric[]>>(new Map());
  const [metricsStatus, setMetricsStatus] = useState<"idle" | "loading" | "error">("idle");
  const [perCampaignMinWarning, setPerCampaignMinWarning] = useState<string | null>(null);
  const [overflowDialog, setOverflowDialog] = useState<{
    campaignName: string;
    normalized: string;
    metric: SelectedMetric;
    mode: "confirm_second_slide" | "blocked_max";
  } | null>(null);

  // Step 5 — Dates (populated by /analyze)
  const [dateBounds, setDateBounds] = useState<{ minIso: string; maxIso: string } | null>(null);
  const [csvDateGuidance, setCsvDateGuidance] = useState<CsvDateGuidance | null>(null);
  const [csvWarningDismissed, setCsvWarningDismissed] = useState(false);
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
  const [dailyRange, setDailyRange] = useState<DateRangeIso | null>(null);
  const [hasAdLevelCsv, setHasAdLevelCsv] = useState(false);

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
  // Custom title input starts collapsed behind an "Add custom PPT report
  // title +" link on the merged Step 3 — expanding it once (or having already typed
  // a title) keeps it expanded for the rest of the session.
  const [customTitleExpanded, setCustomTitleExpanded] = useState(false);

  // Step 6 — Generate (same screen as Preview above, see the step === 6 JSX block)
  const [generateStatus, setGenerateStatus] = useState<GenerateStatus>("idle");
  const [generateMessage, setGenerateMessage] = useState<string | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [pdfAvailable, setPdfAvailable] = useState(false);
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

  const resumeReportId = searchParams.get("resumeReport");
  const [resumeBootstrapping, setResumeBootstrapping] = useState(() => !!resumeReportId);

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
    setPublishedAt(null);
    setPdfAvailable(false);
  }

  function buildGenerateSnapshot(
    core: Pick<WizardGenerateSnapshot, "reportId" | "downloadUrl" | "shareToken">,
    extras?: Partial<
      Pick<WizardGenerateSnapshot, "driveView" | "driveSaveUrl" | "rememberedFolder" | "publishedAt" | "pdfAvailable">
    >,
  ): WizardGenerateSnapshot {
    return {
      version: 1,
      ...core,
      platform,
      reportType,
      dateMode,
      customStart,
      customEnd,
      dateBounds,
      weeklyOptions,
      mtdRange,
      monthComparisonOptions,
      comparisonPreset,
      comparisonPeriodA,
      comparisonPeriodB,
      previewKind,
      previewStatus,
      data,
      comparisonData,
      reportTitle,
      reportTitleTouched,
      customTitleExpanded,
      selectedCampaigns: Array.from(selectedCampaigns),
      driveView: extras?.driveView ?? driveView,
      driveSaveUrl: extras?.driveSaveUrl ?? driveSaveUrl,
      rememberedFolder: extras?.rememberedFolder ?? rememberedFolder,
      publishedAt: extras?.publishedAt ?? publishedAt,
      pdfAvailable: extras?.pdfAvailable ?? pdfAvailable,
    };
  }

  function applyGenerateSnapshot(snapshot: WizardGenerateSnapshot) {
    setReportId(snapshot.reportId);
    setDownloadUrl(snapshot.downloadUrl);
    setShareToken(snapshot.shareToken);
    setPlatform(snapshot.platform);
    setReportType(snapshot.reportType);
    setDateMode(snapshot.dateMode);
    setCustomStart(snapshot.customStart);
    setCustomEnd(snapshot.customEnd);
    setDateBounds(snapshot.dateBounds);
    setWeeklyOptions(snapshot.weeklyOptions);
    setMtdRange(snapshot.mtdRange);
    setMonthComparisonOptions(snapshot.monthComparisonOptions);
    setComparisonPreset(snapshot.comparisonPreset);
    setComparisonPeriodA(snapshot.comparisonPeriodA);
    setComparisonPeriodB(snapshot.comparisonPeriodB);
    setPreviewKind(snapshot.previewKind);
    setPreviewStatus(snapshot.previewStatus);
    setData(snapshot.data);
    setComparisonData(snapshot.comparisonData);
    setReportTitle(snapshot.reportTitle);
    setReportTitleTouched(snapshot.reportTitleTouched);
    setCustomTitleExpanded(snapshot.customTitleExpanded);
    setSelectedCampaigns(new Set(snapshot.selectedCampaigns));
    setDriveView(snapshot.driveView);
    setDriveSaveUrl(snapshot.driveSaveUrl);
    setRememberedFolder(snapshot.rememberedFolder);
    setPublishedAt(snapshot.publishedAt ?? null);
    setPdfAvailable(snapshot.pdfAvailable ?? false);
    setGenerateStatus("done");
    setGenerateMessage(null);
  }

  function persistGenerateSnapshot(
    core: Pick<WizardGenerateSnapshot, "reportId" | "downloadUrl" | "shareToken">,
    extras?: Partial<
      Pick<WizardGenerateSnapshot, "driveView" | "driveSaveUrl" | "rememberedFolder" | "publishedAt" | "pdfAvailable">
    >,
  ) {
    saveWizardGenerateSnapshot(clientId, buildGenerateSnapshot(core, extras));
  }

  // Return from "Review before sharing" — restore the exact post-generate screen via session snapshot.
  useLayoutEffect(() => {
    if (!resumeReportId) return;

    const snapshot = loadWizardGenerateSnapshot(clientId, resumeReportId);
    if (snapshot) {
      applyGenerateSnapshot(snapshot);
      setStepState(5);
      setVisitedSteps(new Set([1, 2, 3, 4, 5]));
      router.replace(`/clients/${clientId}/reports/new`);
      setResumeBootstrapping(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      const res = await fetch(`/api/clients/${clientId}/reports/${resumeReportId}`);
      const json = await res.json().catch(() => null);
      if (cancelled) return;
      if (!res.ok || !json?.ok) {
        showToast("Could not reopen that report. Generate a new one or pick it from report history.", "error");
        router.replace(`/clients/${clientId}/reports/new`);
        setResumeBootstrapping(false);
        return;
      }

      setReportId(resumeReportId);
      setDownloadUrl(`/api/reports/${resumeReportId}/download`);
      setShareToken(json.shareToken ?? null);
      setPublishedAt(json.publishedAt ?? null);
      setPdfAvailable(!!(json.publishedAt ?? json.pdfAvailable));
      setGenerateStatus("done");
      setGenerateMessage(null);
      persistGenerateSnapshot(
        {
          reportId: resumeReportId,
          downloadUrl: `/api/reports/${resumeReportId}/download`,
          shareToken: json.shareToken ?? null,
        },
        {
          publishedAt: json.publishedAt ?? null,
          pdfAvailable: !!json.pdfAvailable,
        },
      );
      setStepState(5);
      setVisitedSteps(new Set([1, 2, 3, 4, 5]));
      router.replace(`/clients/${clientId}/reports/new`);
      setResumeBootstrapping(false);
      showToast("Download links restored — open this report from history if the full screen looks incomplete.");
    })();

    return () => {
      cancelled = true;
    };
  }, [clientId, resumeReportId, router, showToast]);

  /** Populates campaigns/date state from a successful /analyze response — shared by handleAnalyze (natural detection) and handleMismatchContinueAnyway (forced platform). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function applyAnalyzeResult(json: any) {
    setCampaigns(json.campaigns || []);
    setCampaignSpend(json.campaignSpend || {});
    setLowSpendCampaigns(json.lowSpendCampaigns || []);
    setSelectedCampaigns(new Set<string>(json.selectedCampaigns || []));
    const groups: AdSetGroup[] = json.adSetGroups || [];
    setAdSetGroups(groups);
    // Default checked state: a campaign with exactly one ad set starts
    // UNCHECKED (its own slide would just repeat the campaign slide — the
    // user opts in if they want one anyway); a campaign with 2+ ad sets
    // starts with all of them CHECKED.
    setSelectedAdSets(
      new Set(
        groups.flatMap((g) => (g.adSetNames.length === 1 ? [] : g.adSetNames.map((name) => adSetKey(g.campaignName, name)))),
      ),
    );
    setExpandedCampaigns(new Set());
    setDateBounds(json.dateBounds || null);
    setCsvDateGuidance(json.csvDateGuidance || null);
    setCsvWarningDismissed(false);
    setWeeklyOptions(json.weeklyOptions || null);
    setMtdRange(json.mtdRange || null);
    setMonthComparisonOptions(json.monthComparisonOptions || null);
    setDailyRange(json.dailyRange || null);
    setHasAdLevelCsv(!!json.hasAdLevelCsv);
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

  /** Meta lands straight on Step 2 (Select Campaigns) — /metrics isn't fetched until that step's own Continue click (see handleCampaignsContinue), once selectedCampaigns has actually settled from user interaction rather than being read mid-render. Google Ads skips straight to the preview — no campaign selection, no report-type toggle, no Previous Month Data (see google-report-data.ts's own file header for why this pipeline is deliberately simpler for v1). */
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
  ): {
    objectives: Map<string, ObjectiveInfo>;
    confidence: Map<string, "cached" | "high" | "medium" | "low" | "verify">;
    requiresConfirmation: Map<string, boolean>;
  } {
    const objectives = new Map<string, ObjectiveInfo>();
    const confidence = new Map<string, "cached" | "high" | "medium" | "low" | "verify">();
    const requiresConfirmation = new Map<string, boolean>();
    if (!json) return { objectives, confidence, requiresConfirmation };
    for (const [name, info] of Object.entries(json)) {
      if (!info?.resultLabel || !info?.costLabel) continue;
      objectives.set(name, objectiveInfoForResultLabel(info.resultLabel, info.costLabel));
      if (info.confidence === "cached" || info.confidence === "high" || info.confidence === "medium" || info.confidence === "low" || info.confidence === "verify") {
        confidence.set(name, info.confidence);
      }
      if (info.requiresConfirmation === true) requiresConfirmation.set(name, true);
    }
    return { objectives, confidence, requiresConfirmation };
  }

  /**
   * Populates the Confirm Objectives step's dropdowns + the Metric Cards
   * step's review grid — one /metrics call covers both, keyed off
   * whatever `selectedCampaigns` is AT THE TIME THIS RUNS. Only ever called
   * from handleCampaignsContinue's click handler below, deliberately never
   * chained synchronously right after a setSelectedCampaigns(...) call
   * elsewhere: reading selectedCampaigns synchronously in the same
   * function that just set it reads the PRE-render value (React batches
   * the update), which is how this used to silently send
   * selectedCampaigns: [] — filterRowsByCampaigns's "empty array means
   * nothing selected" convention then zeroed out every row, so
   * buildCampaignObjectiveMapWithConfidence had nothing to detect from and
   * every dropdown fell back to the generic RESULTS option. Reading it
   * here, in a function invoked from a later user click, is always the
   * fully-committed value.
   */
  async function fetchObjectivesAndMetrics() {
    if (!mtdFile) return;
    setMetricsStatus("loading");
    setTouchedObjectiveCampaigns(new Set());
    setPerCampaignMinWarning(null);

    const res = await fetch(`/api/clients/${clientId}/reports/metrics`, {
      method: "POST",
      body: buildUploadFormData(mtdFile, { platform, selectedCampaigns: Array.from(selectedCampaigns) }),
    });
    const json = await res.json().catch(() => null);

    if (!res.ok || !json || json.error) {
      // Objectives/Metrics are a nice-to-have preview, not a hard
      // requirement — a failure here shouldn't strand the wizard. Fall
      // through with an empty selection (the engine's automatic
      // assignment) and an empty objective map (Confirm Objectives falls
      // back to RESULTS for every campaign in that case) and let the user
      // continue past Step 2 regardless.
      setMetricsStatus("error");
      setPerCampaignMetrics(new Map());
      setPerCampaignAvailablePool(new Map());
      setCampaignObjectives(new Map());
      setCampaignObjectiveConfidence(new Map());
      setCampaignRequiresConfirmation(new Map());
      return;
    }

    setPerCampaignMetrics(new Map(Object.entries(json.perCampaignSelection || {})));
    setPerCampaignAvailablePool(new Map(Object.entries(json.perCampaignAvailable || {})));
    const { objectives, confidence, requiresConfirmation } = campaignObjectivesFromJson(json.campaignObjectives);
    setCampaignObjectives(objectives);
    setCampaignObjectiveConfidence(confidence);
    setCampaignRequiresConfirmation(requiresConfirmation);
    setMetricsStatus("idle");
  }

  // ── Step 2 -> 3: Select Campaigns -> Confirm Objectives ─────────────────
  async function handleCampaignsContinue() {
    await saveSelection({ campaigns, selectedCampaigns: Array.from(selectedCampaigns) });
    await fetchObjectivesAndMetrics();
    setStep(3);
  }

  // ── Step 3 -> 4: Confirm Objectives -> Metric Cards ─────────────────────
  function handleObjectivesContinue() {
    setStep(4);
  }

  // ── Step 4 -> 5: Metric Cards -> Report Period & Generate ───────────────
  function handleMetricsContinue() {
    setPerCampaignMinWarning(null);
    setStep(5);
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
    // Thing 2 — the user has now actively picked a value; "verify" no
    // longer blocks Continue for this campaign regardless of what the
    // engine originally detected.
    setCampaignRequiresConfirmation((prev) => {
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
   * Thing 2 (three-layer objective architecture rebuild) — the 5 badges the
   * Objective Confirmation step shows below each campaign's dropdown.
   * "cached" (green check) is the highest confidence: this exact client has
   * confirmed this exact campaign before. "high" (small green check) is the
   * engine finding real result_type text (objective.ts's
   * resolveCampaignObjectiveWithConfidence "high" tier). "medium" (grey dot)
   * is one clean non-leads dedicated-column signal. "low" (amber warning) is
   * one lead-family column signal — the pair agencies most often confuse.
   * "verify" (loud red pill) is genuinely ambiguous or has no real signal at
   * all — pairs with campaignRequiresConfirmation, which blocks Continue for
   * that campaign until the user picks a value. Returns null for a campaign
   * with no confidence tag at all (the user has already touched its
   * dropdown — see setCampaignObjective — so nothing needs to be shown).
   */
  function objectiveConfidenceBadge(tier: "cached" | "high" | "medium" | "low" | "verify" | undefined) {
    if (tier === "cached") {
      return { icon: "✓", text: "Previously confirmed", className: "text-[#68d391]", pill: false };
    }
    if (tier === "high") {
      return { icon: "✓", text: "Detected", className: "text-[#68d391]", pill: false };
    }
    if (tier === "medium") {
      return { icon: "●", text: "Please verify", className: "text-dash-ink-secondary", pill: false };
    }
    if (tier === "low") {
      return { icon: "⚠", text: "Low confidence", className: "text-[#f6ad55]", pill: false };
    }
    if (tier === "verify") {
      return { icon: "⚠", text: "Confirmation required", className: "bg-[#fc8181] text-[#2d0b0b]", pill: true };
    }
    return null;
  }

  // ── Step 4: Metrics, Thing 3 (three-layer objective architecture rebuild) ──
  // Every function below operates on ONE campaign's own independent
  // selection — there is no shared account-wide list to narrow per campaign
  // anymore (see perCampaignMetrics/perCampaignAvailablePool state above).

  /** This campaign's still-addable pool — its fixed perCampaignAvailablePool candidates minus whatever's currently in its own pill list, so removing a pill makes it reappear here and adding one removes it, entirely computed (no separately-tracked "available" state to drift out of sync). */
  function campaignAvailableMetrics(normalizedName: string): SelectedMetric[] {
    const pool = perCampaignAvailablePool.get(normalizedName) ?? [];
    const selected = perCampaignMetrics.get(normalizedName) ?? [];
    return filterAddableMetrics(pool, selected);
  }

  /** Removes one metric pill from a single campaign's own list — never affects any other campaign. Enforces the 4-metric minimum, scoped per-campaign. */
  function removeCampaignMetric(normalizedName: string, key: string) {
    const current = perCampaignMetrics.get(normalizedName) ?? [];
    if (current.length <= MIN_SELECTED_METRICS) {
      setPerCampaignMinWarning(`Each campaign needs at least ${MIN_SELECTED_METRICS} metric cards.`);
      return;
    }
    setPerCampaignMinWarning(null);
    setPerCampaignMetrics((prev) => new Map(prev).set(normalizedName, current.filter((m) => m.key !== key)));
  }

  /** Adds one metric pill. 8 → 9 confirms a continuation slide; 9–16 add freely. */
  function addCampaignMetric(normalizedName: string, metric: SelectedMetric, campaignName: string) {
    const current = perCampaignMetrics.get(normalizedName) ?? [];
    const decision = evaluateAddMetric(current.length);
    if (decision === "allow") {
      setPerCampaignMinWarning(null);
      setPerCampaignMetrics((prev) => new Map(prev).set(normalizedName, [...current, metric]));
      return;
    }
    setOverflowDialog({ campaignName, normalized: normalizedName, metric, mode: decision });
  }

  function confirmOpenSecondSlide() {
    if (!overflowDialog) return;
    const current = perCampaignMetrics.get(overflowDialog.normalized) ?? [];
    setPerCampaignMetrics((prev) => new Map(prev).set(overflowDialog.normalized, [...current, overflowDialog.metric]));
    setPerCampaignMinWarning(null);
    setOverflowDialog(null);
  }

  function replaceCampaignMetric(removeKey: string) {
    if (!overflowDialog) return;
    const current = perCampaignMetrics.get(overflowDialog.normalized) ?? [];
    setPerCampaignMetrics((prev) =>
      new Map(prev).set(
        overflowDialog.normalized,
        current.filter((m) => m.key !== removeKey).concat(overflowDialog.metric),
      ),
    );
    setPerCampaignMinWarning(null);
    setOverflowDialog(null);
  }

  /** Sent to the preview/generate APIs as the account-wide "wizard is driving metric selection at all" signal and the padding candidate pool's own baseline (report-data.ts's redistributeCardSlots) — the union of every selected campaign's own current metrics, deduped by key. Each campaign's OWN exact list is what actually reaches its slide, via currentCampaignMetricOverridesPayload below; this union only ever matters as a fallback padding source. */
  function currentSelectedMetricsPayload(): SelectedMetric[] | undefined {
    if (perCampaignMetrics.size === 0) return undefined;
    const union = new Map<string, SelectedMetric>();
    for (const metrics of perCampaignMetrics.values()) {
      for (const m of metrics) union.set(m.key, m);
    }
    return union.size > 0 ? [...union.values()] : undefined;
  }

  /** Every selected campaign's own exact metric list, as a hard per-campaign override (report-data.ts's campaignMetricOverrides) — Thing 3: each campaign shows only its own objective-relevant metrics, never a shared/narrowed account-wide list. */
  function currentCampaignMetricOverridesPayload(): Record<string, string[]> | undefined {
    if (perCampaignMetrics.size === 0) return undefined;
    return Object.fromEntries([...perCampaignMetrics].map(([name, metrics]) => [name, metrics.map((m) => m.key)]));
  }

  /**
   * Objective-colored accent for each Metric Review campaign card — amber
   * for leads, coral for purchase/sales, green for reach/awareness, blue
   * for everything else (traffic/engagement). Drives both the card's own
   * top border and its header pill badge, so the two always match. Video
   * objectives keep their own purple accent (not one of the 4 categories
   * the redesign spec names, but a pre-existing distinction worth keeping
   * rather than folding into the generic blue "everything else" bucket).
   */
  function objectiveAccent(resultLabel: string | undefined): { badgeClassName: string; borderHex: string } {
    const label = (resultLabel ?? "").toUpperCase();
    if (label.includes("LEAD")) return { badgeClassName: "bg-amber-950/30 text-[#f6ad55]", borderHex: "#f6ad55" };
    if (label.includes("PURCHASE") || label.includes("SALE")) return { badgeClassName: "bg-red-950/30 text-[#fc8181]", borderHex: "#fc8181" };
    if (label.includes("REACH") || label.includes("IMPRESSION") || label.includes("RECALL") || label.includes("AWARENESS")) {
      return { badgeClassName: "bg-emerald-950/30 text-[#68d391]", borderHex: "#68d391" };
    }
    if (label.includes("VIDEO") || label.includes("THRUPLAY")) return { badgeClassName: "bg-purple-950/30 text-[#b794f4]", borderHex: "#b794f4" };
    return { badgeClassName: "bg-blue-950/30 text-[#63b3ed]", borderHex: "#63b3ed" };
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

    if (reportType === "CREATIVE" && !hasAdLevelCsv) {
      setPreviewStatus("invalid");
      setPreviewErrors([
        {
          field: "mtdDailyCsv",
          message: "Upload an Ad-level CSV (Ads tab in Meta Ads Manager) to generate a Creative report.",
        },
      ]);
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
        campaignMetricOverrides: currentCampaignMetricOverridesPayload(),
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

  // Google Ads has no Reporting Period section on Step 5 at all (see this
  // file's header) — dispatchAfterAnalyze already fetched its one-shot
  // preview directly, so this effect only ever runs for Meta. Re-fires
  // fetchPreview on every arrival at Step 5 and on every subsequent change
  // to the Reporting Period inputs while already there; applyPreviewResult
  // calls resetGenerateState() on each success, so editing dates after a
  // report was already generated naturally clears the stale download links
  // and brings the Generate button back — no separate "back to dates"
  // navigation needed.
  useEffect(() => {
    if (step !== 5 || platform !== "META") return;
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
        campaignMetricOverrides: currentCampaignMetricOverridesPayload(),
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
    setPublishedAt(null);
    setPdfAvailable(false);
    setGenerateStatus("done");
    persistGenerateSnapshot({
      reportId: json.reportId,
      downloadUrl: `/api/reports/${json.reportId}/download`,
      shareToken: json.shareToken ?? null,
    }, { publishedAt: null, pdfAvailable: false });
  }

  /** PreviousMonthSummaryOption's "Generate Previous Month Summary Report" button — see report-data.ts's buildPreviousMonthSummaryReportData and the generate route's own PREVIOUS_MONTH_SUMMARY branch. Sends the same (data-less) mtdFile the wizard already has in state purely because the route still expects an mtdDailyCsv field; none of its rows are actually used for this report. */
  async function handleGeneratePreviousMonthSummary() {
    if (!mtdFile) return;
    setPmsStatus("loading");
    setPmsError(null);

    const res = await fetch(`/api/clients/${clientId}/reports`, {
      method: "POST",
      body: buildUploadFormData(mtdFile, { platform, reportType: "PREVIOUS_MONTH_SUMMARY" }),
    });
    const json = await res.json().catch(() => null);

    if (!res.ok || !json?.ok) {
      setPmsStatus("error");
      setPmsError(json?.error || "Report generation failed. Please try again.");
      return;
    }

    setPmsResult({
      reportId: json.reportId,
      downloadUrl: `/api/reports/${json.reportId}/download`,
      shareToken: json.shareToken ?? null,
    });
    setPmsStatus("done");
  }

  function handleCancelPreviousMonthSummary() {
    setPmsStatus("idle");
    setPmsError(null);
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
    const nextFolder = { id: folderId, name: json.folderName };
    setRememberedFolder(nextFolder);
    setDriveFolderLinkInput("");
    setDriveFolderNameInput("");
    setDriveSaving(false);
    setDriveView("success");
    if (downloadUrl) {
      persistGenerateSnapshot(
        { reportId, downloadUrl, shareToken },
        { driveView: "success", driveSaveUrl: json.url, rememberedFolder: nextFolder },
      );
    }
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


  /** B3's "Generate Another Report for [Client Name]" — a full reset back to Step 1 for the same client, without leaving the wizard (no trip through My Clients). */
  function handleGenerateAnother() {
    setSelectedPlatformCard("META");
    try {
      const stored = localStorage.getItem(LAST_PLATFORM_STORAGE_KEY);
      if (stored === "META" || stored === "GOOGLE") setSelectedPlatformCard(stored);
    } catch {
      /* private mode */
    }
    setMtdFile(null);
    setAnalyzeStatus("idle");
    setAnalyzeErrors([]);
    setAnalyzeMessage(null);
    setMismatchWarning(false);
    setDetectedPlatform(null);
    setPlatform("META");

    setCampaigns([]);
    setSelectedCampaigns(new Set());
    setCampaignSearch("");
    setExpandedCsvExtras(new Set());
    setAdSetGroups([]);
    setSelectedAdSets(new Set());
    setExpandedCampaigns(new Set());

    setCampaignObjectives(new Map());
    setTouchedObjectiveCampaigns(new Set());

    setPerCampaignMetrics(new Map());
    setPerCampaignAvailablePool(new Map());
    setMetricsStatus("idle");
    setPerCampaignMinWarning(null);
    setCampaignRequiresConfirmation(new Map());

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
    clearWizardGenerateSnapshot(clientId);
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
  function reportTypeLabel(): string {
    if (previewKind === "comparison") return "Comparison Report";
    if (reportType === "MONTHLY") return "Monthly Report";
    if (reportType === "DAILY") return "Daily Report";
    if (reportType === "CREATIVE") return "Creative Report";
    return "Weekly Report";
  }

  /** Summary card label for the weekly/custom date line — avoids calling a 10-day custom pick a "week". */
  function weeklyPeriodSummaryLabel(): string {
    if (dateMode === "custom") {
      const days = customSpanDays();
      if (days !== null && days !== 7) return `Report period (${days} day${days === 1 ? "" : "s"})`;
      return "Report period";
    }
    return "Week period";
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

  /** Report Summary card's "Estimated slides" line: cover (1) + one slide per campaign + one slide per selected ad set + the MTD chart (1) + the combined-total table (1) + the metric guide (1) — matches the actual slide types the PPTX generator emits for a normal (non-comparison) report. Comparison reports have their own different slide shape (no ad set/chart/table/guide slides), so this only counts the cover + one slide per compared campaign there. */
  function estimatedSlideCount(): number {
    if (previewKind === "comparison") return 1 + summaryCampaignNames().length;
    return 1 + summaryCampaignNames().length + selectedAdSets.size + 1 + 1 + 1;
  }

  /** B3's friendly Drive link label, shown in place of the raw URL. */
  function driveDisplayLabel(): string {
    const range = driveDateRangeLabel();
    return `📊 ${clientName} — ${reportTypeLabel()}${range ? " " + range : ""}`;
  }

  if (resumeBootstrapping) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="mb-1 text-[20px] font-bold text-white">Choose report type and generate</h1>
          <p className="text-[13px] text-dash-ink-secondary">Loading your report…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-1 text-[20px] font-bold text-white">{STEP_HEADINGS[step]}</h1>
        <p className="text-[13px] text-dash-ink-secondary">{STEP_SUBTITLES[step]}</p>
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
              onSelect={() => choosePlatform("META")}
            />
            <ReportTypeCard
              icon={<GoogleAdsIcon />}
              heading="Google Ads"
              description="Upload your Google Ads CSV export"
              selected={selectedPlatformCard === "GOOGLE"}
              onSelect={() => choosePlatform("GOOGLE")}
            />
          </div>

          {selectedPlatformCard && (
            <div className="space-y-3">
              <UploadDropzone file={mtdFile} onFileSelected={setMtdFile} />
              <p className="rounded-lg border border-[#f6ad55]/40 bg-[#1e293b] px-4 py-3.5 text-[14px] leading-relaxed text-dash-ink">
                <span className="mb-1 block text-[15px] font-semibold text-[#f6ad55]">How to download your CSV</span>
                {selectedPlatformCard === "META" ? (
                  <>
                    {getMetaCsvDownloadTip()}{" "}
                    For month-over-month comparison,{" "}
                    <Link
                      href={`/clients/${clientId}#previous-month-data`}
                      className="font-medium text-dash-accent hover:underline"
                    >
                      upload Previous Month Data in client settings →
                    </Link>{" "}
                  </>
                ) : (
                  "Set date range to Last 30 days and segment by Day."
                )}
              </p>

              <button
                onClick={handleAnalyze}
                disabled={!mtdFile || analyzeStatus === "loading"}
                className="h-12 w-full rounded-md bg-dash-accent text-[15px] font-semibold text-dash-ink hover:bg-dash-accent-hover disabled:opacity-40"
              >
                {analyzeStatus === "loading" ? "Analyzing…" : "Analyze CSV"}
              </button>
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
              {analyzeErrors.filter(isNoDataRowsError).map((e, i) =>
                hasPreviousMonthData ? (
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
          {csvDateGuidance && csvDateGuidance.warnings.length > 0 && !csvWarningDismissed ? (
            <CsvDateGuidanceBanner
              guidance={csvDateGuidance}
              onContinue={() => setCsvWarningDismissed(true)}
              onRedownload={() => {
                setCsvWarningDismissed(false);
                setCsvDateGuidance(null);
                setMtdFile(null);
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
              <span className="text-[13px] text-dash-ink-secondary">
                {selectedCampaigns.size} of {campaigns.length} campaigns selected
              </span>
            </label>
            {campaigns.length > 8 && (
              <input
                type="search"
                value={campaignSearch}
                onChange={(e) => setCampaignSearch(e.target.value)}
                placeholder="Search campaigns"
                className="w-full max-w-xs rounded-md border border-dash-border bg-dash-bg px-3 py-1.5 text-[13px] text-dash-ink outline-none focus:border-dash-accent sm:w-56"
              />
            )}
          </div>

          {lowSpendCampaigns.length > 0 && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[12px] text-dash-ink">
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
                  <li className="px-4 py-3 text-[13px] text-dash-ink-secondary">
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
                    <label htmlFor={`campaign-${name}`} className="min-w-0 flex-1 cursor-pointer truncate text-[13px] text-dash-ink" title={name}>
                      {name}
                    </label>
                    {lowSpend ? (
                      <span className="shrink-0 text-[11px] font-semibold tabular-nums text-amber-400">
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
                          <p className="text-[12px] text-dash-ink-secondary">
                            {selectedCount} of {group.adSetNames.length} ad sets selected
                          </p>
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
                        <p className="text-[12px] text-dash-ink-secondary">
                          Uncheck any ad sets you do not want as separate slides in your report.
                        </p>
                        {allAdSetsDeselected && (
                          <p className="text-[12px] text-amber-300">No ad set slides will be generated for this campaign.</p>
                        )}
                      </div>
                    );
                  })()}

                  {isSelected && group && isSingleAdSet && isExpanded && (
                    <div className="mt-3 rounded-md border border-dash-border bg-dash-bg p-3">
                      <p className="mb-2 truncate text-[12px] font-medium text-dash-ink" title={group.adSetNames[0]}>
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
                        <span className="text-[12px] text-dash-ink-secondary">Include ad set slide within this campaign</span>
                      </label>
                    </div>
                  )}
                </li>
              );
              });
            })()}
          </ul>

          <p className="text-[13px] text-dash-ink-secondary">
            A single-ad-set slide repeats the campaign slide — turn it on only if you want both.
          </p>

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
          {(() => {
            const shownCampaigns = campaigns.filter((name) => selectedCampaigns.has(name));
            const confidenceTiers = shownCampaigns.map((name) => campaignObjectiveConfidence.get(normalizeCampaignName(name)));
            const allConfirmed = shownCampaigns.length > 0 && confidenceTiers.every((t) => t === "cached");
            return (
              allConfirmed && (
                <div className="rounded-md border border-[#f6ad55]/40 bg-amber-950/20 px-3 py-2 text-[13px] text-amber-200">
                  All objectives confirmed from your previous report. Review or click Continue.
                </div>
              )
            );
          })()}

          {/* Thing 2 — campaigns still blocking Continue: requiresConfirmation is true AND the user hasn't picked a value yet. */}
          {(() => {
            const blockingCount = campaigns.filter((name) => {
              const normalized = normalizeCampaignName(name);
              return (
                selectedCampaigns.has(name) &&
                campaignRequiresConfirmation.get(normalized) === true &&
                !touchedObjectiveCampaigns.has(normalized)
              );
            }).length;
            return (
              blockingCount > 0 && (
                <div className="rounded-md border border-[#fc8181]/40 bg-red-950/20 px-3 py-2 text-[13px] text-[#fc8181]">
                  {blockingCount === 1
                    ? "1 campaign's objective could not be reliably detected — pick a value from its dropdown to continue."
                    : `${blockingCount} campaigns' objectives could not be reliably detected — pick a value from each dropdown to continue.`}
                </div>
              )
            );
          })()}

          <ul className="divide-y divide-dash-border rounded-lg border border-dash-border">
            {campaigns
              .filter((name) => selectedCampaigns.has(name))
              .map((name) => {
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
                const tier = campaignObjectiveConfidence.get(normalized);
                const badge = objectiveConfidenceBadge(tier);
                const isBlocking =
                  campaignRequiresConfirmation.get(normalized) === true && !touchedObjectiveCampaigns.has(normalized);
                return (
                  <li key={name} className={`px-4 py-3 ${isBlocking ? "border-2 border-[#fc8181] bg-red-950/10" : ""}`}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-[13px] text-white" title={name}>
                        {name}
                      </span>
                      <select
                        value={currentKey}
                        onChange={(e) => setCampaignObjective(name, e.target.value)}
                        className={`rounded-md border px-3 py-1.5 text-[13px] text-dash-ink outline-none focus:border-[#f6ad55] ${
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
                        <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold ${badge.className}`}>
                          <span aria-hidden="true">{badge.icon}</span>
                          <span>{badge.text}</span>
                        </span>
                      </div>
                    )}
                    {badge && !badge.pill && (
                      <div className={`mt-1 flex items-center justify-end gap-1 text-[11px] font-medium ${badge.className}`}>
                        <span aria-hidden="true">{badge.icon}</span>
                        <span>{badge.text}</span>
                      </div>
                    )}
                  </li>
                );
              })}
          </ul>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(2)}
              className="rounded-md border border-dash-border px-4 py-2 text-[13px] font-medium text-dash-ink hover:bg-dash-border"
            >
              Back
            </button>
            <button
              onClick={handleObjectivesContinue}
              disabled={campaigns.some((name) => {
                const normalized = normalizeCampaignName(name);
                return (
                  selectedCampaigns.has(name) &&
                  campaignRequiresConfirmation.get(normalized) === true &&
                  !touchedObjectiveCampaigns.has(normalized)
                );
              })}
              className="rounded-md bg-dash-accent px-6 py-2 text-[13px] font-semibold text-dash-ink hover:bg-dash-accent-hover disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-dash-accent"
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4 rounded-lg border border-dash-border bg-dash-card p-5">
          {metricsStatus === "error" && (
            <div className="rounded-md border border-amber-900 bg-amber-950/30 p-3 text-[13px] text-amber-200">
              Couldn&apos;t load the full metric list — continuing with the engine&apos;s automatic selection.
            </div>
          )}

          <div>
            {campaigns
              .filter((name) => selectedCampaigns.has(name))
              .map((name) => {
                const normalized = normalizeCampaignName(name);
                const objective = campaignObjectives.get(normalized);
                const selectedForCampaign = perCampaignMetrics.get(normalized) ?? [];
                const availableForCampaign = campaignAvailableMetrics(normalized);
                const accent = objectiveAccent(objective?.resultLabel);
                return (
                  <div
                    key={name}
                    className="mb-4 rounded-lg bg-[#1e293b] p-4 last:mb-0"
                    style={{ borderTop: `3px solid ${accent.borderHex}` }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="truncate text-[15px] font-bold text-white" title={name}>
                        {name}
                      </span>
                      {objective && (
                        <span
                          className={`flex-shrink-0 rounded-[20px] text-[11px] font-medium uppercase ${accent.badgeClassName}`}
                          style={{ padding: "6px 10px" }}
                        >
                          {objective.resultLabel}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[12px] text-dash-ink-secondary">
                      {selectedForCampaign.length <= MAX_METRICS_PER_SLIDE
                        ? `${selectedForCampaign.length} of ${MAX_METRICS_PER_SLIDE} chips on this campaign slide`
                        : `${selectedForCampaign.length} chips · first ${MAX_METRICS_PER_SLIDE} on slide 1, ${selectedForCampaign.length - MAX_METRICS_PER_SLIDE} on a continuation slide`}
                    </p>

                    <p className="mt-3 text-[11px] font-medium uppercase tracking-wide text-dash-ink-secondary">
                      Included metrics
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {selectedForCampaign.map((m) => (
                        <span
                          key={m.key}
                          className="flex items-center gap-2 rounded-md border border-[#334155] bg-[#111f35]"
                          style={{ padding: "8px 12px" }}
                        >
                          <span className="text-[12px] uppercase text-white" style={{ letterSpacing: "0.5px" }}>
                            {m.label}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeCampaignMetric(normalized, m.key)}
                            aria-label={`Remove ${m.label} from ${name}`}
                            className="text-[#64748b] hover:text-[#fc8181]"
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>

                    {perCampaignMinWarning && (
                      <p className="mt-2 text-[13px] text-amber-300">{perCampaignMinWarning}</p>
                    )}

                    <div className="my-3 border-t border-[#334155]" />
                    <p className="text-[11px] font-medium uppercase tracking-wide text-dash-ink-secondary">
                      Add from your CSV
                    </p>
                    <p className="mt-0.5 text-[12px] text-dash-ink-secondary">
                      Columns in this file that are not already chips.
                    </p>
                    {availableForCampaign.length === 0 ? (
                      <p className="mt-1.5 text-[12px] text-dash-ink-secondary">No extra columns in this export.</p>
                    ) : (
                      <>
                        <div className="mt-1.5 flex flex-wrap gap-2">
                          {(expandedCsvExtras.has(normalized)
                            ? availableForCampaign
                            : availableForCampaign.slice(0, ADD_FROM_CSV_VISIBLE)
                          ).map((candidate) => (
                            <button
                              key={candidate.key}
                              type="button"
                              onClick={() => addCampaignMetric(normalized, candidate, name)}
                              className="rounded-md border border-[#1e3a5f] bg-transparent text-[12px] text-dash-ink-secondary hover:border-dash-ink-secondary hover:text-dash-ink"
                              style={{ padding: "8px 12px" }}
                            >
                              <span className="text-[#68d391]">+</span> {candidate.label}
                            </button>
                          ))}
                        </div>
                        {availableForCampaign.length > ADD_FROM_CSV_VISIBLE && !expandedCsvExtras.has(normalized) && (
                          <button
                            type="button"
                            onClick={() => setExpandedCsvExtras((prev) => new Set(prev).add(normalized))}
                            className="mt-2 text-[12px] text-dash-accent hover:underline"
                          >
                            Show {availableForCampaign.length - ADD_FROM_CSV_VISIBLE} more
                          </button>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(3)}
              className="rounded-md border border-dash-border px-4 py-2 text-[13px] font-medium text-dash-ink hover:bg-dash-border"
            >
              Back
            </button>
            <button
              onClick={handleMetricsContinue}
              disabled={[...perCampaignMetrics.values()].some(
                (metrics) => metrics.length > 0 && metrics.length < MIN_SELECTED_METRICS,
              )}
              className="rounded-md bg-dash-accent px-6 py-2 text-[13px] font-semibold text-dash-ink hover:bg-dash-accent-hover disabled:opacity-50"
            >
              Continue to dates
            </button>
          </div>

          {overflowDialog && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
              <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-dash-border bg-dash-card p-5">
                {overflowDialog.mode === "blocked_max" && (
                  <>
                    <p className="text-[15px] font-semibold text-dash-ink">Maximum {MAX_TOTAL_METRICS} metrics (2 slides)</p>
                    <p className="mt-2 text-[13px] text-dash-ink-secondary">
                      Remove a chip before adding {overflowDialog.metric.label}.
                    </p>
                  </>
                )}
                {overflowDialog.mode === "confirm_second_slide" && (
                  <>
                    <p className="text-[15px] font-semibold text-dash-ink">This extra opens a second slide</p>
                    <p className="mt-2 text-[13px] text-dash-ink-secondary">
                      {(() => {
                        const current = perCampaignMetrics.get(overflowDialog.normalized) ?? [];
                        const objective = campaignObjectives.get(overflowDialog.normalized);
                        const fillers = findPrimaryResultCostPair(
                          current.slice(0, MAX_METRICS_PER_SLIDE),
                          objective?.resultLabel,
                          objective?.costLabel,
                        );
                        const remainingAfter = Math.max(0, campaignAvailableMetrics(overflowDialog.normalized).length - 1);
                        const fillText =
                          fillers.length > 0 ? joinMetricLabels(fillers) : "this campaign's result and cost-per-result";
                        return (
                          <>
                            Slide 1 will keep the first {MAX_METRICS_PER_SLIDE} chips. Adding{" "}
                            {overflowDialog.metric.label} would leave the continuation looking empty, so we will also
                            repeat {fillText}
                            {" "}on that slide — at least 3 cards (your extra plus this campaign&apos;s result and cost).
                            {remainingAfter > 0
                              ? " Add more extras from your CSV after this if you want those on the second slide too."
                              : ""}{" "}
                            Or replace a chip below to keep everything on one slide.
                          </>
                        );
                      })()}
                    </p>
                  </>
                )}

                {overflowDialog.mode === "confirm_second_slide" && (
                  <div className="mt-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-dash-ink-secondary">
                      Optional — replace one of the current {MAX_METRICS_PER_SLIDE} instead
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {(perCampaignMetrics.get(overflowDialog.normalized) ?? []).slice(0, MAX_METRICS_PER_SLIDE).map((m) => (
                        <button
                          key={m.key}
                          type="button"
                          onClick={() => replaceCampaignMetric(m.key)}
                          className="rounded-md border border-dash-border px-3 py-1.5 text-[12px] text-dash-ink hover:border-dash-accent"
                        >
                          Replace {m.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {overflowDialog.mode === "confirm_second_slide" && (
                    <button
                      type="button"
                      onClick={confirmOpenSecondSlide}
                      className="rounded-md bg-dash-accent px-4 py-2 text-[13px] font-semibold text-dash-ink hover:bg-dash-accent-hover"
                    >
                      Add anyway
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setOverflowDialog(null)}
                    className="rounded-md border border-dash-border px-4 py-2 text-[13px] text-dash-ink-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {step === 5 && (
        <div className="space-y-6">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(platform === "GOOGLE" ? 1 : 4)}
              className="rounded-md border border-dash-border px-4 py-2 text-[13px] font-medium text-dash-ink hover:bg-dash-border"
            >
              Back
            </button>
          </div>
          {platform === "META" && (
            <div className="space-y-5">
              <section className="rounded-lg border border-dash-border border-l-4 border-l-[#f6ad55] bg-dash-card p-5">
            <h4 className="text-[15px] font-semibold text-white">Report Type</h4>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <ReportTypeCard
                icon="📊"
                heading="Weekly Performance Report"
                description="One reporting period (usually 7 days) plus month-to-date context"
                selected={reportType === "WEEKLY"}
                onSelect={() => handleReportTypeChange("WEEKLY")}
              />
              <ReportTypeCard
                icon="☀️"
                heading="Daily Performance Report"
                description="Yesterday's performance — ideal for daily client updates"
                selected={reportType === "DAILY"}
                onSelect={() => handleReportTypeChange("DAILY")}
              />
              <ReportTypeCard
                icon="📅"
                heading="Monthly Performance Report"
                description="Shows full month performance using your complete MTD data"
                selected={reportType === "MONTHLY"}
                onSelect={() => handleReportTypeChange("MONTHLY")}
              />
              <ReportTypeCard
                icon="🎨"
                heading="Creative Performance Report"
                description={
                  hasAdLevelCsv
                    ? "Ad-level winners, video metrics, and fatigue alerts (last 30 days)"
                    : "Requires Ad-level CSV with Ad Name column — see Download Guide"
                }
                selected={reportType === "CREATIVE"}
                onSelect={() => handleReportTypeChange("CREATIVE")}
                disabled={!hasAdLevelCsv}
              />
              <ReportTypeCard
                icon="🔀"
                heading="Comparison Report"
                description="Compares two custom periods side by side, campaign by campaign"
                selected={reportType === "COMPARISON"}
                onSelect={() => handleReportTypeChange("COMPARISON")}
              />
            </div>
            {hasAdLevelCsv && reportType !== "CREATIVE" && (
              <p className="mt-4 rounded-md border border-emerald-800/60 bg-emerald-950/30 px-3 py-2 text-[13px] text-emerald-200">
                Ad-level data detected — creative overview slides will be included in this report automatically.
              </p>
            )}
            {reportType === "MONTHLY" && (
              <p className="mt-4 text-[13px] text-dash-ink-secondary">Uses the full month in your CSV — no date picker needed.</p>
            )}
            {reportType === "CREATIVE" && hasAdLevelCsv && (
              <p className="mt-4 text-[13px] text-dash-ink-secondary">
                Uses ad-level data from the last 30 days in your CSV — no date picker needed.
              </p>
            )}
            {reportType === "DAILY" && dailyRange && (
              <p className="mt-4 text-[13px] text-dash-ink-secondary">
                Reports on <span className="text-white">{formatIsoRange(dailyRange)}</span> (latest complete day in your CSV).
              </p>
            )}
          </section>

          {/* Section 2 — Date range (Weekly only) */}
          {reportType === "WEEKLY" && (
            <section className="rounded-lg border border-dash-border bg-dash-card p-5">
              <h4 className="text-[16px] font-semibold text-white">Select report period</h4>
              <p className="mt-2 text-[13px] text-dash-ink-secondary">
                Weekly reports compare one reporting window against month-to-date. Pick a 7-day shortcut or choose any
                custom start and end dates within your CSV (up to 30 days).
              </p>

              <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-dash-ink-secondary">Quick picks · 7 days</p>
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
              </div>

              <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-dash-ink-secondary">Custom dates</p>
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
                  <p className="text-[13px] text-dash-ink-secondary">
                    Choose any consecutive dates from your upload — not limited to 7 days, but shorter ranges work best
                    for weekly-style reports.
                  </p>
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
                        You selected {spanDays} days. Weekly reports read best at 7 days or less — continue with this
                        longer period anyway?
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
                  {previewErrors.filter(isNoDataRowsError).map((e, i) =>
                    hasPreviousMonthData ? (
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
                <h3 className="text-[15px] font-semibold text-white">Report Summary</h3>
                <hr className="my-3 border-t border-[#334155]" />
                <div className="space-y-2">
                  <p className="text-[13px] text-[#94a3b8]">
                    Report type: <span className="text-[13px] text-white">{reportTypeLabel()}</span>
                  </p>
                  <p className="text-[13px] text-[#94a3b8]">
                    Client: <span className="text-[13px] text-white">{clientName}</span>
                  </p>
                  <div>
                    <p className="text-[13px] text-[#94a3b8]">
                      Campaigns:{" "}
                      <span className="text-[13px] text-white">{summaryCampaignNames().length} selected</span>
                    </p>
                    <ul className="mt-1 space-y-0.5 pl-4">
                      {summaryCampaignNames().map((name) => (
                        <li key={name} className="truncate text-[12px] text-[#64748b]" title={name}>
                          {name}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {previewKind === "comparison" && comparisonData ? (
                    <p className="text-[13px] text-[#94a3b8]">
                      Comparison periods:{" "}
                      <span className="text-[13px] text-white">
                        {comparisonData.periodALabel} vs {comparisonData.periodBLabel}
                      </span>
                    </p>
                  ) : (
                    <>
                      {reportType === "DAILY" && dailyRange && (
                        <p className="text-[13px] text-[#94a3b8]">
                          Daily period: <span className="text-[13px] text-white">{formatSummaryRange(dailyRange)}</span>
                        </p>
                      )}
                      {reportType === "WEEKLY" && weeklyRangeIso && (
                        <p className="text-[13px] text-[#94a3b8]">
                          {weeklyPeriodSummaryLabel()}:{" "}
                          <span className="text-[13px] text-white">{formatSummaryRange(weeklyRangeIso)}</span>
                        </p>
                      )}
                      {reportType === "MONTHLY" && mtdRange && (
                        <p className="text-[13px] text-[#94a3b8]">
                          Full month: <span className="text-[13px] text-white">{formatSummaryRange(mtdRange)}</span>
                        </p>
                      )}
                      {reportType === "CREATIVE" && mtdRange && (
                        <p className="text-[13px] text-[#94a3b8]">
                          Data window: <span className="text-[13px] text-white">{formatSummaryRange(mtdRange)}</span>
                        </p>
                      )}
                      {reportType === "WEEKLY" && mtdRange && (
                        <p className="text-[13px] text-[#94a3b8]">
                          Month to date: <span className="text-[13px] text-white">{formatSummaryRange(mtdRange)}</span>
                        </p>
                      )}
                    </>
                  )}
                  <p className="text-[13px] text-[#94a3b8]">
                    Template: <span className="text-[13px] text-white">{clientTemplate === "LIGHT" ? "Light" : "Dark"}</span>
                  </p>
                  <p className="text-[13px] text-[#94a3b8]">
                    Platform: <span className="text-[13px] text-white">{platform === "GOOGLE" ? "Google Ads" : "Meta Ads"}</span>
                  </p>
                  <p className="text-[13px] text-[#94a3b8]">
                    Estimated slides: <span className="text-[13px] text-white">{estimatedSlideCount()}</span>
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
                  Add custom PPT report title +
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
                  className="h-12 w-full rounded-md bg-dash-accent text-[16px] font-semibold text-dash-ink hover:bg-dash-accent-hover"
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
            <div className="overflow-hidden rounded-xl border border-dash-border bg-[#111f35]">
              <div className="border-b border-dash-border px-5 py-4">
                <p className="text-[16px] font-semibold text-[#68d391]">Report ready</p>
                <p className="mt-1 text-[13px] text-dash-ink-secondary">
                  Share the live link with your client or download files below.
                </p>
              </div>

              <div className="space-y-5 p-5">
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
                      <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-[#94a3b8]">
                        {buildShareReportUrl(shareToken)}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyShareLink}
                        className="shrink-0 rounded-md px-2.5 py-1 text-[12px] font-medium text-dash-accent hover:bg-dash-border"
                      >
                        Copy
                      </button>
                    </div>
                  </>
                ) : null}

                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-dash-ink-secondary">Downloads</p>
                  <div className={`grid gap-2 ${hasGoogleDriveConnected ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2"}`}>
                    <a
                      href={downloadUrl}
                      className="flex items-center justify-center rounded-lg border border-[#f5b45a]/50 bg-[#0d1b2e] px-3 py-3 text-[13px] font-medium text-white hover:border-[#f5b45a]"
                    >
                      PPTX
                    </a>
                    {shareToken && reportId ? (
                      publishedAt ? (
                        <a
                          href={`/api/reports/${reportId}/download-pdf`}
                          className="flex items-center justify-center rounded-lg border border-[#63b3ed]/50 bg-[#0d1b2e] px-3 py-3 text-[13px] font-medium text-white hover:border-[#63b3ed]"
                        >
                          PDF
                        </a>
                      ) : (
                        <button
                          type="button"
                          disabled
                          title="Review and publish your report to enable PDF download"
                          className="flex cursor-not-allowed items-center justify-center rounded-lg border border-dash-border bg-[#0d1b2e] px-3 py-3 text-[13px] font-medium text-dash-ink-secondary opacity-60"
                        >
                          PDF
                        </button>
                      )
                    ) : null}
                    {hasGoogleDriveConnected && (driveView === "collapsed" || driveView === "success") ? (
                      <button
                        type="button"
                        onClick={handleSaveButtonClick}
                        disabled={driveSaving}
                        className="flex items-center justify-center rounded-lg border border-[#68d391]/50 bg-[#0d1b2e] px-3 py-3 text-[13px] font-medium text-white hover:border-[#68d391] disabled:opacity-50"
                      >
                        {driveSaving ? "Saving…" : driveSaveUrl ? "Drive (update)" : "Google Drive"}
                      </button>
                    ) : null}
                  </div>
                  {shareToken && reportId && !publishedAt ? (
                    <p className="mt-2 text-[12px] text-dash-ink-secondary">
                      PDF unlocks after you review and publish.
                    </p>
                  ) : null}
                  {hasGoogleDriveConnected && rememberedFolder && (driveView === "collapsed" || driveView === "success") ? (
                    <p className="mt-2 text-[12px] text-dash-ink-secondary">
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

                {shareToken && reportId ? (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-dash-border bg-[#0d1b2e] px-4 py-3">
                    <p className="text-[13px] leading-snug text-dash-ink">
                      Edit report copy or hide slides for the browser link, PPTX, and PDF
                    </p>
                    <Link
                      href={`/clients/${clientId}/reports/${reportId}/copy?from=generate`}
                      className="shrink-0 text-[13px] font-semibold text-dash-accent hover:underline"
                      onClick={() => {
                        if (reportId && downloadUrl) {
                          persistGenerateSnapshot({ reportId, downloadUrl, shareToken });
                        }
                      }}
                    >
                      Review →
                    </Link>
                  </div>
                ) : null}

                {shareToken ? (
                  <details className="group rounded-lg border border-dash-border bg-[#0d1b2e]">
                    <summary className="cursor-pointer list-none px-4 py-3 text-[13px] font-medium text-dash-ink marker:content-none [&::-webkit-details-marker]:hidden">
                      <span className="flex items-center justify-between gap-2">
                        Share with client
                        <span className="text-[15px] leading-none text-dash-ink-secondary transition-transform group-open:rotate-180">▾</span>
                      </span>
                    </summary>
                    <div className="border-t border-dash-border px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <a
                          href={buildMailtoShareUrl(`https://${buildShareReportUrl(shareToken)}`, clientName)}
                          className="inline-flex items-center gap-1.5 rounded-md border border-dash-border px-3 py-2 text-[12px] text-dash-ink hover:bg-dash-border"
                        >
                          <MailIcon />
                          Email
                        </a>
                        <a
                          href={buildWhatsAppShareUrl(`https://${buildShareReportUrl(shareToken)}`)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-md border border-dash-border px-3 py-2 text-[12px] text-dash-ink hover:bg-dash-border"
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
                          className="inline-flex items-center gap-1.5 rounded-md border border-dash-border px-3 py-2 text-[12px] text-dash-ink hover:bg-dash-border"
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
                          className="inline-flex items-center gap-1.5 rounded-md border border-dash-border px-3 py-2 text-[12px] text-dash-ink hover:bg-dash-border"
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
                            className="inline-flex items-center gap-1.5 rounded-md border border-dash-border px-3 py-2 text-[12px] text-dash-ink hover:bg-dash-border"
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

              {/* State 3: button/input are both gone, replaced by the saved-file
                  link. The share link + Email/WhatsApp/Copy Link row now live
                  in the tertiary actions above (Fix 4) — no longer duplicated
                  here. */}
              {driveView === "success" && driveSaveUrl && (
                <div className="rounded-lg border border-emerald-800 bg-emerald-950/30 p-4">
                  <p className="mb-2 text-[13px] uppercase tracking-wide text-emerald-300">
                    Saved to Google Drive ✓
                  </p>
                  <a
                    href={driveSaveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block break-all text-[13px] text-dash-accent hover:underline"
                  >
                    {driveDisplayLabel()}
                  </a>
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
                  <p className="font-semibold">Missing previous month comparison</p>
                  <p className="mt-1 text-dash-ink-secondary">
                    Your Monthly Campaign Performance Overview slide does not have a previous month row.{" "}
                    <Link href={`/clients/${clientId}`} className="text-dash-accent hover:underline">
                      Upload previous month data in Client Settings
                    </Link>{" "}
                    to enable it.
                  </p>
                </div>
              )}

              <div className="border-t border-dash-border pt-4">
                <button
                  type="button"
                  onClick={handleGenerateAnother}
                  className="w-full text-center text-[13px] font-medium text-[#63b3ed] hover:underline"
                >
                  Generate another report for {clientName}
                </button>
              </div>
              </div>
            </div>
          )}
            </>
          )}
        </div>
      )}

    </div>
  );
}

/**
 * `visitedSteps` (not just "s < step") decides whether a step is completed
 * and clickable — the Google Ads flow jumps straight from step 1 to step 5
 * (dispatchAfterAnalyze), so steps 2-4 are numerically "less than" step 5
 * without ever having been shown; those must stay muted/unclickable rather
 * than falsely offering navigation into a step that was never populated.
 * Clicking a completed step just calls onNavigate(s) — a plain setStep,
 * identical to the wizard's existing per-screen "Back" buttons — so all
 * state (upload, campaigns, objectives, metrics, dates) is preserved automatically:
 * nothing here clears or resets any of it.
 */
function CsvDateGuidanceBanner({
  guidance,
  onContinue,
  onRedownload,
}: {
  guidance: CsvDateGuidance;
  onContinue: () => void;
  onRedownload: () => void;
}) {
  const warning = guidance.warnings[0];
  if (!warning) return null;

  return (
    <div className="space-y-3 rounded-lg border border-[#f6ad55]/50 border-l-4 border-l-[#f6ad55] bg-[#1e293b] p-4">
      <div className="space-y-1.5">
        <p className="text-[15px] font-semibold leading-snug text-white">{warning.title}</p>
        <p className="text-[14px] leading-relaxed text-[#e2e8f0]">{warning.message}</p>
      </div>
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={onContinue}
          className="rounded-md bg-dash-accent px-4 py-2 text-[13px] font-semibold text-dash-ink hover:bg-dash-accent-hover"
        >
          Continue anyway →
        </button>
        <button
          type="button"
          onClick={onRedownload}
          className="rounded-md border border-dash-border px-4 py-2 text-[13px] font-medium text-dash-ink hover:bg-dash-border"
        >
          I&apos;ll re-download
        </button>
      </div>
    </div>
  );
}

function StepIndicator({
  step,
  visitedSteps,
  onNavigate,
}: {
  step: Step;
  visitedSteps: Set<Step>;
  onNavigate: (s: Step) => void;
}) {
  const steps: Step[] = [1, 2, 3, 4, 5];
  return (
    <div className="flex flex-wrap items-center gap-2 text-[12px]">
      {steps.map((s, i) => {
        const isCompleted = s < step && visitedSteps.has(s);
        return (
          <div key={s} className="flex items-center gap-2">
            {isCompleted ? (
              <button
                type="button"
                onClick={() => onNavigate(s)}
                className="flex items-center gap-1.5 rounded-full px-3 py-1 font-medium text-dash-ink-secondary hover:text-white"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-[#68d391]" aria-hidden="true" />
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

/** Small mail glyph for the download screen's tertiary Email button, colored blue per the design spec. */
function MailIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="#63b3ed" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}

/** Small copy-to-clipboard glyph for the download screen's tertiary Copy Link button, colored grey per the design spec. */
function CopyIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" aria-hidden="true">
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
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

/**
 * Replaces NoDataRowsWarning entirely (not shown alongside it) whenever the
 * client has Previous Month Data on file — see handleAnalyze/fetchPreview's
 * own noCampaignData/hasPreviousMonthData checks at each call site. Offers
 * a Previous Month Summary report (cover + Combined Total table's own
 * Previous Month row + Metric Guide only, no campaign/ad-set/chart slides —
 * see report-data.ts's buildPreviousMonthSummaryReportData) as an
 * alternative to blocking report generation outright.
 */
function PreviousMonthSummaryOption({
  status,
  error,
  result,
  onGenerate,
  onCancel,
}: {
  status: "idle" | "loading" | "done" | "error";
  error: string | null;
  result: { downloadUrl: string; shareToken: string | null } | null;
  onGenerate: () => void;
  onCancel: () => void;
}) {
  if (status === "done" && result) {
    return (
      <div className="space-y-3 rounded-lg border border-emerald-900 bg-emerald-950/30 p-4 text-[13px] text-emerald-200">
        <p className="font-medium text-emerald-100">Previous Month Summary report generated!</p>
        <div className="flex flex-wrap gap-3">
          <a
            href={result.downloadUrl}
            className="inline-block rounded-md bg-emerald-600 px-4 py-2 text-[13px] font-medium text-dash-ink hover:bg-emerald-500"
          >
            Download PPTX
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-amber-900 bg-amber-950/30 p-4 text-[13px] text-amber-200">
      <p>No active campaigns found in this date range. Your campaigns did not run during this period.</p>
      <p>
        However, we found previous month data for this client. You can still generate a report showing your previous
        month performance summary.
      </p>
      {status === "error" && error && <p className="text-red-300">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onGenerate}
          disabled={status === "loading"}
          className="rounded-md bg-dash-accent px-4 py-2 text-[13px] font-medium text-white hover:bg-dash-accent-hover disabled:opacity-60"
        >
          {status === "loading" ? "Generating…" : "Generate Previous Month Summary Report"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={status === "loading"}
          className="rounded-md border border-dash-border px-4 py-2 text-[13px] text-dash-ink-secondary hover:bg-dash-border disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
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
  disabled = false,
}: {
  icon: ReactNode;
  heading: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={`rounded-lg border p-4 text-left transition-colors ${
        disabled
          ? "cursor-not-allowed border-dash-border bg-dash-bg/50 opacity-60"
          : selected
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
