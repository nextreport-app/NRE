"use client";

import { computeWeeklyRangeOptions } from "@/lib/nre/date-range";
import { csvReportingCalendar } from "@/lib/nre/csv-reporting-calendar";
import { reportCalendarYesterday } from "@/lib/nre/report-period-selection";
import { useWizardContext } from "../wizard-context";
import { WizardDateRangeFields } from "./wizard-date-picker";

export function WeeklyPeriodControls() {
  const w = useWizardContext();
  const importingApi = w.dataSourceMode === "api" && w.step === 1;
  const calendar = csvReportingCalendar(importingApi ? null : w.dateBounds, new Date(), w.clientTimezone);
  const options = importingApi || !w.weeklyOptions ? computeWeeklyRangeOptions([], calendar.now, w.clientTimezone) : w.weeklyOptions;
  const range = w.dateMode === "custom" ? { startIso: w.customStart, endIso: w.customEnd } : options[w.dateMode];
  return <section className="space-y-3 rounded-lg border border-dash-border bg-dash-card p-4">
    <h3 className="text-sm font-semibold text-dash-ink">Weekly report period</h3>
    <p className="text-xs text-dash-ink-secondary">Choose the reporting period. The report also includes month-to-date totals and a last-30-days chart.</p>
    <div className="flex flex-wrap gap-2">{([['last7', 'Last 7 days'], ['prev7', 'Previous 7 days'], ['last14', 'Last 14 days'], ['custom', 'Custom date range']] as const).map(([mode, label]) => <button key={mode} type="button" aria-pressed={w.dateMode === mode} onClick={() => {
      if (mode === 'custom' && (!w.customStart || !w.customEnd)) {
        w.editCustomStart(options.last7.startIso); w.editCustomEnd(options.last7.endIso);
      }
      w.editDateMode(mode);
    }} className={`min-h-10 rounded-lg border px-3 py-2 text-sm font-medium ${w.dateMode === mode ? 'border-dash-accent bg-dash-accent text-[#0b1728]' : 'border-dash-border text-dash-ink hover:bg-dash-bg'}`}>{label}</button>)}</div>
    {w.dateMode === 'custom' && <WizardDateRangeFields startIso={w.customStart} endIso={w.customEnd} minIso={importingApi ? undefined : w.dateBounds?.minIso} maxIso={importingApi ? reportCalendarYesterday(new Date(), w.clientTimezone) : calendar.endIso} onStartChange={w.editCustomStart} onEndChange={w.editCustomEnd} />}
    <p aria-live="polite" className="text-sm text-dash-ink-secondary">Report dates: {range?.startIso || 'Choose start'} – {range?.endIso || 'Choose end'} · {w.clientTimezone}</p>
  </section>;
}
