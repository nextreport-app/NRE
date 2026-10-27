"use client";

import { useWizardContext } from "../wizard-context";
import { historicalPeriods, monthPeriod, reportCalendarYesterday } from "@/lib/nre/report-period-selection";
import { getCalendarDateInTimezone } from "@/lib/nre/dates";

/** Same controls on Import and Generate; changes invalidate the existing preview. */
export function ReportPeriodControls() {
  const w = useWizardContext();
  if (!["MONTHLY", "DAILY", "HISTORICAL"].includes(w.reportType)) return null;
  const now = new Date();
  const yesterday = reportCalendarYesterday(now, w.clientTimezone);
  const today = getCalendarDateInTimezone(now, w.clientTimezone);
  const currentMonth = `${today.year}-${String(today.month).padStart(2, "0")}`;
  const previousMonth = new Date(Date.UTC(today.year, today.month - 1, 0)).toISOString().slice(0, 7);
  const custom = w.dateMode === "custom";
  const inputClass = "mt-1 block w-full rounded-md border border-dash-border bg-dash-sidebar px-3 py-2 text-[14px] text-dash-ink";
  function chooseRange(start: string, end: string) {
    w.editDateMode("custom"); w.editCustomStart(start); w.editCustomEnd(end);
  }
  if (w.reportType === "DAILY") return <label className="block text-[13px] text-dash-ink-secondary">Report day · yesterday by default
    <input type="date" aria-label="Report day" max={yesterday} value={custom ? w.customStart : yesterday} onChange={e => chooseRange(e.target.value, e.target.value)} className={inputClass} />
  </label>;
  if (w.reportType === "MONTHLY") {
    const month = custom ? w.customStart.slice(0, 7) : yesterday.slice(0, 7);
    const range = monthPeriod(month || yesterday.slice(0, 7), now, w.clientTimezone);
    return <div className="space-y-2"><label className="block text-[13px] text-dash-ink-secondary">Report month · current month is through yesterday
      <input type="month" aria-label="Report month" max={yesterday.slice(0, 7)} value={month} onChange={e => { if (e.target.value) { const r = monthPeriod(e.target.value, now, w.clientTimezone); chooseRange(r.startIso, r.endIso); } }} className={inputClass} />
    </label><p className="text-[12px] text-dash-ink-secondary">CSV needed: {range.startIso} – {range.endIso}. No weekly slides.</p></div>;
  }
  const includeCurrent = custom && w.customEnd?.slice(0, 7) === currentMonth;
  const endMonth = custom && w.customEnd ? w.customEnd.slice(0, 7) : previousMonth;
  const ranges = historicalPeriods(w.historicalMonthCount, endMonth, includeCurrent, now, w.clientTimezone);
  function chooseMonths(count: number, month: string, include: boolean) {
    w.editHistoricalMonthCount(count);
    const selected = historicalPeriods(count, month, include, now, w.clientTimezone);
    chooseRange(selected[0].startIso, selected[selected.length - 1].endIso);
  }
  return <div className="space-y-3">
    <div className="flex flex-wrap gap-2">{[3, 6].map(n => <button key={n} type="button" onClick={() => chooseMonths(n, previousMonth, false)} className="rounded-md border border-dash-border px-3 py-2 text-[13px] text-dash-ink hover:border-dash-accent">Last {n} completed months</button>)}</div>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-[13px] text-dash-ink-secondary">Number of months<select aria-label="Number of months" value={w.historicalMonthCount} onChange={e => chooseMonths(Number(e.target.value), endMonth, includeCurrent)} className={inputClass}>{Array.from({ length: 11 }, (_, i) => i + 2).map(n => <option key={n} value={n}>{n} months</option>)}</select></label>
      <label className="text-[13px] text-dash-ink-secondary">Ending month<input type="month" aria-label="Ending month" value={endMonth} max={includeCurrent ? currentMonth : previousMonth} onChange={e => { if (e.target.value) chooseMonths(w.historicalMonthCount, e.target.value, includeCurrent); }} className={inputClass} /></label>
    </div>
    <label className="flex items-center gap-2 text-[13px] text-dash-ink-secondary"><input type="checkbox" checked={includeCurrent} disabled={today.day === 1} onChange={e => chooseMonths(w.historicalMonthCount, e.target.checked ? currentMonth : previousMonth, e.target.checked)} />Include current partial month (MTD)</label>
    <p className="text-[12px] text-dash-ink-secondary">{ranges.map(r => r.fullMonthLabel).join(" · ")}</p>
    <p className="text-[12px] text-dash-ink-secondary">CSV needed: {ranges[0].startIso} – {ranges[ranges.length - 1].endIso}. Partial months are labelled MTD.</p>
  </div>;
}
