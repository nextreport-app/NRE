"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { isLowSpendCampaign, LOW_SPEND_CAMPAIGN_THRESHOLD, sortCampaignsBySpend } from "@/lib/nre/campaigns";
import { resolvePreviousMonthUiSelection } from "@/lib/nre/merge-previous-month-selection";

/** Checkbox list for Previous Month Data campaign inclusion — shared by client page and wizard. */
export function PreviousMonthCampaignSelector({
  clientId,
  campaigns,
  initialSelected,
  campaignSpend = {},
  currencySymbol = "$",
  onSelectionChange,
  compact = false,
}: {
  clientId: string;
  campaigns: string[];
  initialSelected: string[] | null;
  campaignSpend?: Record<string, number>;
  currencySymbol?: string;
  onSelectionChange?: (selected: string[]) => void;
  compact?: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => {
    const { selectedCampaigns } = resolvePreviousMonthUiSelection(campaigns, campaignSpend, initialSelected);
    return new Set(selectedCampaigns);
  });
  const [savingSelection, setSavingSelection] = useState(false);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const selectAllRef = useRef<HTMLInputElement>(null);

  const lowSpendCampaigns = useMemo(
    () => campaigns.filter((name) => isLowSpendCampaign(name, campaignSpend)),
    [campaigns, campaignSpend],
  );

  const campaignsBySpend = useMemo(
    () => sortCampaignsBySpend(campaigns, campaignSpend),
    [campaigns, campaignSpend],
  );

  const filteredCampaigns = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return campaignsBySpend;
    return campaignsBySpend.filter((name) => name.toLowerCase().includes(q));
  }, [campaignsBySpend, search]);

  useEffect(() => {
    const { selectedCampaigns } = resolvePreviousMonthUiSelection(campaigns, campaignSpend, initialSelected);
    setSelected(new Set(selectedCampaigns));
  }, [campaigns, campaignSpend, initialSelected]);

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
      {lowSpendCampaigns.length > 0 ? (
        <div className="mb-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-[13px] text-dash-ink">
          <strong>
            {lowSpendCampaigns.length} campaign{lowSpendCampaigns.length === 1 ? "" : "s"}
          </strong>{" "}
          had less than {currencySymbol}
          {LOW_SPEND_CAMPAIGN_THRESHOLD} spend in this previous-month file and{" "}
          {lowSpendCampaigns.length === 1 ? "was" : "were"} excluded by default. Check any you still want in the
          previous-month row.
        </div>
      ) : null}

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
      {campaigns.length > 6 ? (
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search campaigns…"
          className="mb-2 w-full rounded-md border border-dash-border bg-dash-bg px-3 py-2 text-[13px] text-dash-ink placeholder:text-dash-ink-secondary"
        />
      ) : null}
      <ul className="max-h-48 divide-y divide-dash-border overflow-y-auto rounded-md border border-dash-border">
        {filteredCampaigns.length === 0 ? (
          <li className="px-3 py-3 text-[13px] text-dash-ink-secondary">No campaigns match your search.</li>
        ) : null}
        {filteredCampaigns.map((name) => {
          const spend = campaignSpend[name] ?? 0;
          const lowSpend = isLowSpendCampaign(name, campaignSpend);
          return (
            <li key={name} className="flex items-center gap-3 px-3 py-2">
              <input
                type="checkbox"
                id={`prev-month-campaign-${name}`}
                checked={selected.has(name)}
                onChange={() => toggleCampaign(name)}
                className="h-4 w-4 accent-accent"
              />
              <label
                htmlFor={`prev-month-campaign-${name}`}
                className="min-w-0 flex-1 cursor-pointer truncate text-[13px] text-dash-ink"
                title={name}
              >
                {name}
              </label>
              <span
                className={
                  lowSpend
                    ? "shrink-0 text-[12px] font-semibold tabular-nums text-amber-400"
                    : "shrink-0 text-[12px] tabular-nums text-dash-ink-secondary"
                }
              >
                Prev. month · {currencySymbol}
                {Math.round(spend).toLocaleString("en-US")}
              </span>
            </li>
          );
        })}
      </ul>
      {selectionError ? <p className="mt-2 text-[13px] text-red-400">{selectionError}</p> : null}
    </div>
  );
}
