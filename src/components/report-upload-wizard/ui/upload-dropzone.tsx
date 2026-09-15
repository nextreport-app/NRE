"use client";

import { useState } from "react";
import { ACCEPTED_FILE_TYPES } from "../constants";

export function UploadDropzone({ file, onFileSelected }: { file: File | null; onFileSelected: (f: File | null) => void }) {
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
      <span className="text-[14px] font-medium text-dash-ink">
        {file ? file.name : "Drop your CSV here or click to browse"}
      </span>
      {!file && <span className="text-[14px] text-dash-ink-secondary">CSV, Excel, TSV, TXT</span>}
    </label>
  );
}
