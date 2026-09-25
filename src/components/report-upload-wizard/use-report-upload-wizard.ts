"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  clearWizardGenerateSnapshot,
  loadWizardGenerateSnapshot,
  saveWizardGenerateSnapshot,
  type WizardGenerateSnapshot,
} from "@/lib/nre/wizard-generate-snapshot";
import { computeHistoricalMonthRanges } from "@/lib/nre/date-range";
import { extractDriveFolderIdFromLink } from "@/lib/drive-link";
import {
  evaluateAddMetric,
  filterAddableMetrics,
  MAX_METRICS_PER_SLIDE,
  MAX_TOTAL_METRICS,
  type SelectedMetric,
} from "@/lib/nre/available-metrics";
import {
  OBJECTIVE_DROPDOWN_OPTIONS,
  objectiveInfoForDetectedLabel,
} from "@/lib/nre/result-type-map";
import { normalizeCampaignName } from "@/lib/nre/objective";
import { buildCampaignMetricBundle } from "@/lib/nre/wizard-campaign-metrics";
import { LOW_SPEND_CAMPAIGN_THRESHOLD, isLowSpendCampaign } from "@/lib/nre/campaigns";
import { adSetKey } from "@/lib/nre/ad-sets";
import { getPreviousMonthComparisonInfo } from "@/lib/nre/previous-month-data-status";
import { useToast } from "@/components/toast";
import { budgetPacingWarning, buildBudgetCoverPreview } from "@/lib/nre/budget-pacing";
import { pollReportStatus, ReportGenerationPollError } from "@/lib/nre/poll-report-status";
import { usesFullAdWizard } from "@/lib/nre/platform-labels";
import {
  coerceLaunchPlatform,
  coerceLaunchReportType,
  isLaunchPlatformEnabled,
  isLaunchReportTypeEnabled,
} from "@/lib/meta-launch-scope";
import type { WizardDataSource } from "@/components/wizard-data-source-panel";
import type {
  AnalyzeStatus,
  ComparisonPreset,
  DateMode,
  DateRangeIso,
  DateSelection,
  DriveView,
  GenerateStatus,
  PreviewKind,
  PreviewStatus,
  RememberedDriveFolder,
  ReportTypeValue,
  ReportUploadWizardProps,
  Step,
  WizardPlatformChoice,
} from "./types";
import type { AdSetGroup } from "@/lib/nre/ad-sets";
import type { ObjectiveInfo } from "@/lib/nre/result-type-map";
import type { ValidationIssue } from "@/lib/nre/validate";
import type { ComparisonReportData, ReportData } from "@/lib/nre/report-data";
import type { HistoricalReportData } from "@/lib/nre/historical-report-data";
import type { DayBreakdownReportData } from "@/lib/nre/day-breakdown-report-data";
import type { CsvDateGuidance } from "@/lib/nre/csv-date-guidance";
import {
  ADD_FROM_CSV_VISIBLE,
  ADSET_CHIP_CLASS,
  DEFAULT_REPORT_TITLE,
  MIN_SELECTED_METRICS,
} from "./constants";
import { normalizeSavedDateSelection } from "./ui/normalize-date-selection";
import {
  buildShareReportUrl,
  buildUploadFormData,
  defaultReportTitleFor,
  formatIso,
  formatIsoRange,
  formatSummaryRange,
  isApiSyncArtifact,
} from "./utils";
import {
  readInitialPlatformPickerState,
  readStoredWizardPlatform,
  saveWizardPlatformChoice,
} from "./platform-storage";

