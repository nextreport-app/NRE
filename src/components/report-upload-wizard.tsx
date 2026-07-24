"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import type { ReportData } from "@/lib/nre/report-data";
import type { ValidationIssue } from "@/lib/nre/validate";

type Status = "idle" | "analyzing" | "invalid" | "preview" | "generating" | "done" | "error";
type SlidesStatus = "idle" | "loading" | "ready" | "not_connected" | "error";

// Sent as real File objects (multipart/form-data), never decoded to text in
// the browser — .xlsx/.xls are binary and non-UTF-8 text files would be
// mis-decoded by File.text() (which always assumes UTF-8). The server
// detects format from file content and decodes/parses appropriately.
const ACCEPTED_FILE_TYPES = ".csv,.tsv,.txt,.xlsx,.xls,.ods";

function buildUploadFormData(mtdFile: File, periodFile: File | null): FormData {
  const formData = new FormData();
  formData.append("mtdDailyCsv", mtdFile);
  if (periodFile) formData.append("periodCsv", periodFile);
  return formData;
}

export function ReportUploadWizard({ clientId }: { clientId: string }) {
  const [mtdFile, setMtdFile] = useState<File | null>(null);
  const [periodFile, setPeriodFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<ValidationIssue[]>([]);
  const [data, setData] = useState<ReportData | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [slidesStatus, setSlidesStatus] = useState<SlidesStatus>("idle");
  const [slidesUrl, setSlidesUrl] = useState<string | null>(null);

  async function handleAnalyze() {
    if (!mtdFile) return;
    setStatus("analyzing");
    setErrors([]);
    setMessage(null);

    const res = await fetch(`/api/clients/${clientId}/reports/preview`, {
      method: "POST",
      body: buildUploadFormData(mtdFile, periodFile),
    });
    const json = await res.json().catch(() => null);

    if (!res.ok || !json) {
      setStatus("error");
      setMessage("Something went wrong analyzing the CSV. Please try again.");
      return;
    }

    if (!json.valid) {
      setStatus("invalid");
      setErrors(json.errors || []);
      return;
    }

    setData(json.data);
    setStatus("preview");
  }

  async function handleGenerate() {
    if (!mtdFile) return;
    setStatus("generating");
    setMessage(null);

    const res = await fetch(`/api/clients/${clientId}/reports`, {
      method: "POST",
      body: buildUploadFormData(mtdFile, periodFile),
    });
    const json = await res.json().catch(() => null);

    if (!res.ok || !json?.ok) {
      setStatus("error");
      setMessage(json?.error || "Report generation failed. Please try again.");
      return;
    }

    setReportId(json.reportId);
    setDownloadUrl(`/api/reports/${json.reportId}/download`);
    setStatus("done");
  }

  async function handleGetSlidesLink() {
    if (!reportId) return;
    setSlidesStatus("loading");

    // Must open the tab synchronously in this click handler, before the
    // `await` below — otherwise most browsers treat it as a popup and block
    // it. We point it at the real link once the upload finishes.
    const slidesWindow = window.open("", "_blank");

    const res = await fetch(`/api/reports/${reportId}/slides`, { method: "POST" });
    const json = await res.json().catch(() => null);

    if (!res.ok || !json?.url) {
      slidesWindow?.close();
      setSlidesStatus(json?.error === "google_drive_not_connected" ? "not_connected" : "error");
      return;
    }

    setSlidesUrl(json.url);
    setSlidesStatus("ready");
    if (slidesWindow) slidesWindow.location.href = json.url;
  }

  async function handleConnectGoogleDrive() {
    await signIn("google", { callbackUrl: window.location.href });
  }

  return (
    <div className="space-y-8">
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
            Previous full month's data — upload once at the start of the month, don't re-upload
            each week.
          </p>
          <input
            type="file"
            accept={ACCEPTED_FILE_TYPES}
            onChange={(e) => setPeriodFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-ink-secondary file:mr-4 file:rounded-md file:border-0 file:bg-navy-border file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:brightness-125"
          />
        </div>

        <button
          onClick={handleAnalyze}
          disabled={!mtdFile || status === "analyzing"}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {status === "analyzing" ? "Analyzing…" : "Analyze CSV"}
        </button>
      </div>

      {status === "invalid" && (
        <div className="rounded-lg border border-red-900 bg-red-950/40 p-4">
          <p className="mb-2 text-sm font-medium text-red-300">
            This CSV can&apos;t be used to generate a report yet:
          </p>
          <ul className="list-inside list-disc space-y-1 text-sm text-red-300">
            {errors.map((e, i) => (
              <li key={i}>{e.message}</li>
            ))}
          </ul>
        </div>
      )}

      {status === "error" && message && (
        <div className="rounded-lg border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
          {message}
        </div>
      )}

      {(status === "preview" || status === "generating" || status === "done") && data && (
        <div className="space-y-6">
          <ReportPreview data={data} />

          {status !== "done" ? (
            <button
              onClick={handleGenerate}
              disabled={status === "generating"}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
            >
              {status === "generating" ? "Generating PPTX…" : "Generate & download PPTX"}
            </button>
          ) : (
            downloadUrl && (
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
                  <p className="text-sm text-red-400">
                    Something went wrong creating the Google Slides link. Please try again.
                  </p>
                )}
              </div>
            )
          )}
        </div>
      )}
    </div>
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
