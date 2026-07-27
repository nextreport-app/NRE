"use client";

import { useState } from "react";
import Link from "next/link";
import type { ReportData } from "@/lib/nre/report-data";
import type { ValidationIssue } from "@/lib/nre/validate";
import { extractDriveFolderIdFromLink } from "@/lib/drive-link";

// Ad-set-level filtering was removed from the wizard (product decision: it
// produced MTD totals that no longer matched real account spend, which
// misled clients). The underlying filter logic still lives in
// lib/nre/ad-sets.ts and report-data.ts's selectedAdSets param — untouched,
// just never called from here — so it can come back without re-deriving it.
// Preview + Generate are one screen (see the step === 4 block below) — the
// action row at the bottom swaps between "Generate" button, a loading
// spinner, the download/slides links, or an error + Try Again, all without
// navigating away, so the step indicator only ever needs to count 4 steps.
type Step = 1 | 2 | 3 | 4;
const STEP_LABELS: Record<Step, string> = {
  1: "Upload",
  2: "Campaigns",
  3: "Dates",
  4: "Preview",
};

type AnalyzeStatus = "idle" | "loading" | "invalid" | "error";
type PreviewStatus = "idle" | "loading" | "invalid" | "error";
type GenerateStatus = "idle" | "loading" | "done" | "error";
type DateMode = "last7" | "prev7" | "custom";
// Drives the download screen's "Save to Google Drive" flow: "idle" (a
// remembered folder exists, ready to save to it with one click) -> "editing"
// (the paste-a-link input is shown, either because there's no remembered
// folder yet or the user clicked "Change") -> "saving" (upload + share in
// flight) -> "success" (link ready) or "error".
type DriveSaveStatus = "idle" | "editing" | "saving" | "success" | "error";

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

// Matches fill-tags.ts's DEFAULT_REPORT_TITLE — kept as a separate constant
// here rather than imported, since that module pulls in the whole PPTX
// generation stack (JSZip etc.) which has no business in the client bundle.
const DEFAULT_REPORT_TITLE = "Weekly Performance Report";

// Sent as real File objects (multipart/form-data), never decoded to text in
// the browser — .xlsx/.xls are binary and non-UTF-8 text files would be
// mis-decoded by File.text() (which always assumes UTF-8). The server
// detects format from file content and decodes/parses appropriately.
const ACCEPTED_FILE_TYPES = ".csv,.tsv,.txt,.xlsx,.xls,.ods";

