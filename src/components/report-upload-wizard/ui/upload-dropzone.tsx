"use client";

import { useState } from "react";
import { DataSourceBadge } from "@/components/wizard-data-source-panel";
import { ACCEPTED_FILE_TYPES } from "../constants";

export function UploadDropzone({ file, onFileSelected, disabled = false }: { file: File | null; onFileSelected: (f: File | null) => void; disabled?: boolean }) {
  const [dragOver, setDragOver] = useState(false);
  return (
    <label
      aria-disabled={disabled}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (disabled) return;
        const dropped = e.dataTransfer.files?.[0];
        if (dropped) onFileSelected(dropped);
      }}
      className={`flex ${disabled ? "cursor-wait opacity-60" : "cursor-pointer"} flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
        dragOver ? "border-dash-accent bg-dash-accent/10" : "border-dash-border bg-dash-bg hover:bg-dash-border/20"
      }`}
    >
      <input
        type="file"
        disabled={disabled}
        accept={ACCEPTED_FILE_TYPES}
        onChange={(e) => { if (!disabled) onFileSelected(e.target.files?.[0] ?? null); }}
        className="hidden"
      />
      <span className="mb-2"><DataSourceBadge label="CSV" /></span>
      <span className="max-w-full break-all text-[14px] font-medium text-dash-ink">
        {file ? file.name : "Drop your CSV here or click to browse"}
      </span>
      {!file && <span className="text-[14px] text-dash-ink-secondary">CSV, Excel, TSV, TXT</span>}
    </label>
  );
}
