"use client";

import { CALENDAR_TRIGGER, CALENDAR_PANEL, CALENDAR_NAV, CalendarIcon } from "./calendar-style";
import { useEffect, useId, useRef, useState } from "react";

const MONTHS = Array.from({ length: 12 }, (_, index) => new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2024, index, 1))));
export function reportMonthLabel(month: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T12:00:00Z`));
}

/** A month-only calendar, independent of browser/OS date-input styling. */
export function ReportMonthPicker({ value, maxMonth, currentMonth, label, partialLabel = "Through yesterday", onChange }: {
  value: string; maxMonth: string; currentMonth: string; label: string; partialLabel?: string; onChange: (month: string) => void;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [above, setAbove] = useState(false);
  const [year, setYear] = useState(Number(value.slice(0, 4)));
  const maxYear = Number(maxMonth.slice(0, 4));
  const previousMonth = new Date(Date.UTC(Number(currentMonth.slice(0, 4)), Number(currentMonth.slice(5, 7)) - 1, 0)).toISOString().slice(0, 7);
  function close() { setOpen(false); trigger.current?.focus(); }
  function choose(month: string) { if (month <= maxMonth) { close(); onChange(month); } }
  function show() {
    const box = trigger.current?.getBoundingClientRect();
    setAbove(!!box && window.innerHeight - box.bottom < 420 && box.top > 350);
    setYear(Number(value.slice(0, 4))); setOpen(true);
  }
  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLButtonElement>('[data-selected="true"]')?.focus();
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  function navigate(event: React.KeyboardEvent<HTMLButtonElement>, month: string) {
    const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3, PageUp: -12, PageDown: 12 };
    const offset = offsets[event.key];
    if (offset === undefined) return;
    event.preventDefault();
    const next = new Date(`${month}-01T12:00:00Z`);
    next.setUTCMonth(next.getUTCMonth() + offset);
    const target = next.toISOString().slice(0, 7);
    if (target > maxMonth || next.getUTCFullYear() < 1900) return;
    setYear(next.getUTCFullYear());
    requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>(`[data-month="${target}"]`)?.focus());
  }
  return <div ref={root} className="relative w-full" onKeyDown={event => { if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); close(); } }} onBlur={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false); }}>
    <button ref={trigger} type="button" aria-label={label} aria-haspopup="dialog" aria-expanded={open} aria-controls={`${id}-calendar`} onClick={() => open ? close() : show()} className={CALENDAR_TRIGGER}>
      <span className="flex flex-wrap items-center gap-2">{reportMonthLabel(value)}{value === currentMonth && <span className="rounded-full border border-sky-500/25 bg-sky-500/10 px-2 py-0.5 text-[11px] font-normal text-dash-ink-secondary">{partialLabel}</span>}</span>
      <CalendarIcon />
    </button>
    {open && <div id={`${id}-calendar`} role="dialog" aria-label={`Choose ${label.toLowerCase()}`} className={`${CALENDAR_PANEL} left-0 ${above ? "bottom-full mb-2" : "top-full mt-2"}`}>
      <div className="mb-3 flex items-center justify-between">
        <button type="button" aria-label="Previous year" disabled={year <= 1900} onClick={() => setYear(year - 1)} className={CALENDAR_NAV}>‹</button>
        <p className="text-sm font-semibold text-dash-ink" aria-live="polite">{year}</p>
        <button type="button" aria-label="Next year" disabled={year >= maxYear} onClick={() => setYear(year + 1)} className={CALENDAR_NAV}>›</button>
      </div>
      <div role="group" aria-label={`Months in ${year}`} className="grid grid-cols-3 gap-1.5">{MONTHS.map((name, index) => {
        const month = `${String(year).padStart(4, "0")}-${String(index + 1).padStart(2, "0")}`;
        return <button key={month} type="button" data-month={month} data-selected={month === value} aria-label={reportMonthLabel(month)} aria-pressed={month === value} disabled={month > maxMonth} onKeyDown={event => navigate(event, month)} onClick={() => choose(month)} className={`rounded-md px-2 py-2.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-dash-accent disabled:cursor-not-allowed disabled:opacity-30 ${month === value ? "bg-dash-accent text-[#0b1728]" : "text-dash-ink hover:bg-dash-card"}`}>{name}</button>;
      })}</div>
      <div className="mt-3 flex flex-wrap gap-2 border-t border-dash-border pt-3">
        {currentMonth <= maxMonth && <button type="button" onClick={() => choose(currentMonth)} className="rounded-md border border-dash-border px-2.5 py-1.5 text-xs font-medium text-dash-ink hover:bg-dash-card">Month to date</button>}
        <button type="button" onClick={() => choose(previousMonth)} className="rounded-md border border-dash-border px-2.5 py-1.5 text-xs font-medium text-dash-ink hover:bg-dash-card">Previous month</button>
      </div>
    </div>}
  </div>;
}
