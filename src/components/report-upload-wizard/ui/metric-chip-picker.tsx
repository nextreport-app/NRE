"use client";

import { useState } from "react";
export interface MetricChip { key: string; label: string }

/** Shared selection controls for every report format. Required metrics stay locked. */
export function MetricChipPicker({ selected, available, lockedKeys = [], onAdd, onRemove, limit = 64, source = "CSV", groups }: {
  selected: MetricChip[];
  available: MetricChip[];
  lockedKeys?: string[];
  onAdd: (metric: MetricChip) => void;
  onRemove: (key: string) => void;
  limit?: number;
  source?: "CSV" | "Meta API";
  groups?: { label: string; keys: string[] }[];
}) {
  const [showAll, setShowAll] = useState(false);
  const selectedKeys = new Set(selected.map(metric => metric.key));
  const candidates = available.filter(metric => !selectedKeys.has(metric.key));
  return <div>
    <div role="group" aria-label="Selected metrics" className="mt-3 space-y-3">
      {(groups ?? [{ label: "", keys: selected.map(metric => metric.key) }]).map((group, index) => (
        <div key={index} className={groups && groups.length > 1 ? "rounded-lg border border-dash-border p-3" : ""}>
          {group.label && <p className="mb-2 text-xs font-medium text-dash-ink-secondary">{group.label}</p>}
          <div className="flex flex-wrap gap-2">
            {selected.filter(metric => group.keys.includes(metric.key)).map(metric => (
              <span key={metric.key} className="inline-flex max-w-full items-center gap-1 rounded-lg border border-dash-border bg-dash-card pl-3 pr-1 py-1">
                <span className="min-w-0 break-words text-xs font-medium text-dash-ink">{metric.label}</span>
                {lockedKeys.includes(metric.key)
                  ? <span className="px-2 text-xs text-dash-ink-secondary">Included</span>
                  : <button type="button" aria-label={`Remove ${metric.label}`} onClick={() => onRemove(metric.key)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-dash-ink-secondary hover:bg-dash-bg hover:text-dash-error focus-visible:outline-2 focus-visible:outline-dash-accent"><span aria-hidden>×</span></button>}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
    <details className="mt-4 border-t border-dash-border pt-3">
      <summary className="cursor-pointer text-[13px] font-medium text-dash-accent">Add more metrics · optional</summary>
      <div className="mt-3">
        <p className="text-xs font-medium text-dash-ink-secondary">Available metrics detected from {source === "CSV" ? "your CSV" : "Meta API"}.</p>
        {selected.length >= limit && <p className="mt-2 text-xs text-dash-ink-secondary">{limit}-metric limit reached. Remove a metric to add another.</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          {(showAll ? candidates : candidates.slice(0, 8)).map(metric => (
            <button key={metric.key} type="button" aria-label={`Add ${metric.label}`} disabled={selected.length >= limit} onClick={() => onAdd(metric)} className="inline-flex min-h-10 max-w-full items-center gap-2 rounded-lg border border-dash-border px-3 py-2 text-xs text-dash-ink-secondary hover:bg-dash-card hover:text-dash-ink focus-visible:outline-2 focus-visible:outline-dash-accent disabled:opacity-50">
              <span aria-hidden className="text-dash-success">+</span><span className="min-w-0 break-words text-left">{metric.label}</span>
            </button>
          ))}
        </div>
        {!candidates.length && <p className="mt-2 text-sm text-dash-ink-secondary">No additional supported metrics in this import.</p>}
        {candidates.length > 8 && <button type="button" onClick={() => setShowAll(!showAll)} className="mt-2 text-sm text-dash-accent hover:underline">{showAll ? "Show fewer metrics" : `Show ${candidates.length - 8} more`}</button>}
      </div>
    </details>
  </div>;
}
