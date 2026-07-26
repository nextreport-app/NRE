"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import type { ReportData } from "@/lib/nre/report-data";
import type { ValidationIssue } from "@/lib/nre/validate";
import { adSetKey, type AdSetGroup } from "@/lib/nre/ad-sets";

type Step = 1 | 2 | 3 | 4 | 5 | 6;
const STEP_LABELS: Record<Step, string> = {
  1: "Upload",
  2: "Campaigns",
  3: "Ad Sets",
  4: "Dates",
  5: "Preview",
  6: "Generate",
};

type AnalyzeStatus = "idle" | "loading" | "invalid" | "error";
type PreviewStatus = "idle" | "loading" | "invalid" | "error";
type GenerateStatus = "idle" | "loading" | "done" | "error";
type SlidesStatus = "idle" | "loading" | "ready" | "not_connected" | "error";
type DateMode = "last7" | "prev7" | "custom";

interface DateRangeIso {
  startIso: string;
  endIso: string;
}

interface DateSelection {
  mode: DateMode;
  customStart?: string;
  customEnd?: string;
}

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

export function ReportUploadWizard({ clientId }: { clientId: string }) {
  const [step, setStep] = useState<Step>(1);

  // Step 1 — Upload
  const [mtdFile, setMtdFile] = useState<File | null>(null);
  const [periodFile, setPeriodFile] = useState<File | null>(null);
  const [analyzeStatus, setAnalyzeStatus] = useState<AnalyzeStatus>("idle");
  const [analyzeErrors, setAnalyzeErrors] = useState<ValidationIssue[]>([]);
  const [analyzeMessage, setAnalyzeMessage] = useState<string | null>(null);

  // Step 2 — Campaigns (populated by /analyze)
  const [campaigns, setCampaigns] = useState<string[]>([]);
  const [selectedCampaigns, setSelectedCampaigns] = useState<Set<string>>(new Set());

  // Step 3 — Ad Sets (populated by /analyze), keyed by adSetKey(campaign, adSet)
  const [adSetGroups, setAdSetGroups] = useState<AdSetGroup[]>([]);
  const [selectedAdSets, setSelectedAdSets] = useState<Set<string>>(new Set());

  // Step 4 — Dates (populated by /analyze)
  const [dateBounds, setDateBounds] = useState<{ minIso: string; maxIso: string } | null>(null);
  const [weeklyOptions, setWeeklyOptions] = useState<{ last7: DateRangeIso; prev7: DateRangeIso } | null>(null);
  const [mtdRange, setMtdRange] = useState<DateRangeIso | null>(null);
  const [dateMode, setDateMode] = useState<DateMode>("last7");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [customRangeError, setCustomRangeError] = useState<string | null>(null);
  const [longRangeConfirmed, setLongRangeConfirmed] = useState(false);

  // Step 5 — Preview
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>("idle");
  const [previewErrors, setPreviewErrors] = useState<ValidationIssue[]>([]);
  const [previewMessage, setPreviewMessage] = useState<string | null>(null);
  const [data, setData] = useState<ReportData | null>(null);

  // Step 6 — Generate
  const [generateStatus, setGenerateStatus] = useState<GenerateStatus>("idle");
  const [generateMessage, setGenerateMessage] = useState<string | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [slidesStatus, setSlidesStatus] = useState<SlidesStatus>("idle");
  const [slidesUrl, setSlidesUrl] = useState<string | null>(null);
  const [slidesError, setSlidesError] = useState<string | null>(null);

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
    adSets?: string[];
    selectedAdSets?: string[];
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
    setAdSetGroups(json.adSetGroups || []);
    setSelectedAdSets(new Set<string>(json.selectedAdSets || []));
    setDateBounds(json.dateBounds || null);
    setWeeklyOptions(json.weeklyOptions || null);
    setMtdRange(json.mtdRange || null);
    const savedSelection: DateSelection = json.dateSelection || { mode: "last7" };
    setDateMode(savedSelection.mode);
    setCustomStart(savedSelection.customStart || "");
    setCustomEnd(savedSelection.customEnd || "");
    setLongRangeConfirmed(false);
    setAnalyzeStatus("idle");
    setStep(2);
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
    setStep(3);
  }

  // ── Step 3: Ad Sets ─────────────────────────────────────────────────────
  // Only ad sets belonging to a currently-selected campaign are shown —
  // deselecting a campaign back in step 2 hides its ad-set group here
  // without losing whatever ad-set choices were made for it (they reappear
  // if the campaign gets re-selected).
  const visibleAdSetGroups = adSetGroups.filter((g) => selectedCampaigns.has(g.campaignName));
  const totalVisibleAdSets = visibleAdSetGroups.reduce((sum, g) => sum + g.adSetNames.length, 0);
  const totalSelectedVisibleAdSets = visibleAdSetGroups.reduce(
    (sum, g) => sum + g.adSetNames.filter((name) => selectedAdSets.has(adSetKey(g.campaignName, name))).length,
    0,
  );

  function toggleAdSet(campaignName: string, adSetName: string) {
    const key = adSetKey(campaignName, adSetName);
    const next = new Set(selectedAdSets);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelectedAdSets(next);

    // Cascade: a campaign with zero selected ad sets is dropped from the
    // report entirely (and its checkbox reflects that back in step 2); one
    // with at least one re-checked ad set is restored.
    const group = adSetGroups.find((g) => g.campaignName === campaignName);
    const anySelected = group ? group.adSetNames.some((name) => next.has(adSetKey(campaignName, name))) : false;
    setSelectedCampaigns((prev) => {
      const nextCampaigns = new Set(prev);
      if (anySelected) nextCampaigns.add(campaignName);
      else nextCampaigns.delete(campaignName);
      return nextCampaigns;
    });
  }

  function selectAllAdSets() {
    setSelectedAdSets((prev) => {
      const next = new Set(prev);
      for (const g of visibleAdSetGroups) for (const name of g.adSetNames) next.add(adSetKey(g.campaignName, name));
      return next;
    });
  }

  function deselectAllAdSets() {
    setSelectedAdSets((prev) => {
      const next = new Set(prev);
      for (const g of visibleAdSetGroups) for (const name of g.adSetNames) next.delete(adSetKey(g.campaignName, name));
      return next;
    });
    // Every visible campaign now has zero selected ad sets — drop them all.
    setSelectedCampaigns((prev) => {
      const next = new Set(prev);
      for (const g of visibleAdSetGroups) next.delete(g.campaignName);
      return next;
    });
  }

  function selectAllForCampaign(campaignName: string) {
    const group = adSetGroups.find((g) => g.campaignName === campaignName);
    if (!group) return;
    setSelectedAdSets((prev) => {
      const next = new Set(prev);
      for (const name of group.adSetNames) next.add(adSetKey(campaignName, name));
      return next;
    });
    setSelectedCampaigns((prev) => new Set(prev).add(campaignName));
  }

  function deselectAllForCampaign(campaignName: string) {
    const group = adSetGroups.find((g) => g.campaignName === campaignName);
    if (!group) return;
    setSelectedAdSets((prev) => {
      const next = new Set(prev);
      for (const name of group.adSetNames) next.delete(adSetKey(campaignName, name));
      return next;
    });
    setSelectedCampaigns((prev) => {
      const next = new Set(prev);
      next.delete(campaignName);
      return next;
    });
  }

  // `undefined` (not `[]`) when the CSV has no ad-set data at all — an empty
  // array means "deliberately nothing selected" downstream and would filter
  // every row out, when what we actually want is "no ad-set filtering was
  // possible, don't filter by it at all" (report generates at campaign
  // level only, per the Ad Sets step's own warning for this case).
  function selectedAdSetsForRequest(): string[] | undefined {
    return adSetGroups.length === 0 ? undefined : Array.from(selectedAdSets);
  }

  async function handleAdSetsContinue() {
    if (adSetGroups.length > 0) {
      const allAdSetKeys = adSetGroups.flatMap((g) => g.adSetNames.map((name) => adSetKey(g.campaignName, name)));
      await saveSelection({ adSets: allAdSetKeys, selectedAdSets: Array.from(selectedAdSets) });
    }
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
        selectedAdSets: selectedAdSetsForRequest(),
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
    setStep(5);
  }

  // ── Step 5 -> 6: Generate ───────────────────────────────────────────────
  async function handleGenerate() {
    if (!mtdFile) return;
    setGenerateStatus("loading");
    setGenerateMessage(null);
    setStep(6);

    const res = await fetch(`/api/clients/${clientId}/reports`, {
      method: "POST",
      body: buildUploadFormData(mtdFile, periodFile, {
        selectedCampaigns: Array.from(selectedCampaigns),
        selectedAdSets: selectedAdSetsForRequest(),
        dateSelection: currentDateSelection(),
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

  async function handleGetSlidesLink() {
    if (!reportId) return;
    setSlidesStatus("loading");
    setSlidesError(null);

    // Must open the tab synchronously in this click handler, before the
    // `await` below — otherwise most browsers treat it as a popup and block
    // it. We point it at the real link once the upload finishes.
    const slidesWindow = window.open("", "_blank");

    const res = await fetch(`/api/reports/${reportId}/slides`, { method: "POST" });
    const json = await res.json().catch(() => null);

    if (!res.ok || !json?.url) {
      slidesWindow?.close();
      if (json?.error === "google_drive_not_connected") {
        setSlidesStatus("not_connected");
      } else {
        setSlidesError(json?.error || `Request failed with status ${res.status}.`);
        setSlidesStatus("error");
      }
      return;
    }

    setSlidesUrl(json.url);
    setSlidesStatus("ready");
    if (slidesWindow) slidesWindow.location.href = json.url;
  }

  async function handleConnectGoogleDrive() {
    await signIn("google", { callbackUrl: window.location.href });
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
            <div className="rounded-lg border border-red-900 bg-red-950/40 p-4">
              <p className="mb-2 text-sm font-medium text-red-300">
                This CSV can&apos;t be used to generate a report yet:
              </p>
              <ul className="list-inside list-disc space-y-1 text-sm text-red-300">
                {analyzeErrors.map((e, i) => (
                  <li key={i}>{e.message}</li>
                ))}
              </ul>
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
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-medium text-ink-secondary">Select ad sets to include</h3>
            <InfoTooltip text="Ad set names must be included in your CSV for ad set level filtering. Download from Ad Reporting section for best results." />
          </div>

          {adSetGroups.length === 0 ? (
            <div className="rounded-lg border border-amber-900 bg-amber-950/30 p-4 text-sm text-amber-200">
              <p className="mb-2 font-medium">No ad set names found in your CSV.</p>
              <p className="mb-2">
                This usually happens when downloading from the Meta Ads Manager Campaigns screen without
                including the Ad Set Name column.
              </p>
              <p className="mb-1">You can either:</p>
              <ul className="mb-2 list-inside list-disc space-y-1">
                <li>
                  Re-download your CSV from the Ad Reporting section (recommended) which includes Ad Set
                  Name automatically
                </li>
                <li>Or re-download from the Campaigns screen and make sure Ad Set Name is added to your column preset</li>
              </ul>
              <p>
                See our{" "}
                <Link href="/help/download" className="underline hover:text-amber-100">
                  Download Guide
                </Link>{" "}
                for step by step instructions.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-ink-muted">
                  {totalSelectedVisibleAdSets} of {totalVisibleAdSets} ad sets selected
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={selectAllAdSets}
                    className="rounded-md border border-navy-border px-3 py-1.5 text-xs text-ink-secondary hover:bg-navy-border"
                  >
                    Select All
                  </button>
                  <button
                    onClick={deselectAllAdSets}
                    className="rounded-md border border-navy-border px-3 py-1.5 text-xs text-ink-secondary hover:bg-navy-border"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              {visibleAdSetGroups.length === 0 && (
                <p className="rounded-lg border border-navy-border p-4 text-sm text-ink-muted">
                  No ad sets found for the selected campaigns.
                </p>
              )}

              <div className="space-y-4">
                {visibleAdSetGroups.map((group, groupIdx) => (
                  <div key={group.campaignName} className="rounded-lg border border-navy-border">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-navy-border bg-navy px-4 py-2">
                      <span className="text-sm font-medium text-ink-secondary">
                        {group.campaignName} <span className="text-ink-muted">(Campaign)</span>
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => selectAllForCampaign(group.campaignName)}
                          className="rounded-md border border-navy-border px-2 py-1 text-xs text-ink-secondary hover:bg-navy-border"
                        >
                          Select All
                        </button>
                        <button
                          onClick={() => deselectAllForCampaign(group.campaignName)}
                          className="rounded-md border border-navy-border px-2 py-1 text-xs text-ink-secondary hover:bg-navy-border"
                        >
                          Deselect All
                        </button>
                      </div>
                    </div>
                    <ul className="divide-y divide-navy-border">
                      {group.adSetNames.map((adSetName, adSetIdx) => {
                        const key = adSetKey(group.campaignName, adSetName);
                        // A DOM id can't safely hold adSetKey's raw composite
                        // string (it embeds a NUL separator) — index-based is
                        // simple, unique, and stable across this list's render.
                        const inputId = `adset-${groupIdx}-${adSetIdx}`;
                        return (
                          <li key={key} className="flex items-center gap-3 px-4 py-2.5 pl-8">
                            <input
                              type="checkbox"
                              id={inputId}
                              checked={selectedAdSets.has(key)}
                              onChange={() => toggleAdSet(group.campaignName, adSetName)}
                              className="h-4 w-4 accent-accent"
                            />
                            <label htmlFor={inputId} className="cursor-pointer text-sm text-white">
                              {adSetName}
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep(2)}
              className="rounded-md border border-navy-border px-4 py-2 text-sm font-medium text-white hover:bg-navy-border"
            >
              Back
            </button>
            <button
              onClick={handleAdSetsContinue}
              disabled={adSetGroups.length > 0 && totalSelectedVisibleAdSets === 0}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4 rounded-lg border border-navy-border bg-navy-panel p-5">
          <h3 className="text-sm font-medium text-ink-secondary">Reporting period</h3>

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
            <div className="rounded-lg border border-red-900 bg-red-950/40 p-4">
              <p className="mb-2 text-sm font-medium text-red-300">Can&apos;t build a preview yet:</p>
              <ul className="list-inside list-disc space-y-1 text-sm text-red-300">
                {previewErrors.map((e, i) => (
                  <li key={i}>{e.message}</li>
                ))}
              </ul>
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

      {step === 5 && data && (
        <div className="space-y-6">
          <ReportPreview data={data} />

          <div className="rounded-lg border border-navy-border bg-navy-panel p-4 text-sm text-ink-secondary">
            Generating report for {selectedCampaigns.size} campaign{selectedCampaigns.size === 1 ? "" : "s"}
            {weeklyRangeIso && <> — Week: {formatIsoRange(weeklyRangeIso)}</>}
            {mtdRange && <> — MTD: {formatIsoRange(mtdRange)}</>}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(4)}
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
        </div>
      )}

      {step === 6 && (
        <div className="space-y-4">
          {generateStatus === "loading" && (
            <div className="rounded-lg border border-navy-border bg-navy-panel p-4 text-sm text-ink-secondary">
              Generating PPTX…
            </div>
          )}

          {generateStatus === "error" && (
            <div className="space-y-3">
              <div className="rounded-lg border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
                {generateMessage}
              </div>
              <button
                onClick={() => setStep(5)}
                className="rounded-md border border-navy-border px-4 py-2 text-sm font-medium text-white hover:bg-navy-border"
              >
                Back
              </button>
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
                <button
                  onClick={handleGetSlidesLink}
                  disabled={slidesStatus === "loading"}
                  className="inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
                >
                  {slidesStatus === "loading" ? "Creating Google Slides…" : "Get Google Slides Link"}
                </button>
              </div>

              {slidesStatus === "ready" && slidesUrl && (
                <div className="rounded-lg border border-navy-border bg-navy-panel p-4">
                  <p className="mb-2 text-xs uppercase tracking-wide text-ink-muted">
                    Shareable Google Slides link — anyone with the link can view
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <a
                      href={slidesUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-accent hover:underline break-all"
                    >
                      {slidesUrl}
                    </a>
                    <button
                      onClick={() => navigator.clipboard.writeText(slidesUrl)}
                      className="rounded-md border border-navy-border px-3 py-1 text-xs text-ink-secondary hover:bg-navy-border"
                    >
                      Copy link
                    </button>
                  </div>
                </div>
              )}

              {slidesStatus === "not_connected" && (
                <div className="rounded-lg border border-amber-900 bg-amber-950/30 p-4 text-sm text-amber-200">
                  <p className="mb-2">
                    Connect Google Drive to create a Google Slides link for this report.
                  </p>
                  <button
                    onClick={handleConnectGoogleDrive}
                    className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover"
                  >
                    Connect Google Drive
                  </button>
                </div>
              )}

              {slidesStatus === "error" && (
                <p className="break-words text-sm text-red-400">
                  {slidesError || "Something went wrong creating the Google Slides link. Please try again."}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Small "(i)" badge with a native tooltip on hover/focus — no extra dependency needed for a single static hint. */
function InfoTooltip({ text }: { text: string }) {
  return (
    <span
      tabIndex={0}
      title={text}
      aria-label={text}
      className="inline-flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded-full border border-ink-muted text-[10px] leading-none text-ink-muted hover:border-accent hover:text-accent"
    >
      i
    </span>
  );
}

function StepIndicator({ step }: { step: Step }) {
  const steps: Step[] = [1, 2, 3, 4, 5, 6];
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
