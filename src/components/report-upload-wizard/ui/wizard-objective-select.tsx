"use client";

import { useMemo, useState } from "react";
import type { ObjectiveInfo } from "@/lib/nre/result-type-map";

type Props = {
  options: ObjectiveInfo[];
  value: string;
  onChange: (key: string) => void;
  searchPlaceholder: string;
  className?: string;
  invalid?: boolean;
};

/** Searchable objective picker — filters the same option list as the legacy dropdown. */
export function WizardObjectiveSelect({ options, value, onChange, searchPlaceholder, className = "", invalid }: Props) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    const matches = options.filter(
      (o) => o.resultLabel.toLowerCase().includes(q) || o.key.includes(q.replace(/\s+/g, "_")),
    );
    const selected = options.find((o) => o.key === value);
    if (selected && !matches.some((o) => o.key === value)) {
      return [selected, ...matches];
    }
    return matches;
  }, [options, query, value]);

  return (
    <div className={`flex min-w-[min(100%,14rem)] flex-col gap-1.5 sm:min-w-[14rem] ${className}`}>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={searchPlaceholder}
        aria-label={searchPlaceholder}
        className={`rounded-md border px-2.5 py-1 text-[13px] text-dash-ink outline-none placeholder:text-dash-ink-secondary focus:border-[#f6ad55] ${
          invalid ? "border-[#fc8181]" : "border-dash-border"
        } bg-dash-bg`}
      />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        size={query.trim() ? Math.min(8, Math.max(3, filtered.length)) : undefined}
        className={`rounded-md border px-3 py-1.5 text-[14px] text-dash-ink outline-none focus:border-[#f6ad55] ${
          invalid ? "border-[#fc8181] ring-1 ring-[#fc8181]" : "border-dash-border"
        } bg-dash-bg ${query.trim() ? "max-h-48" : ""}`}
      >
        {filtered.length === 0 ? (
          <option value="" disabled>
            No matches
          </option>
        ) : (
          filtered.map((o) => (
            <option key={o.key} value={o.key}>
              {o.resultLabel}
            </option>
          ))
        )}
      </select>
    </div>
  );
}
