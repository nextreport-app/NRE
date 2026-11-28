"use client";
import { formatClientCalendarDate } from "@/lib/client-date-format";

import { computeWeeklyRangeOptions } from "@/lib/nre/date-range";
import { csvReportingCalendar } from "@/lib/nre/csv-reporting-calendar";
import { reportCalendarYesterday } from "@/lib/nre/report-period-selection";
import { useWizardContext } from "../wizard-context";
import { normalizeSavedDateSelection } from "./normalize-date-selection";
import { WizardDateRangeFields } from "./wizard-date-picker";

export function WeeklyPeriodControls() {
  const w = useWizardContext();
  const importingApi = w.dataSourceMode === "api" && w.step === 1;
  const calendar = csvReportingCalendar(importingApi ? null : w.dateBounds, new Date(), w.clientTimezone);
  const options = importingApi || !w.weeklyOptions
    ? computeWeeklyRangeOptions([], calendar.now, w.clientTimezone)
    : w.weeklyOptions;
  // Older saved presets remain visible as their equivalent custom range.
  const selection = normalizeSavedDateSelection({ mode: w.dateMode, customStart: w.customStart, customEnd: w.customEnd }, options);
  const custom = selection.mode === "custom";
  const range = custom
    ? { startIso: selection.customStart ?? "", endIso: selection.customEnd ?? "" }
    : options.last7;

  function chooseCustom() {
    if (w.dateMode === "prev7" || w.dateMode === "last14" || !w.customStart || !w.customEnd) {
      w.editCustomStart(range.startIso);
      w.editCustomEnd(range.endIso);
    }
    w.editDateMode("custom");
  }

  return <details open={w.needsLongRangeConfirm || !!w.customRangeError || undefined} className="group space-y-3 rounded-lg border border-dash-border bg-dash-card p-4">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-md text-sm font-semibold text-dash-ink [&::-webkit-details-marker]:hidden">
      <span className="min-w-0">Weekly report period
      <span aria-live="polite" className="mt-1 block font-normal text-dash-ink-secondary">Report dates: {range.startIso ? w.clientCurrency ? formatClientCalendarDate(range.startIso, w.clientCurrency) : range.startIso : 'Choose start'} – {range.endIso ? w.clientCurrency ? formatClientCalendarDate(range.endIso, w.clientCurrency) : range.endIso : 'Choose end'}</span>
      </span>
      <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-dash-border text-dash-ink-secondary transition-colors group-hover:bg-dash-bg">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 transition-transform group-open:rotate-180 motion-reduce:transition-none"><path d="m7 10 5 5 5-5" /></svg>
      </span>
    </summary>
    <div className="flex flex-wrap gap-2">
      {([['last7', 'Last 7 days'], ['custom', 'Custom date range']] as const).map(([mode, label]) => {
        const active = mode === "custom" ? custom : !custom;
        return <button key={mode} type="button" aria-pressed={active}
          onClick={() => mode === "custom" ? chooseCustom() : w.editDateMode("last7")}
          className={`min-h-10 rounded-lg border px-3 py-2 text-sm font-medium ${active ? 'border-dash-accent bg-dash-accent text-[#0b1728]' : 'border-dash-border text-dash-ink hover:bg-dash-bg'}`}>
          {label}
        </button>;
      })}
    </div>
    {custom && <WizardDateRangeFields currency={w.clientCurrency} startIso={range.startIso} endIso={range.endIso}
      minIso={importingApi ? undefined : w.dateBounds?.minIso}
      maxIso={importingApi ? reportCalendarYesterday(new Date(), w.clientTimezone) : calendar.endIso}
      onStartChange={iso => { w.editDateMode("custom"); w.editCustomStart(iso); w.editCustomEnd(range.endIso); }}
      onEndChange={iso => { w.editDateMode("custom"); w.editCustomStart(range.startIso); w.editCustomEnd(iso); }} />}
    {w.customRangeError && <p role="alert" className="text-sm text-red-400">{w.customRangeError}</p>}
    {w.needsLongRangeConfirm && <div className="rounded-lg border border-dash-border p-3">
      <p className="text-sm text-dash-ink-secondary">This report covers more than seven days. Use this reporting period?</p>
      <button type="button" onClick={() => w.setLongRangeConfirmed(true)} className="mt-3 rounded-md bg-dash-accent px-3 py-2 text-sm font-semibold text-[#0b1728]">Confirm reporting period</button>
    </div>}
  </details>;
}
