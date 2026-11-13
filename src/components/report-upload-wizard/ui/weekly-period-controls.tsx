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

  return <details className="space-y-3 rounded-lg border border-dash-border bg-dash-card p-4">
    <summary className="cursor-pointer text-sm font-semibold text-dash-ink">
      Weekly report period
      <span aria-live="polite" className="mt-1 block font-normal text-dash-ink-secondary">Report dates: {range.startIso ? w.clientCurrency ? formatClientCalendarDate(range.startIso, w.clientCurrency) : range.startIso : 'Choose start'} – {range.endIso ? w.clientCurrency ? formatClientCalendarDate(range.endIso, w.clientCurrency) : range.endIso : 'Choose end'}</span>
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
  </details>;
}