export function useReportUploadWizard({
  clientId,
  clientName,
  clientTimezone,
  currencySymbol,
  hasGoogleDriveConnected,
  initialLastDriveFolderId,
  initialLastDriveFolderName,
  hasPreviousMonthData,
  initialPreviousMonthDataUpdatedAt,
  initialPreviousMonthCampaigns = [],
  initialPreviousMonthSelectedCampaigns = null,
  initialPreviousMonthCampaignSpend = {},
  clientTemplate,
  metaConnected = false,
  metaConnectedName = null,
  metaConfigured = false,
  googleAdsConfigured = false,
  googleAdsConnected = false,
  tiktokConfigured = false,
  tiktokConnected = false,
  hasGa4Property = false,
  ga4Connected = false,
  showTikTokOption = true,
  clientMonthlyBudget = null,
  clientShowBudgetPacingOnCover = false,
}: ReportUploadWizardProps) {
  const [wizardKind, setWizardKind] = useState<"ads" | "website">("ads");
  const [step, setStepState] = useState<Step>(1);
  // Which steps this session has actually passed through — the Google Ads
  // flow jumps straight from step 1 to step 6 (see dispatchAfterAnalyze),
  // so a plain "s < step" numeric check would wrongly offer steps 2-5 as
  // clickable/completed in the step indicator even though they were never
  // shown. Only grows (a step, once visited, stays "completed" even after
  // navigating back to it and forward again).
  const [visitedSteps, setVisitedSteps] = useState<Set<Step>>(new Set([1]));
  const stepRef = useRef<Step>(1);
  const [uploadSessionRecovery, setUploadSessionRecovery] = useState<string | null>(null);
  const [reanalyzeSessionStatus, setReanalyzeSessionStatus] = useState<"idle" | "loading">("idle");
  const [previewRefreshing, setPreviewRefreshing] = useState(false);
  const previewDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generateStatusRef = useRef<GenerateStatus>("idle");

  function invalidateDownstreamFromStep(target: Step) {
    if (target <= 3) {
      resetGenerateState();
      resetPreviewState();
    }
    if (target <= 2) {
      resetMetricsState();
    }
  }

  /** Every step transition in the wizard goes through this — records the step as visited alongside switching to it. */
  function setStep(s: Step) {
    const current = stepRef.current;
    if (s < current) invalidateDownstreamFromStep(s);
    stepRef.current = s;
    setStepState(s);
    setVisitedSteps((prev) => (prev.has(s) ? prev : new Set(prev).add(s)));
  }

  useEffect(() => {
    stepRef.current = step;
  }, [step]);
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [platformPickerExpanded, setPlatformPickerExpanded] = useState(true);
  const [hasSavedPlatformPreference, setHasSavedPlatformPreference] = useState(false);
  const [selectedPlatformCard, setSelectedPlatformCard] = useState<"META" | "GOOGLE" | "TIKTOK" | null>("META");

  useLayoutEffect(() => {
    const initial = readInitialPlatformPickerState(showTikTokOption);
    if (!initial.hasSavedPlatformPreference) return;
    setWizardKind(initial.wizardKind);
    setSelectedPlatformCard(initial.selectedPlatformCard);
    setPlatformPickerExpanded(false);
    setHasSavedPlatformPreference(true);
  }, [showTikTokOption]);

  function rememberPlatformChoice(choice: WizardPlatformChoice) {
    saveWizardPlatformChoice(choice);
    setHasSavedPlatformPreference(true);
    setPlatformPickerExpanded(false);
  }

  function choosePlatform(next: "META" | "GOOGLE" | "TIKTOK") {
    const platformChoice = coerceLaunchPlatform(next);
    setWizardKind("ads");
    setSelectedPlatformCard(platformChoice);
    rememberPlatformChoice(platformChoice);
    setMismatchWarning(false);
    setAnalyzeStatus("idle");
    setAnalyzeErrors([]);
    setAnalyzeMessage(null);
  }

  function chooseWebsitePlatform() {
    // GA4 website wizard deferred until post-Meta launch — stay on Meta ads flow.
    choosePlatform("META");
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
  const [dataSourceMode, setDataSourceMode] = useState<WizardDataSource>("csv");
  const [mtdFile, setMtdFile] = useState<File | null>(null);
  /** Parsed CSV cache from /analyze — metrics, preview, and generate reuse this instead of re-uploading. */
  const [uploadSessionId, setUploadSessionId] = useState<string | null>(null);
  const [apiSyncStatus, setApiSyncStatus] = useState<"idle" | "loading" | "error">("idle");
  const [apiSyncError, setApiSyncError] = useState<string | null>(null);
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
  const [detectedPlatform, setDetectedPlatform] = useState<"META" | "GOOGLE" | "TIKTOK" | null>(null);
  const [platform, setPlatform] = useState<"META" | "GOOGLE" | "TIKTOK">("META");
  const [continueStatus, setContinueStatus] = useState<"idle" | "loading">("idle");

  // Step 2 — Campaigns (populated by /analyze). Always shown in full for
  // Meta uploads — see handleAnalyze and lib/nre/campaigns.ts's
  // resolveCampaignSelection, which the /analyze route calls to decide the
  // pre-checked default (everything, for a first-ever upload; last time's
  // saved selection, for a returning one) without ever skipping the step.
  /** CSV column headers from /analyze — used to recompute metric cards when objective changes. */
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
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
  // "high" -> green "Detected — change if wrong" (real result_type text
  // matched), "medium" -> same green copy (one clean non-leads column signal),
  // "low" -> amber "Detected — confirm lead type" (website vs meta form —
  // the pair agencies most often confuse), "verify" -> red "Confirmation
  // required" (genuinely
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
  /** Sorted campaign names the last /metrics fetch used — refetch when selection changes. */
  const [metricsFetchedForSelection, setMetricsFetchedForSelection] = useState<string | null>(null);
  const metricsFetchedKeyRef = useRef<string | null>(null);
  const metricsFetchInFlightRef = useRef<{ key: string; promise: Promise<void> } | null>(null);
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
  const [previousMonthHasFile, setPreviousMonthHasFile] = useState(hasPreviousMonthData);
  const [previousMonthUpdatedAt, setPreviousMonthUpdatedAt] = useState(initialPreviousMonthDataUpdatedAt);
  const [previousMonthCampaigns, setPreviousMonthCampaigns] = useState(initialPreviousMonthCampaigns);
  const [previousMonthSelectedCampaigns, setPreviousMonthSelectedCampaigns] = useState<string[] | null>(
    initialPreviousMonthSelectedCampaigns,
  );
  const [previousMonthCampaignSpend, setPreviousMonthCampaignSpend] = useState<Record<string, number>>(
    initialPreviousMonthCampaignSpend,
  );
  const [includePreviousMonthComparison, setIncludePreviousMonthComparison] = useState(false);

  const previousMonthComparisonReady = useMemo(
    () =>
      getPreviousMonthComparisonInfo(previousMonthHasFile, previousMonthUpdatedAt, clientTimezone).status ===
      "current",
    [previousMonthHasFile, previousMonthUpdatedAt, clientTimezone],
  );
  const [weeklyOptions, setWeeklyOptions] = useState<{ last7: DateRangeIso; prev7: DateRangeIso; last14: DateRangeIso } | null>(null);
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
  const [historicalMonthCount, setHistoricalMonthCount] = useState(4);
  const [monthComparisonOptions, setMonthComparisonOptions] = useState<{ periodA: DateRangeIso; periodB: DateRangeIso } | null>(null);
  const [monthComparisonCoverage, setMonthComparisonCoverage] = useState<{
    valid: boolean;
    error?: string;
    warning?: string;
    periodBUsesSupplemental?: boolean;
  } | null>(null);
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
  const [historicalData, setHistoricalData] = useState<HistoricalReportData | null>(null);
  const [dayBreakdownData, setDayBreakdownData] = useState<DayBreakdownReportData | null>(null);
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
  /** Step 5 generate screen — Report Summary card collapsed by default to shorten the page. */
  const [reportSummaryExpanded, setReportSummaryExpanded] = useState(false);
  const [showBudgetOnCover, setShowBudgetOnCover] = useState(clientShowBudgetPacingOnCover ?? false);
  const [budgetToggleSaving, setBudgetToggleSaving] = useState(false);

  // Step 6 — Generate (same screen as Preview above, see the step === 6 JSX block)
  const [generateStatus, setGenerateStatus] = useState<GenerateStatus>("idle");
  const [generateMessage, setGenerateMessage] = useState<string | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
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

  /** After a successful generate, any config edit should bring the Generate CTA back. */
  function acknowledgePostGenerateEdit() {
    if (generateStatusRef.current !== "done") return;
    resetGenerateState();
    clearWizardGenerateSnapshot(clientId);
  }

  /** Report Type card's onSelect — also swaps the Report Title default text, unless the user has already typed their own. */
  function handleReportTypeChange(next: ReportTypeValue) {
    acknowledgePostGenerateEdit();
    const reportTypeChoice = isLaunchReportTypeEnabled(next) ? next : coerceLaunchReportType(next);
    setReportType(reportTypeChoice);
    if (!reportTitleTouched) {
      setReportTitle(defaultReportTitleFor(reportTypeChoice));
    }
    if (reportTypeChoice === "DAY_BREAKDOWN") {
      setDateMode("custom");
      if (weeklyOptions && !customStart && !customEnd) {
        setCustomStart(weeklyOptions.last7.startIso);
        setCustomEnd(weeklyOptions.last7.endIso);
      }
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
    if (dateMode === "prev7") return weeklyOptions.prev7;
    if (dateMode === "last14") return weeklyOptions.last14;
    return weeklyOptions.last7;
  }

  function customSpanDays(): number | null {
    if (!customStart || !customEnd) return null;
    const startTs = Date.parse(customStart + "T00:00:00Z");
    const endTs = Date.parse(customEnd + "T00:00:00Z");
    if (Number.isNaN(startTs) || Number.isNaN(endTs)) return null;
    return Math.round((endTs - startTs) / (24 * 60 * 60 * 1000)) + 1;
  }

  function editDateMode(mode: DateMode) {
    acknowledgePostGenerateEdit();
    setDateMode(mode);
  }

  function editCustomStart(iso: string) {
    acknowledgePostGenerateEdit();
    setCustomStart(iso);
    setLongRangeConfirmed(false);
    setCustomRangeError(null);
  }

  function editCustomEnd(iso: string) {
    acknowledgePostGenerateEdit();
    setCustomEnd(iso);
    setLongRangeConfirmed(false);
    setCustomRangeError(null);
  }

  function editHistoricalMonthCount(count: number) {
    acknowledgePostGenerateEdit();
    setHistoricalMonthCount(count);
  }

  /** Comparison Report's preset pill onSelect (A1) — This week/This month presets recompute Period A/B from the server-provided options; Custom just switches to the date-picker view, leaving whatever dates are already there. */
  function handleComparisonPresetSelect(preset: ComparisonPreset) {
    acknowledgePostGenerateEdit();
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
    acknowledgePostGenerateEdit();
    setComparisonPeriodA((prev) => ({ startIso: prev?.startIso ?? "", endIso: prev?.endIso ?? "", [field]: value }));
  }

  function updateComparisonPeriodB(field: "startIso" | "endIso", value: string) {
    acknowledgePostGenerateEdit();
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

  function resetPreviewState() {
    setPreviewStatus("idle");
    setPreviewErrors([]);
    setPreviewMessage(null);
    setPreviewKind("normal");
    setData(null);
    setComparisonData(null);
    setHistoricalData(null);
    setDayBreakdownData(null);
    setPreviewRefreshing(false);
  }

  function resetMetricsState() {
    metricsFetchedKeyRef.current = null;
    metricsFetchInFlightRef.current = null;
    setMetricsFetchedForSelection(null);
    setMetricsStatus("idle");
    setPerCampaignMetrics(new Map());
    setPerCampaignAvailablePool(new Map());
    setCampaignObjectives(new Map());
    setCampaignObjectiveConfidence(new Map());
    setCampaignRequiresConfirmation(new Map());
    setTouchedObjectiveCampaigns(new Set());
    setPerCampaignMinWarning(null);
    setExpandedCsvExtras(new Set());
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
  }

  useEffect(() => {
    generateStatusRef.current = generateStatus;
  }, [generateStatus]);

  function buildGenerateSnapshot(
    core: Pick<WizardGenerateSnapshot, "reportId" | "downloadUrl" | "shareToken">,
    extras?: Partial<
      Pick<WizardGenerateSnapshot, "driveView" | "driveSaveUrl" | "rememberedFolder" | "publishedAt">
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
      historicalMonthCount,
      previewKind,
      previewStatus,
      data,
      comparisonData,
      historicalData,
      dayBreakdownData,
      reportTitle,
      reportTitleTouched,
      customTitleExpanded,
      selectedCampaigns: Array.from(selectedCampaigns),
      driveView: extras?.driveView ?? driveView,
      driveSaveUrl: extras?.driveSaveUrl ?? driveSaveUrl,
      rememberedFolder: extras?.rememberedFolder ?? rememberedFolder,
      publishedAt: extras?.publishedAt ?? publishedAt,
    };
  }

  function applyGenerateSnapshot(snapshot: WizardGenerateSnapshot) {
    setReportId(snapshot.reportId);
    setDownloadUrl(snapshot.downloadUrl);
    setShareToken(snapshot.shareToken);
    setPlatform(coerceLaunchPlatform(snapshot.platform));
    setReportType(coerceLaunchReportType(snapshot.reportType));
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
    setHistoricalMonthCount(snapshot.historicalMonthCount ?? 4);
    setPreviewKind(snapshot.previewKind);
    setPreviewStatus(snapshot.previewStatus);
    setData(snapshot.data);
    setComparisonData(snapshot.comparisonData);
    setHistoricalData(snapshot.historicalData ?? null);
    setDayBreakdownData(snapshot.dayBreakdownData ?? null);
    setReportTitle(snapshot.reportTitle);
    setReportTitleTouched(snapshot.reportTitleTouched);
    setCustomTitleExpanded(snapshot.customTitleExpanded);
    setSelectedCampaigns(new Set(snapshot.selectedCampaigns));
    setDriveView(snapshot.driveView);
    setDriveSaveUrl(snapshot.driveSaveUrl);
    setRememberedFolder(snapshot.rememberedFolder);
    setPublishedAt(snapshot.publishedAt ?? null);
    setGenerateStatus("done");
    setGenerateMessage(null);
  }

  function persistGenerateSnapshot(
    core: Pick<WizardGenerateSnapshot, "reportId" | "downloadUrl" | "shareToken">,
    extras?: Partial<
      Pick<WizardGenerateSnapshot, "driveView" | "driveSaveUrl" | "rememberedFolder" | "publishedAt">
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
      setStepState(4);
      setVisitedSteps(new Set([1, 2, 3, 4]));
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
        showToast("Could not restore the generate screen. Your report is in history.", "error");
        router.replace(`/clients/${clientId}/reports`);
        setResumeBootstrapping(false);
        return;
      }

      setReportId(resumeReportId);
      setDownloadUrl(`/api/reports/${resumeReportId}/download`);
      setShareToken(json.shareToken ?? null);
      setPublishedAt(json.publishedAt ?? null);
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
        },
      );
      setStepState(4);
      setVisitedSteps(new Set([1, 2, 3, 4]));
      router.replace(`/clients/${clientId}/reports/new`);
      setResumeBootstrapping(false);
      showToast("Download links restored. Open report history if the full screen looks incomplete.");
    })();

    return () => {
      cancelled = true;
    };
  }, [clientId, resumeReportId, router, showToast]);

  /** Populates campaigns/date state from a successful /analyze response — shared by handleAnalyze (natural detection) and handleMismatchContinueAnyway (forced platform). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function applyAnalyzeResult(json: any) {
    setUploadSessionId(typeof json.uploadSessionId === "string" ? json.uploadSessionId : null);
    setCsvHeaders(Array.isArray(json.headers) ? json.headers : []);
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
    setMonthComparisonCoverage(json.monthComparisonCoverage || null);
    setDailyRange(json.dailyRange || null);
    setHasAdLevelCsv(!!json.hasAdLevelCsv);
    const savedSelection: DateSelection = json.dateSelection || { mode: "last7" };
    const normalizedSelection = normalizeSavedDateSelection(savedSelection, json.weeklyOptions || null);
    setDateMode(normalizedSelection.mode);
    setCustomStart(normalizedSelection.customStart || savedSelection.customStart || "");
    setCustomEnd(normalizedSelection.customEnd || savedSelection.customEnd || "");
    setLongRangeConfirmed(false);
    setComparisonPreset("thisWeek");
    setComparisonPeriodB(json.weeklyOptions?.prev7 || null);
    setComparisonPeriodA(json.weeklyOptions?.last7 || null);
    resetMetricsState();
    resetPreviewState();
    resetGenerateState();
    setUploadSessionRecovery(null);
  }

  /** Populates data/comparisonData from a successful /preview response, and clears any stale generate/Drive state left over from a previous attempt. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function applyPreviewResult(json: any) {
    if (json.isComparison) {
      setPreviewKind("comparison");
      setComparisonData(json.data);
      setHistoricalData(null);
      setDayBreakdownData(null);
      setData(null);
    } else if (json.isHistorical) {
      setPreviewKind("historical");
      setHistoricalData(json.data);
      setDayBreakdownData(null);
      setComparisonData(null);
      setData(null);
    } else if (json.isDayBreakdown) {
      setPreviewKind("dayBreakdown");
      setDayBreakdownData(json.data);
      setHistoricalData(null);
      setComparisonData(null);
      setData(null);
    } else {
      setPreviewKind("normal");
      setData(json.data);
      setComparisonData(null);
      setHistoricalData(null);
      setDayBreakdownData(null);
    }
    setPreviewStatus("idle");
    resetGenerateState();
  }

  /** All ad platforms land on Step 2 (Select Campaigns) after analyze — /metrics is fetched on that step's Continue click. */
  async function dispatchAfterAnalyze(_platformValue: "META" | "GOOGLE" | "TIKTOK") {
    setStep(2);
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
    const detected: "META" | "GOOGLE" | "TIKTOK" = json.detectedPlatform || "META";
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
    rememberPlatformChoice(detected);
    await dispatchAfterAnalyze(detected);
  }

  type ApiSyncMeta = {
    previousMonthSynced?: boolean;
    hasPreviousMonthData?: boolean;
    previousMonthCampaigns?: string[];
    previousMonthSelectedCampaigns?: string[] | null;
    previousMonthUpdatedAt?: string | null;
    previousMonthCampaignSpend?: Record<string, number>;
  };

  /** API-sync artifacts use a synthetic filename — discard when switching to manual CSV upload. */
  function isApiSyncArtifact(file: File | null): boolean {
    return Boolean(file?.name.includes("-api-sync-"));
  }

  function handleUploadSessionExpired(message?: string) {
    setUploadSessionId(null);
    setUploadSessionRecovery(
      message || "Your parsed upload expired. Re-analyze the same file to continue — no need to re-upload.",
    );
  }

  async function handleReanalyzeSession() {
    if (!mtdFile || !platform) {
      setUploadSessionRecovery(null);
      setStep(1);
      return;
    }
    setReanalyzeSessionStatus("loading");
    setUploadSessionRecovery(null);
    setAnalyzeStatus("loading");
    setAnalyzeMessage(null);

    const res = await fetch(`/api/clients/${clientId}/reports/analyze`, {
      method: "POST",
      body: buildUploadFormData(mtdFile, { platform }),
    });
    const json = await res.json().catch(() => null);
    setReanalyzeSessionStatus("idle");

    if (!res.ok || !json?.valid) {
      setAnalyzeStatus("error");
      setAnalyzeMessage(
        json?.errors?.[0]?.message || "Could not re-analyze your file. Try uploading again from step 1.",
      );
      return;
    }

    applyAnalyzeResult(json);
    setAnalyzeStatus("idle");

    const currentStep = stepRef.current;
    if (currentStep >= 2 && selectedCampaigns.size > 0) {
      await ensureObjectivesForSelection(selectedCampaignsKey());
    }
    if (currentStep >= 4) {
      void fetchPreview();
    }
    showToast("Upload session restored — continue where you left off.");
  }

  function handleMtdFileSelected(file: File | null) {
    if (file !== mtdFile) {
      setUploadSessionId(null);
      setUploadSessionRecovery(null);
      invalidateDownstreamFromStep(2);
      setAnalyzeStatus("idle");
      setAnalyzeErrors([]);
      setAnalyzeMessage(null);
      setMismatchWarning(false);
    }
    setMtdFile(file);
  }

  function handleDataSourceModeChange(mode: WizardDataSource) {
    if (mode === "csv" && isApiSyncArtifact(mtdFile)) {
      setMtdFile(null);
      setUploadSessionId(null);
      setAnalyzeStatus("idle");
      setAnalyzeErrors([]);
      setAnalyzeMessage(null);
      setApiSyncStatus("idle");
      setApiSyncError(null);
    }
    setDataSourceMode(mode);
  }

  /** After API sync returns a CSV File — analyze with the selected platform forced (no mismatch pause). */
  async function handleApiSynced(file: File, meta?: ApiSyncMeta) {
    if (!selectedPlatformCard) return;
    setApiSyncStatus("idle");
    setApiSyncError(null);
    setMtdFile(file);
    setAnalyzeStatus("loading");
    setAnalyzeErrors([]);
    setAnalyzeMessage(null);
    setMismatchWarning(false);

    const res = await fetch(`/api/clients/${clientId}/reports/analyze`, {
      method: "POST",
      body: buildUploadFormData(file, { platform: selectedPlatformCard }),
    });
    const json = await res.json().catch(() => null);

    if (!res.ok || !json) {
      setAnalyzeStatus("error");
      setAnalyzeMessage("Something went wrong analyzing the synced data. Please try again.");
      return;
    }

    if (!json.valid) {
      setPlatform(selectedPlatformCard);
      setAnalyzeStatus("invalid");
      setAnalyzeErrors(json.errors || []);
      return;
    }

    setPlatform(selectedPlatformCard);
    applyAnalyzeResult(json);
    setAnalyzeStatus("idle");
    rememberPlatformChoice(selectedPlatformCard);
    if (meta?.hasPreviousMonthData || meta?.previousMonthSynced) {
      setPreviousMonthHasFile(true);
      if (meta.previousMonthUpdatedAt) setPreviousMonthUpdatedAt(meta.previousMonthUpdatedAt);
      if (meta.previousMonthCampaigns) setPreviousMonthCampaigns(meta.previousMonthCampaigns);
      if (meta.previousMonthSelectedCampaigns !== undefined) {
        setPreviousMonthSelectedCampaigns(meta.previousMonthSelectedCampaigns);
      }
      if (meta.previousMonthCampaignSpend) {
        setPreviousMonthCampaignSpend(meta.previousMonthCampaignSpend);
      }
    }
    if (meta?.previousMonthSynced) {
      showToast(
        "Previous month data synced — review campaign checkboxes below, then uncheck any you don't manage.",
      );
    }
    await dispatchAfterAnalyze(selectedPlatformCard);
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

    const detected: "META" | "GOOGLE" | "TIKTOK" = json.detectedPlatform || selectedPlatformCard;
    setDetectedPlatform(detected);
    setPlatform(json.platform || selectedPlatformCard);

    if (!json.valid) {
      setAnalyzeStatus("invalid");
      setAnalyzeErrors(json.errors || []);
      return;
    }

    applyAnalyzeResult(json);
    rememberPlatformChoice(selectedPlatformCard);
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
   * full OBJECTIVE_DROPDOWN_OPTIONS list (see result-type-map.ts) —
   * but the engine's own detection can legitimately return something rarer
   * that isn't one of them (e.g. "AD RECALL LIFT"). Rather than silently
   * mis-mapping that to the nearest dropdown entry (misrepresenting what
   * the engine actually found), this synthesizes a matching option carrying
   * the real detected label/cost text so the dropdown always shows ground
   * truth as its pre-selected value, even outside the common list.
   */
  function objectiveInfoForResultLabel(resultLabel: string, costLabel: string): ObjectiveInfo {
    return objectiveInfoForDetectedLabel(resultLabel, costLabel);
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
  async function fetchObjectivesAndMetrics(selectionKey: string) {
    if (!mtdFile && !uploadSessionId) return;
    setMetricsStatus("loading");
    setTouchedObjectiveCampaigns(new Set());
    setPerCampaignMinWarning(null);

    const res = await fetch(`/api/clients/${clientId}/reports/metrics`, {
      method: "POST",
      body: buildUploadFormData(mtdFile, { platform, selectedCampaigns: Array.from(selectedCampaigns) }, uploadSessionId),
    });
    const json = await res.json().catch(() => null);

    // Ignore stale responses when the user changed selection mid-fetch.
    if (selectedCampaignsKey() !== selectionKey) return;

    if (json?.uploadSessionExpired) {
      handleUploadSessionExpired(json.error);
      setMetricsStatus("error");
      return;
    }

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

  function selectedCampaignsKey(): string {
    return [...selectedCampaigns].sort().join("\0");
  }

  /** One in-flight /metrics call per selection key — shared by prefetch and Continue. */
  function ensureObjectivesForSelection(key: string): Promise<void> {
    if (!mtdFile && !uploadSessionId) return Promise.resolve();
    if (!key) return Promise.resolve();

    if (metricsFetchedKeyRef.current === key) return Promise.resolve();
    if (metricsFetchInFlightRef.current?.key === key) {
      return metricsFetchInFlightRef.current.promise;
    }

    const promise = fetchObjectivesAndMetrics(key)
      .then(() => {
        if (selectedCampaignsKey() !== key) return;
        metricsFetchedKeyRef.current = key;
        setMetricsFetchedForSelection(key);
      })
      .finally(() => {
        if (metricsFetchInFlightRef.current?.key === key) {
          metricsFetchInFlightRef.current = null;
        }
      });

    metricsFetchInFlightRef.current = { key, promise };
    return promise;
  }

  function hasBlockingObjectives(): boolean {
    return campaigns.some((name) => {
      const normalized = normalizeCampaignName(name);
      return (
        selectedCampaigns.has(name) &&
        campaignRequiresConfirmation.get(normalized) === true &&
        !touchedObjectiveCampaigns.has(normalized)
      );
    });
  }

  // ── Step 2: Campaigns + Objectives -> Metric Cards ──────────────────────
  async function handleCampaignsContinue() {
    await saveSelection({ campaigns, selectedCampaigns: Array.from(selectedCampaigns) });
    const selectionKey = selectedCampaignsKey();
    await ensureObjectivesForSelection(selectionKey);

    if (hasBlockingObjectives()) return;
    setStep(3);
  }

  const selectedCampaignsKeyValue = useMemo(() => selectedCampaignsKey(), [selectedCampaigns]);

  // When selection changes, drop cached objectives so the prefetch refetches.
  useEffect(() => {
    if (metricsFetchedKeyRef.current && metricsFetchedKeyRef.current !== selectedCampaignsKeyValue) {
      metricsFetchedKeyRef.current = null;
      setMetricsFetchedForSelection(null);
    }
  }, [selectedCampaignsKeyValue]);

  // Prefetch objectives when campaigns step opens or selection changes.
  useEffect(() => {
    if (step !== 2) return;
    if (selectedCampaigns.size === 0) return;
    void ensureObjectivesForSelection(selectedCampaignsKeyValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, selectedCampaignsKeyValue, uploadSessionId, mtdFile]);

  // ── Step 3 -> 4: Metric Cards -> Report Period & Generate ───────────────
  function handleMetricsContinue() {
    setPerCampaignMinWarning(null);
    setStep(4);
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

  /** Recompute this campaign's metric card defaults when its objective changes. */
  function refreshCampaignMetrics(normalized: string, info: ObjectiveInfo) {
    if (csvHeaders.length === 0) return;
    const bundle = buildCampaignMetricBundle(platform, csvHeaders, info.resultLabel, info.costLabel);
    setPerCampaignMetrics((prev) => new Map(prev).set(normalized, bundle.selection));
    setPerCampaignAvailablePool((prev) => new Map(prev).set(normalized, bundle.available));
  }

  // ── Step 3: Objective Confirmation (the permanent objective-detection fix) ──
  /** Dropdown onChange — records the user's choice AND marks the campaign as touched, so only campaigns the user actually reviewed/changed are sent back as an override (see currentCampaignObjectivesPayload) — an untouched campaign keeps the engine's own true detection rather than a copy of whatever was pre-filled. Keyed by normalizeCampaignName, matching the server's own campaignObjectiveMap keys exactly. Also clears any confidence badge for this campaign — once the user has picked a value themselves, a badge describing where the PRE-fill came from is no longer meaningful. */
  function setCampaignObjective(campaignName: string, objectiveKey: string) {
    const option = OBJECTIVE_DROPDOWN_OPTIONS.find((o) => o.key === objectiveKey);
    if (!option) return;
    const normalized = normalizeCampaignName(campaignName);
    setCampaignObjectives((prev) => new Map(prev).set(normalized, option));
    setTouchedObjectiveCampaigns((prev) => new Set(prev).add(normalized));
    refreshCampaignMetrics(normalized, option);
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
   * Sent to preview/generate as explicit objective overrides — ONLY campaigns
   * the user manually changed in the dropdown. Engine-detected values (including
   * cache-backed pre-fills that agree with fresh detection) are never sent here;
   * buildReportData re-detects from the CSV rows so swapped uploads cannot inherit
   * another account's stale cache.
   */
  function currentCampaignObjectivesPayload(): Record<string, { resultLabel: string; costLabel: string }> | undefined {
    const relevant = new Set(touchedObjectiveCampaigns);
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
   * confirmed this exact campaign before. "high"/"medium" (green check) —
   * detected from result_type or column data; copy nudges a dropdown change
   * only if wrong. "low" (amber check) — detected from a lead-family column;
   * website vs meta form is the pair agencies most often confuse.
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
    if (tier === "high" || tier === "medium") {
      return { icon: "✓", text: "Detected — change if wrong", className: "text-[#68d391]", pill: false };
    }
    if (tier === "low") {
      return { icon: "✓", text: "Detected — confirm lead type if wrong", className: "text-[#f6ad55]", pill: false };
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
    if (!mtdFile && !uploadSessionId) return;
    // Monthly has no weekly period selector at all — none of the custom-
    // range validation/confirmation below applies, and no dateSelection is
    // sent (buildReportData then uses the full MTD data with no weekly
    // window — see report-data.ts's primaryRows). Comparison has its own
    // Period A/B requirement instead.
    if (reportType === "WEEKLY" || reportType === "DAY_BREAKDOWN") {
      if (!validateCustomRange()) return;
      if (reportType === "WEEKLY") {
        const spanDays = customSpanDays();
        if (dateMode === "custom" && spanDays !== null && spanDays > 7 && !longRangeConfirmed) {
          return; // the inline "Continue anyway?" prompt handles confirmation
        }
      }
    }

    if (reportType === "DAY_BREAKDOWN" && platform !== "META") {
      setPreviewStatus("invalid");
      setPreviewErrors([
        { field: "reportType", message: "Daily table reports are available for Meta only in this version." },
      ]);
      return;
    }

    if (reportType === "COMPARISON" && !comparisonPeriodsReady()) {
      setPreviewStatus("invalid");
      setPreviewErrors([{ field: "comparisonPeriod", message: "Choose both Period A and Period B date ranges." }]);
      return;
    }

    if (reportType === "HISTORICAL" && (historicalMonthCount < 2 || historicalMonthCount > 12)) {
      setPreviewStatus("invalid");
      setPreviewErrors([{ field: "historicalMonthCount", message: "Choose between 2 and 12 months." }]);
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

    const dateSelection =
      reportType === "WEEKLY" || reportType === "DAY_BREAKDOWN" ? currentDateSelection() : undefined;
    // Only persist a weekly preference when one was actually made — a
    // Monthly/Comparison run shouldn't overwrite the client's remembered
    // weekly date-mode with nothing.
    if (dateSelection) await saveSelection({ dateSelection });

    const hasExistingPreview = !!(data || comparisonData || historicalData || dayBreakdownData);
    if (!hasExistingPreview) {
      setPreviewStatus("loading");
    } else {
      setPreviewRefreshing(true);
    }
    setPreviewErrors([]);
    setPreviewMessage(null);

    const res = await fetch(`/api/clients/${clientId}/reports/preview`, {
      method: "POST",
      body: buildUploadFormData(
        mtdFile,
        {
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
          historicalMonthCount: reportType === "HISTORICAL" ? historicalMonthCount : undefined,
          showBudgetPacingOnCover: showBudgetOnCover,
          includePreviousMonthComparison,
        },
        uploadSessionId,
      ),
    });
    const json = await res.json().catch(() => null);

    if (json?.uploadSessionExpired) {
      handleUploadSessionExpired(json.error);
      setPreviewStatus("error");
      setPreviewRefreshing(false);
      return;
    }

    if (!res.ok || !json) {
      setPreviewStatus("error");
      setPreviewMessage("Something went wrong building the preview. Please try again.");
      setPreviewRefreshing(false);
      return;
    }
    if (!json.valid) {
      setPreviewStatus("invalid");
      setPreviewErrors(json.errors || []);
      setPreviewRefreshing(false);
      return;
    }

    applyPreviewResult(json);
    setPreviewRefreshing(false);
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
    if (step !== 4 || !usesFullAdWizard(platform)) return;
    // Keep the post-generate success screen until the user edits report settings.
    if (generateStatus === "done") return;

    if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
    previewDebounceRef.current = setTimeout(() => {
      void fetchPreview();
    }, 500);

    return () => {
      if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
    };
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
    historicalMonthCount,
    showBudgetOnCover,
    includePreviousMonthComparison,
    generateStatus,
  ]);

  // ── Step 6: Preview + Generate (one screen) ─────────────────────────────
  async function handleGenerate() {
    if (!mtdFile && !uploadSessionId) return;
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
      body: buildUploadFormData(
        mtdFile,
        {
          selectedCampaigns: Array.from(selectedCampaigns),
          selectedAdSets: Array.from(selectedAdSets),
          selectedMetrics: currentSelectedMetricsPayload(),
          campaignObjectives: currentCampaignObjectivesPayload(),
          campaignMetricOverrides: currentCampaignMetricOverridesPayload(),
          // Part 3 — every campaign the Objective Confirmation step showed,
          // saved back to this client's objective memory cache once the
          // report actually generates. Only sent here, never on preview.
          confirmedCampaignObjectives: confirmedCampaignObjectivesPayload(),
          dateSelection:
            reportType === "WEEKLY" || reportType === "DAY_BREAKDOWN" ? currentDateSelection() : undefined,
          reportTitle: reportTitle.trim() || defaultReportTitleFor(reportType),
          reportType,
          platform,
          comparisonPeriodA: reportType === "COMPARISON" ? comparisonPeriodA : undefined,
          comparisonPeriodB: reportType === "COMPARISON" ? comparisonPeriodB : undefined,
          historicalMonthCount: reportType === "HISTORICAL" ? historicalMonthCount : undefined,
          showBudgetPacingOnCover: showBudgetOnCover,
          includePreviousMonthComparison,
        },
        uploadSessionId,
      ),
    });
    const json = await res.json().catch(() => null);

    if (json?.uploadSessionExpired) {
      handleUploadSessionExpired(json.error);
      setGenerateStatus("error");
      return;
    }

    if (!res.ok || !json?.ok || !json.reportId) {
      setGenerateStatus("error");
      setGenerateMessage(json?.error || "Report generation failed. Please try again.");
      return;
    }

    setReportId(json.reportId);
    setDownloadUrl(`/api/reports/${json.reportId}/download`);

    let finalShareToken: string | null = json.shareToken ?? null;
    if (json.status === "GENERATING") {
      try {
        const polled = await pollReportStatus(json.reportId);
        finalShareToken = polled.shareToken ?? finalShareToken;
      } catch (err) {
        setGenerateStatus("error");
        setGenerateMessage(
          err instanceof ReportGenerationPollError
            ? err.message
            : "Report generation failed. Please try again.",
        );
        return;
      }
    }

    setUploadSessionId(null);
    setShareToken(finalShareToken);
    setPublishedAt(null);
    setGenerateStatus("done");
    persistGenerateSnapshot(
      {
        reportId: json.reportId,
        downloadUrl: `/api/reports/${json.reportId}/download`,
        shareToken: finalShareToken,
      },
      { publishedAt: null },
    );
  }

  /** PreviousMonthSummaryOption's "Generate Previous Month Summary Report" button — see report-data.ts's buildPreviousMonthSummaryReportData and the generate route's own PREVIOUS_MONTH_SUMMARY branch. Sends the same (data-less) mtdFile the wizard already has in state purely because the route still expects an mtdDailyCsv field; none of its rows are actually used for this report. */
  async function handleGeneratePreviousMonthSummary() {
    if (!mtdFile && !uploadSessionId) return;
    setPmsStatus("loading");
    setPmsError(null);

    const res = await fetch(`/api/clients/${clientId}/reports`, {
      method: "POST",
      body: buildUploadFormData(mtdFile, { platform, reportType: "PREVIOUS_MONTH_SUMMARY" }, uploadSessionId),
    });
    const json = await res.json().catch(() => null);

    if (json?.uploadSessionExpired) {
      handleUploadSessionExpired(json.error);
      setPmsStatus("error");
      return;
    }

    if (!res.ok || !json?.ok || !json.reportId) {
      setPmsStatus("error");
      setPmsError(json?.error || "Report generation failed. Please try again.");
      return;
    }

    let finalShareToken: string | null = json.shareToken ?? null;
    if (json.status === "GENERATING") {
      try {
        const polled = await pollReportStatus(json.reportId);
        finalShareToken = polled.shareToken ?? finalShareToken;
      } catch (err) {
        setPmsStatus("error");
        setPmsError(
          err instanceof ReportGenerationPollError
            ? err.message
            : "Report generation failed. Please try again.",
        );
        return;
      }
    }

    setUploadSessionId(null);
    setPmsResult({
      reportId: json.reportId,
      downloadUrl: `/api/reports/${json.reportId}/download`,
      shareToken: finalShareToken,
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
    const stored = readStoredWizardPlatform();
    if (stored === "META" || stored === "GOOGLE" || stored === "TIKTOK") {
      setSelectedPlatformCard(stored);
      setWizardKind("ads");
      setPlatformPickerExpanded(false);
      setHasSavedPlatformPreference(true);
    } else if (stored === "GA4") {
      setWizardKind("website");
      setPlatformPickerExpanded(false);
      setHasSavedPlatformPreference(true);
    } else {
      setSelectedPlatformCard("META");
      setWizardKind("ads");
      setPlatformPickerExpanded(true);
      setHasSavedPlatformPreference(false);
    }
    setMtdFile(null);
    setUploadSessionId(null);
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
    setMetricsFetchedForSelection(null);
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
    setShowBudgetOnCover(clientShowBudgetPacingOnCover ?? false);
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
    reportType === "WEEKLY" &&
    dateMode === "custom" &&
    spanDays !== null &&
    spanDays > 7 &&
    !customRangeError &&
    !longRangeConfirmed;
  const weeklyRangeIso = currentWeeklyRangeIso();

  /**
   * B2 Section 1's report summary card content (Fix 1) — no longer a single
   * "N campaigns · Week: ... · MTD: ..." string: the campaign count is
   * dropped entirely, and each remaining piece becomes its own labelled
   * "Label: value" line, varying by report type.
   */
  function reportTypeLabel(): string {
    if (previewKind === "comparison") return "Comparison Report";
    if (previewKind === "historical") return "Multi-Month Report";
    if (previewKind === "dayBreakdown") return "Daily Report";
    if (reportType === "MONTHLY") return "Monthly Report";
    if (reportType === "QUARTER") return "Quarterly Report";
    if (reportType === "YTD") return "Year-to-Date Report";
    if (reportType === "DAILY") return "Yesterday Report";
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
    if (previewKind === "historical" && historicalData) {
      return Array.from(new Set(historicalData.slides.map((s) => s.campaignName))).sort();
    }
    if (previewKind === "dayBreakdown" && dayBreakdownData) {
      return [`${dayBreakdownData.dayCount} day${dayBreakdownData.dayCount === 1 ? "" : "s"} with spend`];
    }
    if (data) return data.campaignSlides.map((s) => s.campaignName);
    return [];
  }

  const historicalMonthLabels = useMemo(
    () => computeHistoricalMonthRanges(historicalMonthCount, new Date(), clientTimezone).map((m) => m.fullMonthLabel),
    [historicalMonthCount, clientTimezone],
  );

  const coverBudgetPacingWarning = useMemo(() => {
    if (previewKind !== "normal" || !data) return null;
    return budgetPacingWarning(data.mtdSpendTotal, clientMonthlyBudget, showBudgetOnCover);
  }, [previewKind, data, clientMonthlyBudget, showBudgetOnCover]);

  const coverBudgetPreviewLine = useMemo(() => {
    if (previewKind !== "normal" || !data) return null;
    return buildBudgetCoverPreview(data.mtdSpendTotal, clientMonthlyBudget, currencySymbol, clientTimezone);
  }, [previewKind, data, clientMonthlyBudget, currencySymbol, clientTimezone]);

  async function handleShowBudgetOnCoverChange(next: boolean) {
    acknowledgePostGenerateEdit();
    const previous = showBudgetOnCover;
    setShowBudgetOnCover(next);
    setBudgetToggleSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showBudgetPacingOnCover: next }),
      });
      if (!res.ok) {
        setShowBudgetOnCover(previous);
        showToast("Couldn't save cover budget preference.", "error");
      }
    } catch {
      setShowBudgetOnCover(previous);
      showToast("Couldn't save cover budget preference.", "error");
    } finally {
      setBudgetToggleSaving(false);
    }
  }

  function driveDateRangeLabel(): string {
    if (previewKind === "comparison" && comparisonData) return `${comparisonData.periodALabel} vs ${comparisonData.periodBLabel}`;
    if (previewKind === "historical" && historicalData) return historicalData.monthsLabel;
    if (previewKind === "dayBreakdown" && dayBreakdownData) return dayBreakdownData.rangeLabel;
    if ((reportType === "WEEKLY" || reportType === "DAY_BREAKDOWN") && weeklyRangeIso) return formatIsoRange(weeklyRangeIso);
    if (mtdRange) return formatIsoRange(mtdRange);
    return "";
  }

  /** Report Summary card's "Estimated slides" line: cover (1) + one slide per campaign + one slide per selected ad set + the MTD chart (1) + the combined-total table (1) + the metric guide (1) — matches the actual slide types the PPTX generator emits for a normal (non-comparison) report. Comparison reports have their own different slide shape (no ad set/chart/table/guide slides), so this only counts the cover + one slide per compared campaign there. */
  function estimatedSlideCount(): number {
    if (previewKind === "comparison") return 1 + summaryCampaignNames().length + 1;
    if (previewKind === "historical" && historicalData) {
      const continuation = historicalData.slides.filter((s) => s.additionalMetricsSlide).length;
      return 1 + historicalData.slides.length + continuation;
    }
    if (previewKind === "dayBreakdown" && dayBreakdownData) {
      return 1 + dayBreakdownData.tableSlides.length;
    }
    return 1 + summaryCampaignNames().length + selectedAdSets.size + 1 + 1 + 1;
  }

  /** B3's friendly Drive link label, shown in place of the raw URL. */
  function driveDisplayLabel(): string {
    const range = driveDateRangeLabel();
    return `📊 ${clientName} — ${reportTypeLabel()}${range ? " " + range : ""}`;
  }

  const importPipelineLabel =
    dataSourceMode === "api"
      ? apiSyncStatus === "loading"
        ? "Syncing from API…"
        : analyzeStatus === "loading"
          ? "Analyzing campaigns…"
          : null
      : null;

  return {
    clientId,
    clientName,
    clientTimezone,
    currencySymbol,
    hasGoogleDriveConnected,
    clientTemplate,
    metaConnected,
    metaConnectedName,
    metaConfigured,
    googleAdsConfigured,
    googleAdsConnected,
    tiktokConfigured,
    tiktokConnected,
    hasGa4Property,
    ga4Connected,
    showTikTokOption,
    clientMonthlyBudget,
    wizardKind,
    setWizardKind,
    step,
    setStep,
    visitedSteps,
    platformPickerExpanded,
    setPlatformPickerExpanded,
    hasSavedPlatformPreference,
    selectedPlatformCard,
    choosePlatform,
    chooseWebsitePlatform,
    dataSourceMode,
    handleDataSourceModeChange,
    mtdFile,
    handleMtdFileSelected,
    uploadSessionId,
    apiSyncStatus,
    setApiSyncStatus,
    apiSyncError,
    setApiSyncError,
    analyzeStatus,
    analyzeErrors,
    analyzeMessage,
    handleAnalyze,
    handleApiSynced,
    handleMismatchContinueAnyway,
    handleMismatchGoBack,
    mismatchWarning,
    detectedPlatform,
    platform,
    continueStatus,
    pmsStatus,
    pmsError,
    pmsResult,
    handleGeneratePreviousMonthSummary,
    handleCancelPreviousMonthSummary,
    campaigns,
    campaignSpend,
    lowSpendCampaigns,
    selectedCampaigns,
    setSelectedCampaigns,
    selectedCampaignsKey,
    campaignSearch,
    setCampaignSearch,
    toggleCampaign,
    adSetGroups,
    selectedAdSets,
    expandedCampaigns,
    toggleCampaignExpanded,
    toggleAdSet,
    selectAllAdSetsForCampaign,
    deselectAllAdSetsForCampaign,
    handleCampaignsContinue,
    metricsStatus,
    metricsFetchedForSelection,
    campaignObjectives,
    campaignObjectiveConfidence,
    campaignRequiresConfirmation,
    touchedObjectiveCampaigns,
    setCampaignObjective,
    objectiveConfidenceBadge,
    hasBlockingObjectives,
    perCampaignMetrics,
    perCampaignAvailablePool,
    perCampaignMinWarning,
    overflowDialog,
    setOverflowDialog,
    removeCampaignMetric,
    addCampaignMetric,
    confirmOpenSecondSlide,
    campaignAvailableMetrics,
    objectiveAccent,
    handleMetricsContinue,
    csvDateGuidance,
    csvWarningDismissed,
    setCsvWarningDismissed,
    setCsvDateGuidance,
    setMtdFile,
    setUploadSessionId,
    previousMonthHasFile,
    setPreviousMonthHasFile,
    previousMonthUpdatedAt,
    setPreviousMonthUpdatedAt,
    previousMonthCampaigns,
    setPreviousMonthCampaigns,
    previousMonthSelectedCampaigns,
    setPreviousMonthSelectedCampaigns,
    previousMonthCampaignSpend,
    setPreviousMonthCampaignSpend,
    includePreviousMonthComparison,
    setIncludePreviousMonthComparison,
    previousMonthComparisonReady,
    dateBounds,
    weeklyOptions,
    mtdRange,
    dateMode,
    setDateMode,
    editDateMode,
    customStart,
    setCustomStart,
    editCustomStart,
    customEnd,
    setCustomEnd,
    editCustomEnd,
    customRangeError,
    setCustomRangeError,
    longRangeConfirmed,
    setLongRangeConfirmed,
    reportType,
    handleReportTypeChange,
    comparisonPreset,
    handleComparisonPresetSelect,
    comparisonPeriodA,
    comparisonPeriodB,
    updateComparisonPeriodA,
    updateComparisonPeriodB,
    historicalMonthCount,
    setHistoricalMonthCount,
    editHistoricalMonthCount,
    monthComparisonOptions,
    monthComparisonCoverage,
    dailyRange,
    hasAdLevelCsv,
    previewStatus,
    previewErrors,
    previewMessage,
    previewKind,
    data,
    comparisonData,
    historicalData,
    dayBreakdownData,
    reportTitle,
    setReportTitle,
    reportTitleTouched,
    setReportTitleTouched,
    customTitleExpanded,
    setCustomTitleExpanded,
    reportSummaryExpanded,
    setReportSummaryExpanded,
    showBudgetOnCover,
    handleShowBudgetOnCoverChange,
    budgetToggleSaving,
    coverBudgetPacingWarning,
    coverBudgetPreviewLine,
    generateStatus,
    generateMessage,
    handleGenerate,
    reportId,
    downloadUrl,
    publishedAt,
    shareToken,
    rememberedFolder,
    driveView,
    setDriveView,
    driveSaving,
    driveFolderLinkInput,
    setDriveFolderLinkInput,
    driveFolderNameInput,
    setDriveFolderNameInput,
    driveLinkFormatError,
    driveSaveUrl,
    setDriveSaveUrl,
    driveSaveError,
    setDriveSaveError,
    setDriveLinkFormatError,
    persistGenerateSnapshot,
    copied,
    handleCopyShareLink,
    handleSaveButtonClick,
    handleSaveToFolderLink,
    handleCopyLink,
    handleGenerateAnother,
    resumeBootstrapping,
    spanDays,
    needsLongRangeConfirm,
    weeklyRangeIso,
    reportTypeLabel,
    weeklyPeriodSummaryLabel,
    summaryCampaignNames,
    historicalMonthLabels,
    estimatedSlideCount,
    driveDateRangeLabel,
    driveDisplayLabel,
    formatIso,
    formatIsoRange,
    formatSummaryRange,
    ADD_FROM_CSV_VISIBLE,
    ADSET_CHIP_CLASS,
    MIN_SELECTED_METRICS,
    MAX_METRICS_PER_SLIDE,
    MAX_TOTAL_METRICS,
    OBJECTIVE_DROPDOWN_OPTIONS,
    LOW_SPEND_CAMPAIGN_THRESHOLD,
    expandedCsvExtras,
    setExpandedCsvExtras,
    uploadSessionRecovery,
    reanalyzeSessionStatus,
    handleReanalyzeSession,
    previewRefreshing,
    importPipelineLabel,
  };
}
