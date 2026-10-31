"use client";

import { ComparisonPeriodControls } from "./comparison-period-controls";
import { ReportMonthPicker } from "./report-month-picker";
import { WizardDatePicker, WizardDateRangeFields } from "./wizard-date-picker";
import { useWizardContext } from "../wizard-context";
import { historicalPeriods, monthPeriod, reportCalendarYesterday, reportPeriodAnchor } from "@/lib/nre/report-period-selection";
import { getCalendarDateInTimezone } from "@/lib/nre/dates";

/** Four visible report choices reuse the existing safe engine modes. */
export function ReportPeriodControls({ stage = "import" }: { stage?: "import" | "generate" }) {
  const w = useWizardContext();
  if (w.reportType === "COMPARISON") return <ComparisonPeriodControls stage={stage} />;
  if (!["MONTHLY", "DAILY", "HISTORICAL", "DAY_BREAKDOWN"].includes(w.reportType)) return null;
  const now = new Date();
  const yesterday = reportCalendarYesterday(now, w.clientTimezone);
  const today = getCalendarDateInTimezone(now, w.clientTimezone);
  const currentMonth = `${today.year}-${String(today.month).padStart(2, "0")}`;
  const custom = w.dateMode === "custom";
  const changeDates = <button type="button" onClick={() => w.setStep(1)} className="shrink-0 text-sm font-medium text-dash-accent hover:underline">Change dates</button>;
  if (stage === "generate" && ["DAILY", "DAY_BREAKDOWN"].includes(w.reportType)) {
    const start = custom && w.customStart ? w.customStart : yesterday;
    const end = custom && w.customEnd ? w.customEnd : yesterday;
    const label = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).formatRange(new Date(start + "T12:00:00Z"), new Date(end + "T12:00:00Z"));
    return <section className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-dash-border bg-dash-card p-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-dash-ink-secondary">Report period</p><p className="mt-1 text-sm font-medium text-dash-ink">{label}</p></div>{changeDates}</section>;
  }
  function chooseRange(start: string, end: string) { w.editDateMode("custom"); w.editCustomStart(start); w.editCustomEnd(end); }
  if (w.reportType === "DAILY") return <WizardDatePicker label="Report day" value={custom ? w.customStart : yesterday} maxIso={yesterday} onChange={day => chooseRange(day, day)} />;
  if (w.reportType === "DAY_BREAKDOWN") {
    const start = custom && w.customStart ? w.customStart : yesterday;
    const end = custom && w.customEnd ? w.customEnd : yesterday;
    return <section className="space-y-3">
      <div className="flex flex-wrap gap-2"><button type="button" onClick={() => chooseRange(yesterday, yesterday)} className="rounded-md border border-dash-border px-3 py-1.5 text-xs text-dash-ink hover:bg-dash-card">Yesterday</button><button type="button" onClick={() => { const day = new Date(yesterday + "T12:00:00Z"); day.setUTCDate(day.getUTCDate() - 6); chooseRange(day.toISOString().slice(0, 10), yesterday); }} className="rounded-md border border-dash-border px-3 py-1.5 text-xs text-dash-ink hover:bg-dash-card">Last 7 days</button></div>
      <WizardDateRangeFields startIso={start} endIso={end} minIso={w.dateBounds?.minIso} maxIso={w.dateBounds?.maxIso && w.dateBounds.maxIso < yesterday ? w.dateBounds.maxIso : yesterday} onStartChange={day => chooseRange(day, end < day ? day : end)} onEndChange={day => chooseRange(start > day ? day : start, day)} />
      <p className="text-xs text-dash-ink-secondary">One row per day in your CSV. Select the same start and end date for a single-day table.</p>
      {w.customRangeError && <p className="text-sm text-red-400">{w.customRangeError}</p>}
    </section>;
  }
  const count = w.reportType === "HISTORICAL" ? w.historicalMonthCount : 1;
  const endMonth = custom && w.customEnd ? w.customEnd.slice(0, 7) : yesterday.slice(0, 7);
  function periodEnd(month: string) {
    return monthPeriod(month, now, w.clientTimezone).endIso;
  }
  function chooseMonths(number: number, month: string) {
    const end = periodEnd(month);
    const anchor = month === currentMonth ? reportPeriodAnchor(end, w.clientTimezone) : now;
    const ranges = historicalPeriods(number, month, month === currentMonth, anchor, w.clientTimezone);
    w.handleReportTypeChange(number > 1 ? "HISTORICAL" : "MONTHLY");
    w.editHistoricalMonthCount(number);
    chooseRange(ranges[0].startIso, end);
  }
  const end = custom && w.customEnd ? w.customEnd : periodEnd(endMonth);
  const first = new Date(`${endMonth}-01T12:00:00Z`); first.setUTCMonth(first.getUTCMonth() - count + 1);
  const start = first.toISOString().slice(0, 10);
  const rangeLabel = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).formatRange(new Date(start + "T12:00:00Z"), new Date(end + "T12:00:00Z"));
  const startMonth = start.slice(0, 7);
  function shiftMonth(month: string, offset: number) {
    const date = new Date(`${month}-01T12:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() + offset);
    return date.toISOString().slice(0, 7);
  }
  function chooseMonthRange(from: string, to: string) {
    const a = new Date(`${from}-01T12:00:00Z`), b = new Date(`${to}-01T12:00:00Z`);
    const months = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + b.getUTCMonth() - a.getUTCMonth() + 1;
    chooseMonths(months, to);
  }
  const latestMonth = yesterday.slice(0, 7);
  const shortcuts = [
    { label: "Current month to date", from: currentMonth, to: currentMonth },
    { label: "Previous month", from: shiftMonth(currentMonth, -1), to: shiftMonth(currentMonth, -1) },
    { label: "Last 3 complete months", from: shiftMonth(currentMonth, -3), to: shiftMonth(currentMonth, -1) },
    { label: "Last 6 complete months", from: shiftMonth(currentMonth, -6), to: shiftMonth(currentMonth, -1) },
  ];
  const periods = historicalPeriods(count, endMonth, endMonth === currentMonth, endMonth === currentMonth ? reportPeriodAnchor(end, w.clientTimezone) : now, w.clientTimezone);
  if (stage === "generate") return <section className="rounded-xl border border-dash-border bg-dash-card p-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-dash-ink-secondary">Report period</p><p className="mt-1 text-sm font-medium text-dash-ink">{rangeLabel}</p></div>{changeDates}</div>
    <p className="mt-3 text-xs text-dash-ink-secondary">{count === 1 ? "1 month" : `${count} months, shown separately`}</p>
    <ul className="mt-2 grid gap-1.5 text-xs text-dash-ink-secondary sm:grid-cols-2">{periods.map((period, index) => <li key={period.startIso}>{new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(period.startIso + "T12:00:00Z"))}: {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).formatRange(new Date(period.startIso + "T12:00:00Z"), new Date((index === periods.length - 1 ? end : period.endIso) + "T12:00:00Z"))}{period.startIso.slice(0, 7) === currentMonth ? " (MTD)" : " (full month)"}</li>)}</ul>
  </section>;
  return <section className="space-y-4 rounded-xl border border-dash-border bg-dash-bg/40 p-4">
    <div><h3 className="text-sm font-semibold text-dash-ink">Which months would you like to report?</h3><p className="mt-1 text-xs text-dash-ink-secondary">Choose one month or a range of up to 12 months. Each month is shown separately.</p></div>
    <div className="flex flex-wrap gap-2">{shortcuts.filter(option => option.to <= latestMonth).map(option => <button key={option.label} type="button" aria-pressed={startMonth === option.from && endMonth === option.to} onClick={() => chooseMonthRange(option.from, option.to)} className={`rounded-lg border px-3 py-2 text-xs font-medium ${startMonth === option.from && endMonth === option.to ? "border-dash-accent bg-dash-accent text-[#0b1728]" : "border-dash-border text-dash-ink hover:bg-dash-card"}`}>{option.label}</button>)}</div>
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1"><p className="text-[13px] font-medium text-dash-ink-secondary">From month</p><ReportMonthPicker label="From month" showPartialLabel={false} value={startMonth} currentMonth={currentMonth} maxMonth={latestMonth} onChange={month => chooseMonthRange(month, month > endMonth ? month : endMonth > shiftMonth(month, 11) ? shiftMonth(month, 11) : endMonth)} /></div>
      <div className="space-y-1"><p className="text-[13px] font-medium text-dash-ink-secondary">To month</p><ReportMonthPicker label="To month" value={endMonth} currentMonth={currentMonth} maxMonth={latestMonth} partialLabel={end < yesterday ? "Month to date" : "Through yesterday"} onChange={month => chooseMonthRange(month < startMonth ? month : startMonth < shiftMonth(month, -11) ? shiftMonth(month, -11) : startMonth, month)} /></div>
    </div>
    <div className="rounded-lg border border-dash-border bg-dash-card/50 p-3">
      <p className="text-xs font-semibold text-dash-ink">{count === 1 ? "1 month selected" : `${count} months selected`}</p>
      <ul className="mt-2 grid gap-1.5 text-xs text-dash-ink-secondary sm:grid-cols-2">{periods.map((period, index) => <li key={period.startIso}>{new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(period.startIso + "T12:00:00Z"))}: {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).formatRange(new Date(period.startIso + "T12:00:00Z"), new Date((index === periods.length - 1 ? end : period.endIso) + "T12:00:00Z"))}{period.startIso.slice(0, 7) === currentMonth ? " (MTD)" : " (full month)"}</li>)}</ul>
    </div>
    <p className="text-xs leading-relaxed text-dash-ink-secondary">CSV coverage needed: {rangeLabel}. Upload a CSV with Day-wise breakdown for this entire date range.</p>
  </section>;
}
