"use client";

import { useEffect, useRef, useState } from "react";

/** Checkbox list for Previous Month Data campaign inclusion — shared by client page and wizard. */
export function PreviousMonthCampaignSelector({
  clientId,
  campaigns,
  initialSelected,
  onSelectionChange,
  compact = false,
}: {
  clientId: string;
  campaigns: string[];
  initialSelected: string[] | null;
  onSelectionChange?: (selected: string[]) => void;
  compact?: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initialSelected ?? campaigns),
  );
  const [savingSelection, setSavingSelection] = useState(false);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSelected(new Set(initialSelected ?? campaigns));
  }, [campaigns, initialSelected]);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selected.size > 0 && selected.size < campaigns.length;
    }
  }, [selected, campaigns.length]);

  async function saveSelection(next: Set<string>) {
    setSelectionError(null);
    setSavingSelection(true);
    const list = Array.from(next);
    onSelectionChange?.(list);
    try {
      const res = await fetch(`/api/clients/${clientId}/previous-month-data`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedCampaigns: list }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSelectionError(data.error || "Could not save your selection. Please try again.");
      }
    } catch {
      setSelectionError("Could not reach the server. Please try again.");
    } finally {
      setSavingSelection(false);
    }
  }

  function toggleCampaign(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      void saveSelection(next);
      return next;
    });
  }

  function handleSelectAllChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.checked ? new Set(campaigns) : new Set<string>();
    setSelected(next);
    void saveSelection(next);
  }

  if (campaigns.length === 0) {
    return (
      <p className={`${compact ? "text-[12px]" : "text-[13px]"} text-dash-ink-secondary`}>
        No campaigns with spend were found in the previous month data.
      </p>
    );
  }

  return (
    <div className={compact ? "space-y-2" : "mt-4 border-t border-dash-border pt-4"}>
      <div className="mb-2 flex items-center justify-between">
        <label className="flex items-center gap-2 text-[13px] font-medium text-dash-ink">
          <input
            ref={selectAllRef}
            type="checkbox"
            checked={campaigns.length > 0 && selected.size === campaigns.length}
            onChange={handleSelectAllChange}
            className="h-4 w-4 accent-accent"
          />
          Select all
        </label>
        {savingSelection ? <span className="text-[12px] text-dash-ink-secondary">Saving…</span> : null}
      </div>
      <p className="mb-2 text-[13px] text-dash-ink">
        {selected.size} of {campaigns.length} campaigns selected for the previous-month row
      </p>
      <p className="mb-2 text-[12px] leading-relaxed text-dash-ink-secondary">
        Uncheck campaigns you don&apos;t manage — only checked campaigns appear in the Combined Total
        previous-month comparison.
      </p>
      <ul className="max-h-48 divide-y divide-dash-border overflow-y-auto rounded-md border border-dash-border">
        {campaigns.map((name) => (
          <li key={name} className="flex items-center gap-3 px-3 py-2">
            <input
              type="checkbox"
              id={`prev-month-campaign-${name}`}
              checked={selected.has(name)}
              onChange={() => toggleCampaign(name)}
              className="h-4 w-4 accent-accent"
            />
            <label htmlFor={`prev-month-campaign-${name}`} className="cursor-pointer truncate text-[13px] text-dash-ink">
              {name}
            </label>
          </li>
        ))}
      </ul>
      {selectionError ? <p className="mt-2 text-[13px] text-red-400">{selectionError}</p> : null}
    </div>
  );
}
