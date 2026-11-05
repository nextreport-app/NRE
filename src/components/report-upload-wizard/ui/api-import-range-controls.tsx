"use client";

import type { DateRangeIso } from "@/lib/nre/date-range";
import { computeLastNDaysIsoRange } from "@/lib/nre/api-date-range";
import { reportCalendarYesterday } from "@/lib/nre/report-period-selection";
import { WizardDateRangeFields } from "./wizard-date-picker";

export type ApiImportWindow = { preset: 'report' | '30' | '90' | '180' | 'custom'; startIso: string; endIso: string };
export function selectedApiImportRange(window: ApiImportWindow, timezone: string, now = new Date()): DateRangeIso | undefined {
  if (window.preset === 'report') return undefined;
  if (window.preset === 'custom') return { startIso: window.startIso, endIso: window.endIso };
  const range = computeLastNDaysIsoRange(now, timezone, Number(window.preset));
  return { startIso: range.sinceIso, endIso: range.untilIso };
}
export function ApiImportRangeControls({ value, onChange, timezone }: { value: ApiImportWindow; onChange: (value: ApiImportWindow) => void; timezone: string }) {
  return <section className="space-y-3 rounded-lg border border-dash-border bg-dash-card p-4">
    <h3 className="text-sm font-semibold text-dash-ink">Data to fetch from Meta</h3>
    <p className="text-xs text-dash-ink-secondary">Fetch daily data, then choose your report below. Any extra dates required by the report are included automatically.</p>
    <div className="flex flex-wrap gap-2">{([['report','Match report dates'], ['30','Last 30 days'], ['90','Last 3 months (90 days)'], ['180','Last 6 months (180 days)'], ['custom','Custom date range']] as const).map(([preset,label]) => <button key={preset} type="button" aria-pressed={value.preset === preset} onClick={() => {
      const current = selectedApiImportRange(value, timezone);
      onChange({ preset, startIso: current?.startIso ?? '', endIso: current?.endIso ?? '' });
    }} className={`min-h-10 rounded-lg border px-3 py-2 text-sm font-medium ${value.preset === preset ? 'border-dash-accent bg-dash-accent text-[#0b1728]' : 'border-dash-border text-dash-ink hover:bg-dash-bg'}`}>{label}</button>)}</div>
    {value.preset === 'custom' && <WizardDateRangeFields startLabel="Fetch start date" endLabel="Fetch end date" startIso={value.startIso} endIso={value.endIso} maxIso={reportCalendarYesterday(new Date(), timezone)} onStartChange={startIso => onChange({ ...value, startIso })} onEndChange={endIso => onChange({ ...value, endIso })} />}
  </section>;
}
