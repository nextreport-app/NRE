"use client";

import { useState } from "react";
import type { ReportData } from "@/lib/nre/report-data";
import type { ValidationIssue } from "@/lib/nre/validate";

type Status = "idle" | "analyzing" | "invalid" | "preview" | "generating" | "done" | "error";

async function readFileText(file: File | null): Promise<string> {
  if (!file) return "";
  return file.text();
}

export function ReportUploadWizard({ clientId }: { clientId: string }) {
  const [mtdFile, setMtdFile] = useState<File | null>(null);
  const [periodFile, setPeriodFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<ValidationIssue[]>([]);
  const [data, setData] = useState<ReportData | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleAnalyze() {
    if (!mtdFile) return;
    setStatus("analyzing");
    setErrors([]);
    setMessage(null);

    const [mtdDailyCsv, periodCsv] = await Promise.all([
      readFileText(mtdFile),
      readFileText(periodFile),
    ]);

    const res = await fetch(`/api/clients/${clientId}/reports/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mtdDailyCsv, periodCsv }),
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

    const [mtdDailyCsv, periodCsv] = await Promise.all([
      readFileText(mtdFile),
      readFileText(periodFile),
    ]);

    const res = await fetch(`/api/clients/${clientId}/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mtdDailyCsv, periodCsv }),
    });
    const json = await res.json().catch(() => null);

    if (!res.ok || !json?.ok) {
      setStatus("error");
      setMessage(json?.error || "Report generation failed. Please try again.");
      return;
    }

    setDownloadUrl(`/api/reports/${json.reportId}/download`);
    setStatus("done");
  }

  return (
    <div className="space-y-8">
      <div className="space-y-4 rounded-lg border border-slate-800 p-5">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-200">
            MTD Daily CSV <span className="text-red-400">*</span>
          </label>
          <p className="mb-2 text-xs text-slate-500">
            Meta Ads Manager → Reporting → set date range to month-to-date → Time Increment =
            Daily → Export.
          </p>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setMtdFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-slate-300 file:mr-4 file:rounded-md file:border-0 file:bg-indigo-600 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-indigo-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-200">
            Period CSV — optional
          </label>
          <p className="mb-2 text-xs text-slate-500">
            Previous full month's data — upload once at the start of the month, don't re-upload
            each week.
          </p>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setPeriodFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-slate-300 file:mr-4 file:rounded-md file:border-0 file:bg-slate-800 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-slate-700"
          />
        </div>

        <button
          onClick={handleAnalyze}
          disabled={!mtdFile || status === "analyzing"}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
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
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {status === "generating" ? "Generating PPTX…" : "Generate & download PPTX"}
            </button>
          ) : (
            downloadUrl && (
              <a
                href={downloadUrl}
                className="inline-block rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
              >
                Download report (.pptx)
              </a>
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
      <div className="rounded-lg border border-slate-800 p-4">
        <p className="text-xs uppercase tracking-wide text-slate-500">Cover</p>
        <p className="mt-1 text-white">{data.cover.dateRange}</p>
        <p className="text-sm text-slate-300">{data.cover.healthBadge}</p>
        {data.cover.budgetSummary && (
          <p className="mt-1 text-xs text-slate-400">{data.cover.budgetSummary}</p>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">
          Campaign summary slides ({data.campaignSlides.length})
        </p>
        <ul className="divide-y divide-slate-800 rounded-lg border border-slate-800">
          {data.campaignSlides.map((s) => (
            <li key={s.campaignName} className="flex items-center justify-between px-4 py-2 text-sm">
              <span className="text-white">{s.campaignName}</span>
              <span className="text-slate-400">
                {s.metrics.spend} · {s.resultLabel} {s.metrics.results} · {s.metrics.cpr}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {data.adSetSlides.length > 0 && (
        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">
            Ad set slides ({data.adSetSlides.length})
          </p>
          <ul className="divide-y divide-slate-800 rounded-lg border border-slate-800">
            {data.adSetSlides.map((s) => (
              <li
                key={`${s.campaignName}/${s.adSetName}`}
                className="flex items-center justify-between px-4 py-2 text-sm"
              >
                <span className="text-white">
                  {s.campaignName} / {s.adSetName}
                </span>
                <span className="text-slate-400">
                  {s.metrics.spend} · {s.resultLabel} {s.metrics.results}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-slate-800 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Period ({data.periodRow.monthLabel})</p>
          <p className="mt-1 text-sm text-white">{data.periodRow.spend}</p>
        </div>
        <div className="rounded-lg border border-slate-800 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">MTD ({data.mtdRow.monthLabel})</p>
          <p className="mt-1 text-sm text-white">{data.mtdRow.spend}</p>
        </div>
      </div>
    </div>
  );
}
