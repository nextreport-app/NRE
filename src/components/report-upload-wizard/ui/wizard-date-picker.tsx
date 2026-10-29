"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { formatIsoShort } from "../utils";
import { CALENDAR_TRIGGER, CALENDAR_PANEL, CALENDAR_NAV, CalendarIcon } from "./calendar-style";

function parsed(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const date = new Date(iso + "T12:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === iso ? date : null;
}
function iso(date: Date) { return date.toISOString().slice(0, 10); }
export interface WizardDatePickerProps {
  value: string; onChange: (iso: string) => void; minIso?: string; maxIso?: string;
  label?: string; placeholder?: string; disabled?: boolean;
}
/** Day grid using the same surface, navigation and focus rules as ReportMonthPicker. */
export function WizardDatePicker({ value, onChange, minIso, maxIso, label, placeholder = "Select date", disabled = false }: WizardDatePickerProps) {
  const id = useId(); const root = useRef<HTMLDivElement>(null); const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false); const [above, setAbove] = useState(false); const [right, setRight] = useState(false);
  const initial = parsed(value) ?? parsed(maxIso ?? "") ?? new Date();
  const [month, setMonth] = useState(initial.toISOString().slice(0, 7));
  const [year, number] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, number - 1, 1));
  const days = new Date(Date.UTC(year, number, 0)).getUTCDate();
  const enabled = (day: string) => (!minIso || day >= minIso) && (!maxIso || day <= maxIso);
  function close() { setOpen(false); trigger.current?.focus(); }
  function show() {
    const box = trigger.current?.getBoundingClientRect();
    setAbove(!!box && window.innerHeight - box.bottom < 420 && box.top > 350);
    setRight(!!box && box.left + Math.min(352, window.innerWidth - 32) > window.innerWidth - 16);
    setMonth((parsed(value) ?? parsed(maxIso ?? "") ?? new Date()).toISOString().slice(0, 7)); setOpen(true);
  }
  function shifted(offset: number) { return new Date(Date.UTC(year, number - 1 + offset, 1)).toISOString().slice(0, 7); }
  function canShift(offset: number) {
    const target = shifted(offset); const [y,m] = target.split("-").map(Number);
    const end = new Date(Date.UTC(y,m,0)).toISOString().slice(0,10);
    return (!minIso || end >= minIso) && (!maxIso || target + "-01" <= maxIso);
  }
  useEffect(() => {
    if (!open) return;
    (root.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]') ?? root.current?.querySelector<HTMLButtonElement>('[data-date]:not(:disabled)'))?.focus();
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", outside); return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  function navigate(event: KeyboardEvent<HTMLButtonElement>, day: string) {
    const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    const date = parsed(day)!;
    if (event.key === "PageUp" || event.key === "PageDown") {
      const originalDay = date.getUTCDate(); date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() + (event.key === "PageUp" ? -1 : 1));
      date.setUTCDate(Math.min(originalDay, new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth()+1,0)).getUTCDate()));
    } else if (offsets[event.key] !== undefined) date.setUTCDate(date.getUTCDate() + offsets[event.key]); else return;
    event.preventDefault(); const target = iso(date); if (!enabled(target)) return;
    setMonth(target.slice(0,7)); requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>(`[data-date="${target}"]`)?.focus());
  }
  return <div ref={root} className="relative min-w-0 w-full" onBlur={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false); }} onKeyDown={event => { if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); close(); } }}>
    {label && <p className="mb-1 text-[13px] font-medium text-dash-ink-secondary">{label}</p>}
    <button ref={trigger} type="button" aria-label={label ?? placeholder} disabled={disabled} aria-haspopup="dialog" aria-expanded={open} aria-controls={id} onClick={() => open ? close() : show()} className={CALENDAR_TRIGGER}><span>{value ? formatIsoShort(value) : placeholder}</span><CalendarIcon /></button>
    {open && <div id={id} role="dialog" aria-label={`Choose ${(label ?? "date").toLowerCase()}`} className={`${CALENDAR_PANEL} ${right ? "right-0" : "left-0"} ${above ? "bottom-full mb-2" : "top-full mt-2"}`}>
      <div className="mb-3 flex items-center justify-between"><button type="button" aria-label="Previous month" disabled={!canShift(-1)} onClick={() => setMonth(shifted(-1))} className={CALENDAR_NAV}>‹</button><p className="text-sm font-semibold text-dash-ink" aria-live="polite">{new Intl.DateTimeFormat("en-US",{month:"long",year:"numeric",timeZone:"UTC"}).format(first)}</p><button type="button" aria-label="Next month" disabled={!canShift(1)} onClick={() => setMonth(shifted(1))} className={CALENDAR_NAV}>›</button></div>
      <div role="group" aria-label={`Days in ${month}`} className="grid grid-cols-7 gap-1 text-center">{["Su","Mo","Tu","We","Th","Fr","Sa"].map(name => <span key={name} className="py-1 text-[11px] font-medium text-dash-ink-secondary">{name}</span>)}
        {Array.from({length:first.getUTCDay()},(_,index)=><span key={`empty-${index}`} aria-hidden />)}
        {Array.from({length:days},(_,index)=>{const day=`${month}-${String(index+1).padStart(2,"0")}`;return <button key={day} type="button" data-date={day} aria-label={day} aria-pressed={day===value} disabled={!enabled(day)} onKeyDown={event=>navigate(event,day)} onClick={()=>{close();onChange(day);}} className={`h-9 rounded-md text-sm font-medium focus-visible:outline-2 focus-visible:outline-dash-accent disabled:cursor-not-allowed disabled:opacity-30 ${day===value?"bg-dash-accent text-[#0b1728]":"text-dash-ink hover:bg-dash-card"}`}>{index+1}</button>;})}
      </div>
    </div>}
  </div>;
}
export interface WizardDateRangeFieldsProps {
  startIso: string; endIso: string; minIso?: string; maxIso?: string;
  onStartChange: (iso: string) => void; onEndChange: (iso: string) => void;
  startLabel?: string; endLabel?: string;
}
export function WizardDateRangeFields({startIso,endIso,minIso,maxIso,onStartChange,onEndChange,startLabel="Start date",endLabel="End date"}:WizardDateRangeFieldsProps){
  return <div className="grid gap-3 sm:grid-cols-2"><WizardDatePicker label={startLabel} value={startIso} minIso={minIso} maxIso={maxIso} onChange={onStartChange}/><WizardDatePicker label={endLabel} value={endIso} minIso={minIso} maxIso={maxIso} onChange={onEndChange}/></div>;
}
