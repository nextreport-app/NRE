"use client";
import { useState } from "react";
export interface MetricChip { key: string; label: string }
/** Shared selection controls for every report format. Locked chips identify required format metrics. */
export function MetricChipPicker({ selected, available, lockedKeys = [], onAdd, onRemove, limit = 64, hint, groups }: { selected: MetricChip[]; available: MetricChip[]; lockedKeys?: string[]; onAdd: (metric: MetricChip) => void; onRemove: (key: string) => void; limit?: number; hint?: string; groups?: { label: string; keys: string[] }[] }) {
  const [showAll, setShowAll] = useState(false);
  const selectedKeys = new Set(selected.map(metric => metric.key));
  const candidates = available.filter(metric => !selectedKeys.has(metric.key));
  return <div>
    <p className="mt-3 text-[14px] font-medium uppercase tracking-wide text-dash-ink-secondary">Included metrics · {selected.length}</p>
    <div className="mt-2 space-y-3">{(groups ?? [{ label: "", keys: selected.map(metric => metric.key) }]).map((group, index) => <div key={index} className={groups && groups.length > 1 ? "rounded-lg border border-dash-border bg-dash-bg/30 p-3" : ""}>
      {group.label && <p className="mb-2 text-xs font-medium text-dash-ink-secondary">{group.label}</p>}
      <div className="flex flex-wrap gap-2">{selected.filter(metric => group.keys.includes(metric.key)).map(metric => <span key={metric.key} className="flex items-center gap-2 rounded-md border border-dash-border bg-dash-card nre-dash-surface px-3 py-2"><span className="text-[12px] uppercase tracking-wide text-dash-ink">{metric.label}</span>{lockedKeys.includes(metric.key) ? <span className="text-xs text-dash-ink-secondary">Included</span> : <button type="button" aria-label={`Remove ${metric.label}`} onClick={() => onRemove(metric.key)} className="text-dash-ink-secondary hover:text-dash-error">✕</button>}</span>)}</div>
    </div>)}</div>
    <details className="mt-4 border-t border-dash-border pt-3"><summary className="cursor-pointer text-[13px] font-medium text-dash-accent">Add more metrics · optional</summary><div className="mt-3">
      <p className="text-[14px] font-medium uppercase tracking-wide text-dash-ink-secondary">Add from CSV</p>
      <p className="mt-1 text-[14px] text-dash-ink-secondary">{hint ?? "Only supported metrics detected in your uploaded CSV are shown."}</p>
      {selected.length >= limit && <p className="mt-2 text-xs text-dash-ink-secondary">{limit}-metric limit reached. Remove a metric to add another.</p>}
      <div className="mt-2 flex flex-wrap gap-2">{(showAll ? candidates : candidates.slice(0, 8)).map(metric => <button key={metric.key} type="button" disabled={selected.length >= limit} onClick={() => onAdd(metric)} className="rounded-md border border-dash-border px-3 py-2 text-[14px] text-dash-ink-secondary hover:text-dash-ink disabled:opacity-50"><span className="text-dash-success">+</span> {metric.label}</button>)}</div>
      {!candidates.length && <p className="mt-2 text-sm text-dash-ink-secondary">No additional supported metric columns in this export.</p>}
      {candidates.length > 8 && <button type="button" onClick={() => setShowAll(!showAll)} className="mt-2 text-sm text-dash-accent hover:underline">{showAll ? "Show fewer metrics" : `Show ${candidates.length - 8} more`}</button>}
    </div></details>
  </div>;
}
