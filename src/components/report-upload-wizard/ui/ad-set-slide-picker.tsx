"use client";

import { adSetKey } from "@/lib/nre/ad-sets";

export function AdSetSlidePicker({ campaignName, adSetNames, selectedAdSets, newAdSetKeys, onToggle, onSelectAll, onClear }: {
  campaignName: string;
  adSetNames: string[];
  selectedAdSets: Set<string>;
  newAdSetKeys?: Set<string>;
  onToggle: (campaignName: string, adSetName: string) => void;
  onSelectAll: (campaignName: string, adSetNames: string[]) => void;
  onClear: (campaignName: string, adSetNames: string[]) => void;
}) {
  const selectedCount = adSetNames.filter(name => selectedAdSets.has(adSetKey(campaignName, name))).length;
  return (
    <fieldset className="mt-3 min-w-0 rounded-lg border border-dash-border bg-dash-bg p-3">
      <legend className="sr-only">Ad set slides for {campaignName}</legend>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-dash-ink">Ad set slides <span className="ml-1 font-normal text-dash-ink-secondary">Optional</span></p>
        <span className="text-xs tabular-nums text-dash-ink-secondary" aria-live="polite">{selectedCount} of {adSetNames.length} selected</span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-dash-ink-secondary">
        {adSetNames.length === 1 ? "Add a separate slide for this ad set. It shares the campaign’s data." : "Choose ad sets to give their own slides."}
      </p>
      {adSetNames.length > 1 && (
        <div className="mt-2 flex gap-1 border-b border-dash-border pb-2">
          <button type="button" disabled={selectedCount === adSetNames.length} onClick={() => onSelectAll(campaignName, adSetNames)} className="min-h-9 rounded-md px-2 text-xs font-medium text-dash-ink-secondary hover:bg-dash-card hover:text-dash-ink disabled:opacity-40">Select all</button>
          <button type="button" disabled={selectedCount === 0} onClick={() => onClear(campaignName, adSetNames)} className="min-h-9 rounded-md px-2 text-xs font-medium text-dash-ink-secondary hover:bg-dash-card hover:text-dash-ink disabled:opacity-40">Clear</button>
        </div>
      )}
      <ul className="mt-2 space-y-1">
        {adSetNames.map(name => {
          const key = adSetKey(campaignName, name);
          return <li key={key}>
            <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md px-2 py-2.5 hover:bg-dash-card">
              <input type="checkbox" checked={selectedAdSets.has(key)} onChange={() => onToggle(campaignName, name)} className="mt-0.5 h-4 w-4 shrink-0 accent-accent" />
              <span className="min-w-0 break-words text-sm leading-5 text-dash-ink">
                {name}{newAdSetKeys?.has(key) && <span className="ml-2 rounded bg-sky-500/10 px-1.5 py-0.5 text-xs text-sky-400">New</span>}
              </span>
            </label>
          </li>;
        })}
      </ul>
    </fieldset>
  );
}