function buildUploadFormData(
  mtdFile: File,
  periodFile: File | null,
  extra: Record<string, unknown> = {},
): FormData {
  const formData = new FormData();
  formData.append("mtdDailyCsv", mtdFile);
  if (periodFile) formData.append("periodCsv", periodFile);
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

/** validate.ts's "no usable data rows at all" error (see NO_DATA_ROWS_MESSAGE) — rendered as its own amber, actionable warning box rather than lumped into the generic red error list, since it's the one validation failure with real "here's what to check" steps for the user. */
function isNoDataRowsError(e: ValidationIssue): boolean {
  return e.field === "rows";
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
  const [periodFile, setPeriodFile] = useState<File | null>(null);
  const [analyzeStatus, setAnalyzeStatus] = useState<AnalyzeStatus>("idle");
  const [analyzeErrors, setAnalyzeErrors] = useState<ValidationIssue[]>([]);
  const [analyzeMessage, setAnalyzeMessage] = useState<string | null>(null);

  // Step 2 — Campaigns (populated by /analyze). This step is shown, skipped
  // silently, or skipped with an inline confirmation banner on the Dates
  // step instead — see handleAnalyze and lib/nre/campaigns.ts's
  // resolveCampaignSelection, which the /analyze route calls to decide.
  const [campaigns, setCampaigns] = useState<string[]>([]);
  const [selectedCampaigns, setSelectedCampaigns] = useState<Set<string>>(new Set());
  // True only when /analyze resolved a "confirm" step mode — a returning
  // upload, no new campaigns, reusing last time's saved selection. Reset
  // once the user actually walks through the full Campaigns step (via the
  // banner's "Change?" link or manually), so the banner never shows a
  // choice they just made themselves.
  const [campaignSelectionRemembered, setCampaignSelectionRemembered] = useState(false);

  // Step 3 — Dates (populated by /analyze)
  const [dateBounds, setDateBounds] = useState<{ minIso: string; maxIso: string } | null>(null);
  const [weeklyOptions, setWeeklyOptions] = useState<{ last7: DateRangeIso; prev7: DateRangeIso } | null>(null);
  const [mtdRange, setMtdRange] = useState<DateRangeIso | null>(null);
  const [dateMode, setDateMode] = useState<DateMode>("last7");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [customRangeError, setCustomRangeError] = useState<string | null>(null);
  const [longRangeConfirmed, setLongRangeConfirmed] = useState(false);

  // Step 4 — Preview
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>("idle");
  const [previewErrors, setPreviewErrors] = useState<ValidationIssue[]>([]);
  const [previewMessage, setPreviewMessage] = useState<string | null>(null);
  const [data, setData] = useState<ReportData | null>(null);
  const [reportTitle, setReportTitle] = useState(DEFAULT_REPORT_TITLE);

  // Step 4 — Generate (same screen as Preview above, see the step === 4 JSX block)
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
  const [driveSaveStatus, setDriveSaveStatus] = useState<DriveSaveStatus>(
    initialRememberedFolder ? "idle" : "editing",
  );
  const [driveFolderLinkInput, setDriveFolderLinkInput] = useState("");
  const [driveLinkFormatError, setDriveLinkFormatError] = useState<string | null>(null);
  const [driveSaveUrl, setDriveSaveUrl] = useState<string | null>(null);
  const [driveSaveError, setDriveSaveError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
      body: buildUploadFormData(mtdFile, null),
    });
    const json = await res.json().catch(() => null);

    if (!res.ok || !json) {
      setAnalyzeStatus("error");
      setAnalyzeMessage("Something went wrong analyzing the CSV. Please try again.");
      return;
    }
    if (!json.valid) {
      setAnalyzeStatus("invalid");
      setAnalyzeErrors(json.errors || []);
      return;
    }

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
    setAnalyzeStatus("idle");

    // "choose" (first upload for this client, or a genuinely new campaign
    // appeared) is the only case that needs the full Campaigns step — a
    // single campaign or a returning, unchanged selection go straight to
    // Dates, with "confirm" showing a brief reuse notice there instead.
    const campaignStepMode: "skip" | "confirm" | "choose" = json.campaignStepMode || "choose";
    setCampaignSelectionRemembered(campaignStepMode === "confirm");
    setStep(campaignStepMode === "choose" ? 2 : 3);
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

  async function handleCampaignsContinue() {
    await saveSelection({ campaigns, selectedCampaigns: Array.from(selectedCampaigns) });
    // They just reviewed (or changed) the selection themselves — the "same
    // as last time" banner has nothing left to add on the Dates step.
    setCampaignSelectionRemembered(false);
    setStep(3);
  }

  // ── Step 3: Dates ───────────────────────────────────────────────────────
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
    if (!validateCustomRange()) return;
    const spanDays = customSpanDays();
    if (dateMode === "custom" && spanDays !== null && spanDays > 7 && !longRangeConfirmed) {
      return; // the inline "Continue anyway?" prompt handles confirmation
    }

    const dateSelection = currentDateSelection();
    await saveSelection({ dateSelection });

    if (!mtdFile) return;
    setPreviewStatus("loading");
    setPreviewErrors([]);
    setPreviewMessage(null);

    const res = await fetch(`/api/clients/${clientId}/reports/preview`, {
      method: "POST",
      body: buildUploadFormData(mtdFile, periodFile, {
        selectedCampaigns: Array.from(selectedCampaigns),
        dateSelection,
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
    setDriveSaveStatus(rememberedFolder ? "idle" : "editing");
    setDriveFolderLinkInput("");
    setDriveLinkFormatError(null);
    setDriveSaveUrl(null);
    setDriveSaveError(null);
    setCopied(false);
    setStep(4);
  }

  // ── Step 4: Preview + Generate (one screen) ─────────────────────────────
  async function handleGenerate() {
    if (!mtdFile) return;
    setGenerateStatus("loading");
    setGenerateMessage(null);
    setDriveSaveStatus(rememberedFolder ? "idle" : "editing");
    setDriveFolderLinkInput("");
    setDriveLinkFormatError(null);
    setDriveSaveUrl(null);
    setDriveSaveError(null);
    setCopied(false);

    const res = await fetch(`/api/clients/${clientId}/reports`, {
      method: "POST",
      body: buildUploadFormData(mtdFile, periodFile, {
        selectedCampaigns: Array.from(selectedCampaigns),
        dateSelection: currentDateSelection(),
        reportTitle: reportTitle.trim() || DEFAULT_REPORT_TITLE,
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

  async function handleSaveToDrive(folderId: string) {
    if (!reportId) return;
    setDriveSaveStatus("saving");
    setDriveSaveError(null);

    const res = await fetch(`/api/reports/${reportId}/save-to-drive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderId }),
    });
    const json = await res.json().catch(() => null);

    if (!res.ok || !json?.url) {
      setDriveSaveStatus("error");
      setDriveSaveError(json?.message || json?.error || `Request failed with status ${res.status}.`);
      return;
    }

    setDriveSaveUrl(json.url);
    setRememberedFolder({ id: folderId, name: json.folderName || folderId });
    setDriveFolderLinkInput("");
    setDriveSaveStatus("success");
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
    void handleSaveToDrive(folderId);
  }

  async function handleCopyLink() {
    if (!driveSaveUrl) return;
    await navigator.clipboard.writeText(driveSaveUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const spanDays = customSpanDays();
  const needsLongRangeConfirm =
    dateMode === "custom" && spanDays !== null && spanDays > 7 && !customRangeError && !longRangeConfirmed;
  const weeklyRangeIso = currentWeeklyRangeIso();

  return (
    <div className="space-y-6">
      <StepIndicator step={step} />

      {step === 1 && (
        <div className="space-y-4 rounded-lg border border-navy-border bg-navy-panel p-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-secondary">
              MTD Daily CSV <span className="text-red-400">*</span>
            </label>
            <p className="mb-2 text-xs text-ink-muted">
              Meta Ads Manager → Reporting → set date range to month-to-date → Time Increment =
              Daily → Export. CSV, TSV, TXT, or Excel (.xlsx/.xls) — any delimiter or encoding.
            </p>
            <input
              type="file"
              accept={ACCEPTED_FILE_TYPES}
              onChange={(e) => setMtdFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-ink-secondary file:mr-4 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-accent-hover"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-ink-secondary">
              Period CSV — optional
            </label>
            <p className="mb-2 text-xs text-ink-muted">
              Previous full month&apos;s data — upload once at the start of the month, don&apos;t
              re-upload each week.
            </p>
            <input
              type="file"
              accept={ACCEPTED_FILE_TYPES}
              onChange={(e) => setPeriodFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-ink-secondary file:mr-4 file:rounded-md file:border-0 file:bg-navy-border file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:brightness-125"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleAnalyze}
              disabled={!mtdFile || analyzeStatus === "loading"}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
            >
              {analyzeStatus === "loading" ? "Analyzing…" : "Analyze CSV"}
            </button>
            <Link href="/help/download" className="text-sm text-accent hover:underline">
              Not sure how to download? See our guide
            </Link>
          </div>

          {analyzeStatus === "invalid" && (
            <div className="space-y-3">
              {analyzeErrors.filter(isNoDataRowsError).map((e, i) => (
                <NoDataRowsWarning key={i} message={e.message} />
              ))}
              {analyzeErrors.some((e) => !isNoDataRowsError(e)) && (
                <div className="rounded-lg border border-red-900 bg-red-950/40 p-4">
                  <p className="mb-2 text-sm font-medium text-red-300">
                    This CSV can&apos;t be used to generate a report yet:
                  </p>
                  <ul className="list-inside list-disc space-y-1 text-sm text-red-300">
                    {analyzeErrors.filter((e) => !isNoDataRowsError(e)).map((e, i) => (
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
        <div className="space-y-4 rounded-lg border border-navy-border bg-navy-panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-medium text-ink-secondary">Select campaigns to include</h3>
              <p className="text-xs text-ink-muted">
                {selectedCampaigns.size} of {campaigns.length} campaigns selected
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedCampaigns(new Set(campaigns))}
                className="rounded-md border border-navy-border px-3 py-1.5 text-xs text-ink-secondary hover:bg-navy-border"
              >
                Select All
              </button>
              <button
                onClick={() => setSelectedCampaigns(new Set())}
                className="rounded-md border border-navy-border px-3 py-1.5 text-xs text-ink-secondary hover:bg-navy-border"
              >
                Deselect All
              </button>
            </div>
          </div>

          <ul className="divide-y divide-navy-border rounded-lg border border-navy-border">
            {campaigns.map((name) => (
              <li key={name} className="flex items-center gap-3 px-4 py-2.5">
                <input
                  type="checkbox"
                  id={`campaign-${name}`}
                  checked={selectedCampaigns.has(name)}
                  onChange={() => toggleCampaign(name)}
                  className="h-4 w-4 accent-accent"
                />
                <label htmlFor={`campaign-${name}`} className="cursor-pointer text-sm text-white">
                  {name}
                </label>
              </li>
            ))}
          </ul>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="rounded-md border border-navy-border px-4 py-2 text-sm font-medium text-white hover:bg-navy-border"
            >
              Back
            </button>
            <button
              onClick={handleCampaignsContinue}
              disabled={selectedCampaigns.size === 0}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4 rounded-lg border border-navy-border bg-navy-panel p-5">
          <h3 className="text-sm font-medium text-ink-secondary">Reporting period</h3>

          {campaignSelectionRemembered && (
            <p className="rounded-md border border-navy-border bg-navy px-3 py-2 text-xs text-ink-secondary">
              Using same campaign selection as last time ({selectedCampaigns.size} of {campaigns.length} campaigns).{" "}
              <button onClick={() => setStep(2)} className="text-accent hover:underline">
                Change?
              </button>
            </p>
          )}

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-ink-muted">Weekly period</p>

            {weeklyOptions && (
              <DateModeOption
                id="mode-last7"
                checked={dateMode === "last7"}
                onSelect={() => {
                  setDateMode("last7");
                  setCustomRangeError(null);
                }}
                label="Last 7 days ending yesterday"
                sublabel={formatIsoRange(weeklyOptions.last7)}
              />
            )}
            {weeklyOptions && (
              <DateModeOption
                id="mode-prev7"
                checked={dateMode === "prev7"}
                onSelect={() => {
                  setDateMode("prev7");
                  setCustomRangeError(null);
                }}
                label="Previous 7 days"
                sublabel={formatIsoRange(weeklyOptions.prev7)}
              />
            )}
            <DateModeOption
              id="mode-custom"
              checked={dateMode === "custom"}
              onSelect={() => setDateMode("custom")}
              label="Custom date range"
              sublabel={
                dateBounds ? `CSV covers ${formatIso(dateBounds.minIso)} - ${formatIso(dateBounds.maxIso)}` : undefined
              }
            />

            {dateMode === "custom" && (
              <div className="ml-7 space-y-3 rounded-md border border-navy-border p-3">
                <div className="flex flex-wrap gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-ink-muted">Start date</label>
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
                      className="rounded-md border border-navy-border bg-navy px-2 py-1.5 text-sm text-white outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-ink-muted">End date</label>
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
                      className="rounded-md border border-navy-border bg-navy px-2 py-1.5 text-sm text-white outline-none focus:border-accent"
                    />
                  </div>
                </div>

                {customRangeError && <p className="text-xs text-red-400">{customRangeError}</p>}

                {needsLongRangeConfirm && (
                  <div className="rounded-md border border-amber-900 bg-amber-950/30 p-3">
                    <p className="mb-2 text-xs text-amber-200">
                      Weekly reports work best with 7 days or less. Continue anyway?
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setLongRangeConfirmed(true)}
                        className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-white hover:bg-accent-hover"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setCustomEnd("")}
                        className="rounded-md border border-navy-border px-3 py-1 text-xs text-ink-secondary hover:bg-navy-border"
                      >
                        No
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-ink-muted">MTD period</p>
            <p className="mt-1 text-sm text-white">
              {mtdRange ? `MTD period: ${formatIsoRange(mtdRange)} (auto)` : "MTD period unavailable"}
            </p>
          </div>

          {previewStatus === "invalid" && (
            <div className="space-y-3">
              {previewErrors.filter(isNoDataRowsError).map((e, i) => (
                <NoDataRowsWarning key={i} message={e.message} />
              ))}
              {previewErrors.some((e) => !isNoDataRowsError(e)) && (
                <div className="rounded-lg border border-red-900 bg-red-950/40 p-4">
                  <p className="mb-2 text-sm font-medium text-red-300">Can&apos;t build a preview yet:</p>
                  <ul className="list-inside list-disc space-y-1 text-sm text-red-300">
                    {previewErrors.filter((e) => !isNoDataRowsError(e)).map((e, i) => (
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
              onClick={() => setStep(2)}
              className="rounded-md border border-navy-border px-4 py-2 text-sm font-medium text-white hover:bg-navy-border"
            >
              Back
            </button>
            <button
              onClick={handleDatesContinue}
              disabled={
                previewStatus === "loading" ||
                (dateMode === "custom" && (!customStart || !customEnd)) ||
                needsLongRangeConfirm
              }
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
            >
              {previewStatus === "loading" ? "Loading preview…" : "Continue"}
            </button>
          </div>
        </div>
      )}

      {step === 4 && data && (
        <div className="space-y-6">
          <ReportPreview data={data} />

          <div className="rounded-lg border border-navy-border bg-navy-panel p-4 text-sm text-ink-secondary">
            Generating report for {selectedCampaigns.size} campaign{selectedCampaigns.size === 1 ? "" : "s"}
            {weeklyRangeIso && <> — Week: {formatIsoRange(weeklyRangeIso)}</>}
            {mtdRange && <> — MTD: {formatIsoRange(mtdRange)}</>}
          </div>

          <div>
            <label className="mb-1 block text-sm text-ink-secondary">Report title</label>
            <input
              value={reportTitle}
              onChange={(e) => setReportTitle(e.target.value)}
              placeholder={DEFAULT_REPORT_TITLE}
              maxLength={100}
              disabled={generateStatus === "loading" || generateStatus === "done"}
              className="w-full max-w-md rounded-md border border-navy-border bg-navy-panel px-3 py-2 text-sm text-white outline-none focus:border-accent disabled:opacity-60"
            />
            <p className="mt-1 text-xs text-ink-muted">
              Shown on the cover slide in place of &quot;{DEFAULT_REPORT_TITLE}&quot; — e.g. &quot;Monthly Campaign Summary&quot; or &quot;Q3 Performance Review&quot;.
            </p>
          </div>

          {/* Same screen throughout: only this action row changes as
              generateStatus moves idle -> loading -> done/error, so there's
              no navigation between "getting ready" and "here's your file". */}
          {generateStatus === "idle" && (
            <div className="flex gap-3">
              <button
                onClick={() => setStep(3)}
                className="rounded-md border border-navy-border px-4 py-2 text-sm font-medium text-white hover:bg-navy-border"
              >
                Back
              </button>
              <button
                onClick={handleGenerate}
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
              >
                Generate & download PPTX
              </button>
            </div>
          )}

          {generateStatus === "loading" && (
            <div className="flex items-center gap-3 rounded-lg border border-navy-border bg-navy-panel p-4 text-sm text-ink-secondary">
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
                  onClick={() => setStep(3)}
                  className="rounded-md border border-navy-border px-4 py-2 text-sm font-medium text-white hover:bg-navy-border"
                >
                  Back
                </button>
                <button
                  onClick={handleGenerate}
                  className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {generateStatus === "done" && downloadUrl && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-3">
                <a
                  href={downloadUrl}
                  className="inline-block rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
                >
                  Download PPTX
                </a>
                {hasGoogleDriveConnected &&
                  driveSaveStatus !== "editing" &&
                  driveSaveStatus !== "success" &&
                  rememberedFolder && (
                    <button
                      onClick={() => void handleSaveToDrive(rememberedFolder.id)}
                      disabled={driveSaveStatus === "saving"}
                      className="inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
                    >
                      {driveSaveStatus === "saving"
                        ? "Saving to Drive…"
                        : driveSaveStatus === "error"
                          ? "Try Again"
                          : "Save to Google Drive"}
                    </button>
                  )}
              </div>

              {hasGoogleDriveConnected && driveSaveStatus !== "editing" && driveSaveStatus !== "success" && rememberedFolder && (
                <p className="text-xs text-ink-secondary">
                  Saving to: <span className="text-white">{rememberedFolder.name}</span>{" "}
                  <span className="text-emerald-400" aria-hidden="true">✓</span>{" "}
                  <button
                    type="button"
                    onClick={() => setDriveSaveStatus("editing")}
                    className="text-accent hover:underline"
                  >
                    Change
                  </button>
                </p>
              )}

              {hasGoogleDriveConnected && driveSaveStatus === "editing" && (
                <div className="space-y-2 rounded-lg border border-navy-border bg-navy-panel p-4">
                  <label className="block text-sm text-ink-secondary">Paste your Google Drive folder link:</label>
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="text"
                      value={driveFolderLinkInput}
                      onChange={(e) => {
                        setDriveFolderLinkInput(e.target.value);
                        setDriveLinkFormatError(null);
                      }}
                      placeholder="https://drive.google.com/drive/folders/1ABC123xyz"
                      className="min-w-[240px] flex-1 rounded-md border border-navy-border bg-navy px-3 py-2 text-sm text-white outline-none focus:border-accent"
                    />
                    <button
                      onClick={handleSaveToFolderLink}
                      disabled={!driveFolderLinkInput.trim()}
                      className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
                    >
                      Save to this folder
                    </button>
                    {rememberedFolder && (
                      <button
                        type="button"
                        onClick={() => {
                          setDriveSaveStatus("idle");
                          setDriveFolderLinkInput("");
                          setDriveLinkFormatError(null);
                        }}
                        className="rounded-md border border-navy-border px-3 py-2 text-xs text-ink-secondary hover:bg-navy-border"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-ink-muted">
                    Open Google Drive → navigate to your folder → right-click → Get link → Copy link → paste it here
                  </p>
                  {driveLinkFormatError && <p className="text-xs text-red-400">{driveLinkFormatError}</p>}
                </div>
              )}

              {driveSaveStatus === "saving" && (
                <div className="flex items-center gap-3 text-sm text-ink-secondary">
                  <Spinner />
                  Saving to Google Drive…
                </div>
              )}

              {driveSaveStatus === "error" && driveSaveError && (
                <p className="text-sm text-red-400">{driveSaveError}</p>
              )}

              {driveSaveStatus === "success" && driveSaveUrl && (
                <div className="rounded-lg border border-emerald-800 bg-emerald-950/30 p-4">
                  <p className="mb-2 text-xs uppercase tracking-wide text-emerald-300">
                    Saved to Google Drive ✓
                  </p>
                  <a
                    href={driveSaveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mb-3 block break-all text-sm text-accent hover:underline"
                  >
                    {driveSaveUrl}
                  </a>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={handleCopyLink}
                      className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover"
                    >
                      <CopyIcon />
                      {copied ? "Copied!" : "Copy Link"}
                    </button>
                    <a
                      href={buildWhatsAppShareUrl(driveSaveUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md border border-navy-border bg-navy px-3 py-1.5 text-xs text-ink-secondary hover:bg-navy-border"
                    >
                      <WhatsAppIcon />
                      WhatsApp
                    </a>
                    <a
                      href={buildEmailShareUrl(driveSaveUrl)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-navy-border bg-navy px-3 py-1.5 text-xs text-ink-secondary hover:bg-navy-border"
                    >
                      <MailIcon />
                      Email
                    </a>
                  </div>
                  <button
                    onClick={() => {
                      setDriveSaveStatus("editing");
                      setDriveSaveUrl(null);
                    }}
                    className="mt-3 text-xs text-ink-muted hover:underline"
                  >
                    Save to a different folder
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StepIndicator({ step }: { step: Step }) {
  const steps: Step[] = [1, 2, 3, 4];
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <span
            className={
              s === step
                ? "rounded-full bg-accent px-3 py-1 font-medium text-white"
                : s < step
                  ? "rounded-full border border-accent px-3 py-1 text-accent"
                  : "rounded-full border border-navy-border px-3 py-1 text-ink-muted"
            }
          >
            {STEP_LABELS[s]}
          </span>
          {i < steps.length - 1 && <span className="text-ink-muted">→</span>}
        </div>
      ))}
    </div>
  );
}

/** Small inline spinner for the Preview screen's "Generating your report…" state — no extra dependency needed for one spinning icon. */
function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin text-accent" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

function DateModeOption({
  id,
  checked,
  onSelect,
  label,
  sublabel,
}: {
  id: string;
  checked: boolean;
  onSelect: () => void;
  label: string;
  sublabel?: string;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-3 rounded-md border border-navy-border p-3 hover:bg-navy-border/40"
    >
      <input
        type="radio"
        id={id}
        checked={checked}
        onChange={onSelect}
        className="mt-0.5 h-4 w-4 accent-accent"
      />
      <span>
        <span className="block text-sm text-white">{label}</span>
        {sublabel && <span className="block text-xs text-ink-muted">{sublabel}</span>}
      </span>
    </label>
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

      <div className="rounded-lg border border-navy-border bg-navy-panel p-4">
        <p className="text-xs uppercase tracking-wide text-ink-muted">Cover</p>
        <p className="mt-1 text-white">{data.cover.dateRange}</p>
        <p className="text-sm text-ink-secondary">{data.cover.healthBadge}</p>
        {data.cover.budgetSummary && (
          <p className="mt-1 text-xs text-ink-muted">{data.cover.budgetSummary}</p>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs uppercase tracking-wide text-ink-muted">
          Campaign summary slides ({data.campaignSlides.length})
        </p>
        <ul className="divide-y divide-navy-border rounded-lg border border-navy-border bg-navy-panel">
          {data.campaignSlides.map((s) => (
            <li key={s.campaignName} className="flex items-center justify-between px-4 py-2 text-sm">
              <span className="text-white">{s.campaignName}</span>
              <span className="text-ink-muted">
                {s.metrics.spend} · {s.resultLabel} {s.metrics.results} · {s.metrics.cpr}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {data.adSetSlides.length > 0 && (
        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-ink-muted">
            Ad set slides ({data.adSetSlides.length})
          </p>
          <ul className="divide-y divide-navy-border rounded-lg border border-navy-border bg-navy-panel">
            {data.adSetSlides.map((s) => (
              <li
                key={`${s.campaignName}/${s.adSetName}`}
                className="flex items-center justify-between px-4 py-2 text-sm"
              >
                <span className="text-white">
                  {s.campaignName} / {s.adSetName}
                </span>
                <span className="text-ink-muted">
                  {s.metrics.spend} · {s.resultLabel} {s.metrics.results}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-navy-border bg-navy-panel p-4">
          <p className="text-xs uppercase tracking-wide text-ink-muted">Period ({data.periodRow.monthLabel})</p>
          <p className="mt-1 text-sm text-white">{data.periodRow.spend}</p>
        </div>
        <div className="rounded-lg border border-navy-border bg-navy-panel p-4">
          <p className="text-xs uppercase tracking-wide text-ink-muted">MTD ({data.mtdRow.monthLabel})</p>
          <p className="mt-1 text-sm text-white">{data.mtdRow.spend}</p>
        </div>
      </div>
    </div>
  );
}
