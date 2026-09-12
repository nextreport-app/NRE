"use client";

import { useState, type ReactNode } from "react";
import { WizardDataSourceSummary } from "@/components/wizard-data-source-panel";

const ACCEPTED_FILE_TYPES = ".csv,.tsv,.txt,.xlsx,.xls,.ods";

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
      className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
        dragOver
          ? "border-[#f6ad55] bg-[#f6ad55]/10"
          : file
            ? "border-emerald-500/40 bg-emerald-500/5"
            : "border-dash-border bg-dash-bg hover:border-[#f6ad55]/40 hover:bg-[#f6ad55]/5"
      }`}
    >
      <input
        type="file"
        accept={ACCEPTED_FILE_TYPES}
        onChange={(e) => onFileSelected(e.target.files?.[0] ?? null)}
        className="hidden"
      />
      {file ? (
        <>
          <svg className="h-8 w-8 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
            <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M14 2v6h6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="max-w-full truncate text-[14px] font-medium text-dash-ink">{file.name}</span>
          <span className="text-[12px] text-dash-ink-secondary">Click or drop to replace</span>
        </>
      ) : (
        <>
          <svg className="h-8 w-8 text-[#f6ad55]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M7 10l5-5 5 5M12 5v12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-[14px] font-medium text-dash-ink">Drop your CSV here or click to browse</span>
          <span className="text-[13px] text-dash-ink-secondary">CSV, Excel, TSV, TXT</span>
        </>
      )}
    </label>
  );
}

/** Step 1 manual CSV upload — styled to mirror the API sync panel. */
export function WizardCsvUploadPanel({
  file,
  onFileSelected,
  downloadTip,
  analyzeStatus,
  onAnalyze,
}: {
  file: File | null;
  onFileSelected: (f: File | null) => void;
  downloadTip: ReactNode;
  analyzeStatus: "idle" | "loading" | "error" | "invalid";
  onAnalyze: () => void;
}) {
  return (
    <div className="space-y-4 rounded-lg border border-[#f6ad55]/25 bg-[#1e293b]/60 p-4">
      <div>
        <p className="text-[14px] font-semibold text-white">Upload your export</p>
        <p className="mt-1 text-[13px] leading-relaxed text-dash-ink-secondary">
          Export Last 30 days with Day breakdown from Ads Manager, then drop the file here.
        </p>
      </div>

      <WizardDataSourceSummary mode="csv" />

      <UploadDropzone file={file} onFileSelected={onFileSelected} />

      <div className="rounded-lg border border-[#f6ad55]/30 bg-[#0f172a]/80 px-4 py-3.5">
        <a
          href="https://nextreport.in/help/download"
          target="_blank"
          rel="noopener noreferrer"
          className="mb-1.5 flex items-center gap-1.5 text-[14px] font-semibold text-[#f6ad55] underline decoration-[#f6ad55]/50 underline-offset-2 hover:text-[#fbd38d]"
        >
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M12 6v12M8 10l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 18h16" strokeLinecap="round" />
          </svg>
          How to download your CSV
        </a>
        <div className="text-[13px] leading-relaxed text-[#e2e8f0]">{downloadTip}</div>
      </div>

      <button
        type="button"
        onClick={onAnalyze}
        disabled={!file || analyzeStatus === "loading"}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-dash-accent text-[15px] font-semibold text-dash-ink hover:bg-dash-accent-hover disabled:opacity-40"
      >
        {analyzeStatus === "loading" ? (
          <>
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Analyzing…
          </>
        ) : (
          "Analyze CSV"
        )}
      </button>
    </div>
  );
}
