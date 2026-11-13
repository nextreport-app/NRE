"use client";
import { formatClientCalendarRange } from "@/lib/client-date-format";

import { useState } from "react";
import { useWizardContext } from "../wizard-context";
import { csvReportingCalendar } from "@/lib/nre/csv-reporting-calendar";
import { historicalPeriods, monthPeriod, reportCalendarYesterday, reportPeriodAnchor } from "@/lib/nre/report-period-selection";
import { getCalendarDateInTimezone } from "@/lib/nre/dates";
import { ReportMonthPicker } from "./report-month-picker";

const monthName = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const shortMonthName = new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" });
const dayName = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
const fullDate = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
const date = (iso: string) => new Date(`${iso}T12:00:00Z`);
function shiftMonth(month: string, offset: number) {
  const value = date(`${month}-01`);
  value.setUTCMonth(value.getUTCMonth() + offset);
  return value.toISOString().slice(0, 7);
}

/** CSV and API share the same month selection; only source-coverage guidance differs. */
export function MonthlyPeriodControls({ stage = "import" }: { stage?: "import" | "generate" }) {
  const w = useWizardContext();
  const displayRange = (start: string, end: string) => w.clientCurrency ? formatClientCalendarRange(start, end, w.clientCurrency) : dayName.formatRange(date(start), date(end));
  const [customMonths, setCustomMonths] = useState(false);
  const [datesExpanded, setDatesExpanded] = useState(false);
  const calendar = csvReportingCalendar(w.dataSourceMode === "api" && w.step === 1 ? null : w.dateBounds, new Date(), w.clientTimezone);
  const now = calendar.now;
  const yesterday = reportCalendarYesterday(now, w.clientTimezone);
  const today = getCalendarDateInTimezone(now, w.clientTimezone);
  const currentMonth = `${today.year}-${String(today.month).padStart(2, "0")}`;
  const count = w.reportType === "HISTORICAL" ? w.historicalMonthCount : 1;
  const custom = w.dateMode === "custom";
  const endMonth = custom && w.customEnd ? w.customEnd.slice(0, 7) : yesterday.slice(0, 7);
  const end = custom && w.customEnd ? w.customEnd : monthPeriod(endMonth, now, w.clientTimezone).endIso;
  const startMonth = shiftMonth(endMonth, 1 - count);
  const start = `${startMonth}-01`;
  const latestMonth = yesterday.slice(0, 7);
  const shortcuts = [
    { label: calendar.adjusted ? "Latest CSV month" : "This month so far", from: currentMonth, to: currentMonth },
    { label: "Previous month", from: shiftMonth(currentMonth, -1), to: shiftMonth(currentMonth, -1) },
    { label: "Last 3 complete months", from: shiftMonth(currentMonth, -3), to: shiftMonth(currentMonth, -1) },
  ].filter(option => option.to <= latestMonth);
  const matchedShortcut = shortcuts.find(option => startMonth === option.from && endMonth === option.to
    && end === monthPeriod(option.to, now, w.clientTimezone).endIso);
  const showCustom = customMonths || !matchedShortcut;
  const periods = historicalPeriods(count, endMonth, endMonth === currentMonth,
    endMonth === currentMonth ? reportPeriodAnchor(end, w.clientTimezone) : now, w.clientTimezone);
  const [year, month] = endMonth.split("-").map(Number);
  const partial = end < new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  const completeCount = count - (partial ? 1 : 0);
  const completeLabel = `${completeCount} complete month${completeCount === 1 ? "" : "s"}`;
  const summary = partial ? count === 1 ? "Month to date" : `${completeLabel} + ${shortMonthName.format(date(end))} to date` : completeLabel;
  const monthsLabel = startMonth === endMonth ? monthName.format(date(start)) : monthName.formatRange(date(start), date(`${endMonth}-01`));
  const partialNote = end === calendar.yesterday ? "Through yesterday"
    : calendar.adjusted && end === calendar.endIso ? "Through latest CSV day" : "Selected dates";

  function chooseMonths(from: string, to: string) {
    const a = date(`${from}-01`), b = date(`${to}-01`);
    const number = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + b.getUTCMonth() - a.getUTCMonth() + 1;
    const endIso = monthPeriod(to, now, w.clientTimezone).endIso;
    const ranges = historicalPeriods(number, to, to === currentMonth,
      to === currentMonth ? reportPeriodAnchor(endIso, w.clientTimezone) : now, w.clientTimezone);
    w.handleReportTypeChange(number > 1 ? "HISTORICAL" : "MONTHLY", { initializeDates: false });
    w.editHistoricalMonthCount(number);
    w.editDateMode("custom");
    w.editCustomStart(ranges[0].startIso);
    w.editCustomEnd(endIso);
  }

  const selectionSummary = <div className="rounded-lg border border-dash-border bg-dash-card/50 p-3" aria-label="Selected reporting months">
    <p className="text-sm font-semibold text-dash-ink">{monthsLabel} · {summary}</p>
    {partial && <p className="mt-1 text-xs text-dash-ink-secondary">{displayRange(`${endMonth}-01`, end)} · {partialNote}</p>}
    <details className="mt-2 text-xs text-dash-ink-secondary">
      <summary className="cursor-pointer font-medium hover:text-dash-ink">View monthly breakdown</summary>
      <ul className="mt-2 grid grid-cols-1 gap-1.5">{periods.map((period, index) => {
        const through = index === periods.length - 1 ? end : period.endIso;
        return <li key={period.startIso}>{monthName.format(date(period.startIso))}: {displayRange(period.startIso, through)}{index === periods.length - 1 && partial ? " (MTD)" : " (full month)"}</li>;
      })}</ul>
    </details>
  </div>;

  if (stage === "generate") return <section className="rounded-xl border border-dash-border bg-dash-card p-4">
    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs font-semibold uppercase tracking-wide text-dash-ink-secondary">Report period</p><p className="mt-1 text-sm font-medium text-dash-ink">{w.clientCurrency ? formatClientCalendarRange(start, end, w.clientCurrency) : fullDate.formatRange(date(start), date(end))}</p></div>
      <button type="button" aria-expanded={datesExpanded} onClick={() => setDatesExpanded(value => !value)} className="shrink-0 text-sm font-medium text-dash-accent hover:underline">{datesExpanded ? "Hide date options" : "Change dates"}</button>
    </div>
    {selectionSummary}
    {datesExpanded && <div className="mt-4 border-t border-dash-border pt-4"><MonthlyPeriodControls /></div>}
  </section>;

  return <section className="space-y-4 rounded-xl border border-dash-border bg-dash-bg/40 p-4">
    <div><h3 className="text-sm font-semibold text-dash-ink">Reporting months</h3><p className="mt-1 text-xs text-dash-ink-secondary">Each month appears separately in your report.</p></div>
    <div className="flex flex-wrap gap-2">{shortcuts.map(option => {
      const active = !showCustom && matchedShortcut === option;
      return <button key={option.label} type="button" aria-pressed={active} onClick={() => { setCustomMonths(false); chooseMonths(option.from, option.to); }} className={`rounded-lg border px-3 py-2 text-xs font-medium ${active ? "border-dash-accent bg-dash-accent text-[#0b1728]" : "border-dash-border text-dash-ink hover:bg-dash-card"}`}>{option.label}</button>;
    })}<button type="button" aria-pressed={showCustom} onClick={() => setCustomMonths(true)} className={`rounded-lg border px-3 py-2 text-xs font-medium ${showCustom ? "border-dash-accent bg-dash-accent text-[#0b1728]" : "border-dash-border text-dash-ink hover:bg-dash-card"}`}>Custom range</button></div>
    {showCustom && <div className="space-y-2">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1"><p className="text-[13px] font-medium text-dash-ink-secondary">From month</p><ReportMonthPicker label="From month" showPartialLabel={false} value={startMonth} currentMonth={currentMonth} maxMonth={latestMonth} onChange={value => chooseMonths(value, value > endMonth ? value : endMonth > shiftMonth(value, 11) ? shiftMonth(value, 11) : endMonth)} /></div>
        <div className="space-y-1"><p className="text-[13px] font-medium text-dash-ink-secondary">To month</p><ReportMonthPicker label="To month" value={endMonth} currentMonth={currentMonth} maxMonth={latestMonth} partialLabel={partialNote} onChange={value => chooseMonths(value < startMonth ? value : startMonth < shiftMonth(value, -11) ? shiftMonth(value, -11) : startMonth, value)} /></div>
      </div>
      <p className="text-xs text-dash-ink-secondary">Select up to 12 consecutive months.</p>
    </div>}
    {selectionSummary}
    {w.dataSourceMode !== "api" && <p className="text-xs leading-relaxed text-dash-ink-secondary">Your CSV must have Day-wise breakdown covering the selected months.</p>}
  </section>;
}
