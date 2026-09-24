"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { formatIsoShort } from "../utils";

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;
const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function parseIso(iso: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

function toIso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isoToUtcTs(iso: string): number | null {
  const parts = parseIso(iso);
  if (!parts) return null;
  return Date.UTC(parts.year, parts.month - 1, parts.day);
}

function isWithinBounds(iso: string, minIso?: string, maxIso?: string): boolean {
  const ts = isoToUtcTs(iso);
  if (ts === null) return false;
  const minTs = minIso ? isoToUtcTs(minIso) : null;
  const maxTs = maxIso ? isoToUtcTs(maxIso) : null;
  if (minTs !== null && ts < minTs) return false;
  if (maxTs !== null && ts > maxTs) return false;
  return true;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function buildMonthGrid(year: number, month: number): Array<{ iso: string; day: number; inMonth: boolean }> {
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const totalDays = daysInMonth(year, month);
  const cells: Array<{ iso: string; day: number; inMonth: boolean }> = [];

  for (let i = 0; i < firstDow; i += 1) {
    cells.push({ iso: "", day: 0, inMonth: false });
  }
  for (let day = 1; day <= totalDays; day += 1) {
    cells.push({ iso: toIso(year, month, day), day, inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ iso: "", day: 0, inMonth: false });
  }
  return cells;
}

function CalendarIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-dash-accent">
      <path
        fill="currentColor"
        d="M5.75 3a.75.75 0 0 0-1.5 0v.407A3.25 3.25 0 0 0 2.5 6.75v8.5A2.75 2.75 0 0 0 5.25 18h9.5A2.75 2.75 0 0 0 17.5 15.25v-8.5A3.25 3.25 0 0 0 14.75 3.407V3a.75.75 0 0 0-1.5 0v.407A3.25 3.25 0 0 0 10 2.5c-.88 0-1.673.352-2.25.907V3Z"
      />
      <path fill="currentColor" d="M4 7.75h12v7.5a1.25 1.25 0 0 1-1.25 1.25h-9.5A1.25 1.25 0 0 1 4 15.25v-7.5Z" />
    </svg>
  );
}

export interface WizardDatePickerProps {
  value: string;
  onChange: (iso: string) => void;
  minIso?: string;
  maxIso?: string;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
}

/** Dark-themed calendar popover for the report wizard — replaces native date inputs. */
export function WizardDatePicker({
  value,
  onChange,
  minIso,
  maxIso,
  label,
  placeholder = "Select date",
  disabled = false,
}: WizardDatePickerProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const selected = parseIso(value);
  const initialView = selected ?? parseIso(maxIso ?? minIso ?? "") ?? { year: 2026, month: 1, day: 1 };
  const [viewYear, setViewYear] = useState(initialView.year);
  const [viewMonth, setViewMonth] = useState(initialView.month);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!selected) return;
    setViewYear(selected.year);
    setViewMonth(selected.month);
  }, [value]);

  const grid = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const todayIso = useMemo(() => {
    const now = new Date();
    return toIso(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate());
  }, []);

  function shiftMonth(delta: number) {
    let month = viewMonth + delta;
    let year = viewYear;
    while (month < 1) {
      month += 12;
      year -= 1;
    }
    while (month > 12) {
      month -= 12;
      year += 1;
    }
    setViewYear(year);
    setViewMonth(month);
  }

  const displayValue = value ? formatIsoShort(value) : placeholder;

  return (
    <div ref={rootRef} className="relative min-w-[11.5rem]">
      {label ? <label className="mb-1.5 block text-[14px] font-medium text-dash-ink-secondary">{label}</label> : null}
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((prev) => !prev)}
        className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-[14px] transition-colors ${
          disabled
            ? "cursor-not-allowed border-dash-border/60 bg-dash-bg/60 text-dash-ink-secondary"
            : open
              ? "border-dash-accent bg-[#162033] text-white shadow-[0_0_0_1px_rgba(245,180,90,0.35)]"
              : "border-dash-border bg-[#162033] text-white hover:border-dash-accent/60 hover:bg-[#1a2740]"
        }`}
      >
        <CalendarIcon />
        <span className={value ? "font-medium" : "text-dash-ink-secondary"}>{displayValue}</span>
      </button>

      {open ? (
        <div
          id={listboxId}
          role="dialog"
          aria-label={label ?? "Choose date"}
          className="absolute left-0 top-[calc(100%+0.5rem)] z-50 w-[18.5rem] rounded-xl border border-dash-border bg-dash-card p-4 shadow-[0_16px_40px_rgba(0,0,0,0.45)]"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => shiftMonth(-1)}
              className="rounded-md border border-dash-border bg-dash-bg px-2 py-1 text-[14px] text-dash-ink-secondary hover:border-dash-accent/50 hover:text-white"
            >
              ‹
            </button>
            <p className="text-[14px] font-semibold text-white">
              {MONTH_LABELS[viewMonth - 1]} {viewYear}
            </p>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => shiftMonth(1)}
              className="rounded-md border border-dash-border bg-dash-bg px-2 py-1 text-[14px] text-dash-ink-secondary hover:border-dash-accent/50 hover:text-white"
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAY_LABELS.map((day) => (
              <div key={day} className="py-1 text-[11px] font-semibold uppercase tracking-wide text-dash-ink-secondary">
                {day}
              </div>
            ))}
            {grid.map((cell, index) => {
              if (!cell.inMonth) {
                return <div key={`empty-${index}`} className="h-9" aria-hidden="true" />;
              }
              const enabled = isWithinBounds(cell.iso, minIso, maxIso);
              const selectedDay = value === cell.iso;
              const isToday = cell.iso === todayIso;
              return (
                <button
                  key={cell.iso}
                  type="button"
                  disabled={!enabled}
                  onClick={() => {
                    onChange(cell.iso);
                    setOpen(false);
                  }}
                  className={`h-9 rounded-md text-[13px] font-medium transition-colors ${
                    !enabled
                      ? "cursor-not-allowed text-dash-ink-secondary/30"
                      : selectedDay
                        ? "bg-dash-accent text-[#0f172a] shadow-sm"
                        : isToday
                          ? "border border-dash-accent/70 bg-dash-accent/10 text-white hover:bg-dash-accent/20"
                          : "text-dash-ink hover:bg-white/8"
                  }`}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export interface WizardDateRangeFieldsProps {
  startIso: string;
  endIso: string;
  minIso?: string;
  maxIso?: string;
  onStartChange: (iso: string) => void;
  onEndChange: (iso: string) => void;
  startLabel?: string;
  endLabel?: string;
}

export function WizardDateRangeFields({
  startIso,
  endIso,
  minIso,
  maxIso,
  onStartChange,
  onEndChange,
  startLabel = "Start date",
  endLabel = "End date",
}: WizardDateRangeFieldsProps) {
  return (
    <div className="flex flex-wrap items-end gap-4">
      <WizardDatePicker label={startLabel} value={startIso} minIso={minIso} maxIso={maxIso} onChange={onStartChange} />
      <span className="hidden pb-3 text-[13px] text-dash-ink-secondary sm:inline">to</span>
      <WizardDatePicker
        label={endLabel}
        value={endIso}
        minIso={minIso}
        maxIso={maxIso}
        onChange={onEndChange}
      />
    </div>
  );
}
