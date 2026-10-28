"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ObjectiveInfo } from "@/lib/nre/meta-objective-dictionary";
import { filterObjectiveOptions } from "@/lib/nre/objective-search";

export function ObjectivePicker({ options, value, label, needsConfirmation, onChange }: {
  options: ObjectiveInfo[];
  value: string;
  label: string;
  needsConfirmation: boolean;
  onChange: (key: string) => void;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const filtered = filterObjectiveOptions(options, query);
  const selected = options.find(option => option.key === value);
  const activeIndex = Math.min(active, Math.max(0, filtered.length - 1));
  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  useEffect(() => {
    if (open) document.getElementById(`${id}-option-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, id, open, query]);
  function close() { setOpen(false); trigger.current?.focus(); }
  function choose(key: string) { close(); onChange(key); }
  function show() { setQuery(""); setActive(0); setOpen(true); }
  return <div ref={root} className="w-full sm:max-w-lg" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }}>
    <button ref={trigger} type="button" aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={`${id}-list`}
      onClick={() => open ? close() : show()}
      onKeyDown={event => { if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); show(); } }}
      className={`flex w-full items-center justify-between gap-3 rounded-md border bg-dash-bg px-3 py-2.5 text-left text-sm text-dash-ink focus-visible:outline-2 focus-visible:outline-dash-accent ${needsConfirmation ? "border-[#fc8181]" : "border-dash-border"}`}>
      <span className="min-w-0 break-words">{selected?.resultLabel ?? "Choose an objective"}</span><span aria-hidden className="text-dash-ink-secondary">{open ? "▴" : "▾"}</span>
    </button>
    {open && <div className="mt-2 overflow-hidden rounded-lg border border-dash-border bg-dash-bg shadow-lg">
      <div className="border-b border-dash-border p-2">
        <input ref={input} type="search" role="combobox" aria-label={`Search ${label.toLowerCase()}`} aria-autocomplete="list" aria-expanded={true} aria-controls={`${id}-list`} aria-activedescendant={filtered.length ? `${id}-option-${activeIndex}` : undefined}
          value={query} placeholder="Search objectives, goals or events…"
          onChange={event => { setQuery(event.target.value); setActive(0); }}
          onKeyDown={event => {
            if (event.key === "Escape") { event.preventDefault(); close(); }
            if (event.key === "ArrowDown") { event.preventDefault(); setActive((activeIndex + 1) % Math.max(1, filtered.length)); }
            if (event.key === "ArrowUp") { event.preventDefault(); setActive((activeIndex + filtered.length - 1) % Math.max(1, filtered.length)); }
            if (event.key === "Enter") { event.preventDefault(); if (filtered[activeIndex]) choose(filtered[activeIndex].key); }
          }}
          className="w-full rounded-md border border-dash-border bg-dash-card px-3 py-2 text-sm text-dash-ink placeholder:text-dash-ink-secondary focus-visible:outline-2 focus-visible:outline-dash-accent" />
      </div>
      <div id={`${id}-list`} role="listbox" aria-label={label} className="max-h-56 overflow-y-auto overscroll-contain p-1">
        {filtered.map((option, index) => <button key={option.key} id={`${id}-option-${index}`} type="button" role="option" aria-selected={value === option.key} tabIndex={-1}
          onMouseDown={event => event.preventDefault()} onClick={() => choose(option.key)}
          className={`flex w-full items-center justify-between gap-3 rounded px-3 py-2 text-left text-[13px] text-dash-ink ${activeIndex === index ? "bg-sky-500/15" : "hover:bg-dash-card"}`}>
          <span>{option.resultLabel}</span>{value === option.key && <span aria-hidden className="text-sky-400">✓</span>}
        </button>)}
      </div>
      <p role="status" className="border-t border-dash-border px-3 py-2 text-xs text-dash-ink-secondary">{filtered.length ? `${filtered.length} objectives · Type to filter` : "No matching objectives. Try another name or clear your search."}</p>
    </div>}
  </div>;
}
