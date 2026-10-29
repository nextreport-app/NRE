"use client";

import { ReportMonthPicker } from "./report-month-picker";
import { WizardDatePicker, WizardDateRangeFields } from "./wizard-date-picker";
import { useWizardContext } from "../wizard-context";
import { historicalPeriods, monthPeriod, reportCalendarYesterday, reportPeriodAnchor } from "@/lib/nre/report-period-selection";
import { getCalendarDateInTimezone } from "@/lib/nre/dates";

/** Four visible report choices reuse the existing safe engine modes. */
export function ReportPeriodControls({ stage = "import" }: { stage?: "import" | "generate" }) {
  const w = useWizardContext();
  if (!["MONTHLY", "DAILY", "HISTORICAL", "DAY_BREAKDOWN"].includes(w.reportType)) return null;
  const now = new Date();
  const yesterday = reportCalendarYesterday(now, w.clientTimezone);
  const today = getCalendarDateInTimezone(now, w.clientTimezone);
  const currentMonth = `${today.year}-${String(today.month).padStart(2, "0")}`;
  const custom = w.dateMode === "custom";
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
    const end = monthPeriod(month, now, w.clientTimezone).endIso;
    return month === currentMonth && w.dateBounds?.maxIso?.slice(0, 7) === month && w.dateBounds.maxIso < end ? w.dateBounds.maxIso : end;
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
  return <section className="space-y-2">
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
      <div className="space-y-1"><p className="text-[13px] font-medium text-dash-ink-secondary">{count === 1 ? "Report month" : "Ending month"}</p><ReportMonthPicker label={count === 1 ? "Report month" : "Ending month"} value={endMonth} currentMonth={currentMonth} maxMonth={yesterday.slice(0, 7)} partialLabel={end < yesterday ? "Month to date" : "Through yesterday"} onChange={month => chooseMonths(count, month)} /></div>
      <label className="space-y-1 text-[13px] font-medium text-dash-ink-secondary">Number of months<select aria-label="Number of months" value={count} onChange={event => chooseMonths(Number(event.target.value), endMonth)} className="block w-full rounded-lg border border-dash-border bg-dash-bg px-3 py-3 text-sm text-dash-ink">{Array.from({ length: 12 }, (_, index) => index + 1).map(n => <option key={n} value={n}>{n === 1 ? "1 month" : `${n} months`}</option>)}</select></label>
    </div>
    <p className="text-xs leading-relaxed text-dash-ink-secondary">{stage === "import" ? "CSV coverage" : "Reporting dates"}: {rangeLabel}{stage === "import" ? " · Day rows or campaign/month totals" : ""}</p>
    {count > 1 && <p className="text-xs text-dash-ink-secondary">Each month is shown separately, followed by a monthly overview table.</p>}
  </section>;
}
