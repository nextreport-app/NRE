"use client";
import { formatClientCalendarRange } from "@/lib/client-date-format";

import { csvReportingCalendar } from "@/lib/nre/csv-reporting-calendar";
import { useState } from "react";
import { dailyPeriodLabel, dailyPresetRange } from "@/lib/nre/daily-period-selection";
import { ComparisonPeriodControls } from "./comparison-period-controls";
import { MonthlyPeriodControls } from "./monthly-period-controls";
import { WizardDatePicker, WizardDateRangeFields } from "./wizard-date-picker";
import { useWizardContext } from "../wizard-context";
import { reportCalendarYesterday } from "@/lib/nre/report-period-selection";

/** Four visible report choices reuse the existing safe engine modes. */
export function ReportPeriodControls({ stage = "import" }: { stage?: "import" | "generate" }) {
  const w = useWizardContext();
  const [customDaily, setCustomDaily] = useState(false);
  const [datesExpanded, setDatesExpanded] = useState(false);
  if (w.reportType === "COMPARISON") return <ComparisonPeriodControls stage={stage} />;
  if (!["MONTHLY", "DAILY", "HISTORICAL", "DAY_BREAKDOWN"].includes(w.reportType)) return null;
  const calendar = csvReportingCalendar(w.dataSourceMode === "api" && w.step === 1 ? null : w.dateBounds, new Date(), w.clientTimezone);
  const now = calendar.now;
  const yesterday = reportCalendarYesterday(now, w.clientTimezone);
  const custom = w.dateMode === "custom";
  const changeDates = <button type="button" aria-expanded={datesExpanded} onClick={() => setDatesExpanded(value => !value)} className="shrink-0 text-sm font-medium text-dash-accent hover:underline">{datesExpanded ? "Hide date options" : "Change dates"}</button>;
  if (stage === "generate" && ["DAILY", "DAY_BREAKDOWN"].includes(w.reportType)) {
    const start = custom && w.customStart ? w.customStart : yesterday;
    const end = custom && w.customEnd ? w.customEnd : yesterday;
    const label = (w.clientCurrency ? formatClientCalendarRange(start, end, w.clientCurrency) : new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).formatRange(new Date(start + "T12:00:00Z"), new Date(end + "T12:00:00Z")));
    return <section className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-dash-border bg-dash-card p-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-dash-ink-secondary">Report period</p><p className="mt-1 text-sm font-medium text-dash-ink">{w.reportType === "DAY_BREAKDOWN" && <span className="block font-semibold">{dailyPeriodLabel({ startIso: start, endIso: end }, now, w.clientTimezone).replace(/^Yesterday$/, calendar.adjusted ? "Latest CSV day" : "Yesterday")}</span>}{label}</p></div>{changeDates}{datesExpanded && <div className="w-full border-t border-dash-border pt-4"><ReportPeriodControls /></div>}</section>;
  }
  function chooseRange(start: string, end: string) { w.editDateMode("custom"); w.editCustomStart(start); w.editCustomEnd(end); }
  if (w.reportType === "DAILY") return <WizardDatePicker currency={w.clientCurrency} label="Report day" value={custom ? w.customStart : yesterday} maxIso={yesterday} onChange={day => chooseRange(day, day)} />;
  if (w.reportType === "DAY_BREAKDOWN") {
    const start = custom && w.customStart ? w.customStart : yesterday;
    const end = custom && w.customEnd ? w.customEnd : yesterday;
    return <section className="space-y-3">
      <h3 className="text-sm font-semibold text-dash-ink">Which days would you like to report?</h3>
      <div className="flex flex-wrap gap-2">{[1, 7, 14, 30].map(days => {
        const range = dailyPresetRange(days, now, w.clientTimezone);
        const active = !customDaily && start === range.startIso && end === range.endIso;
        return <button key={days} type="button" aria-pressed={active} onClick={() => { setCustomDaily(false); chooseRange(range.startIso, range.endIso); }} className={`rounded-lg border px-3 py-2 text-xs font-medium ${active ? "border-dash-accent bg-dash-accent text-[#0b1728]" : "border-dash-border text-dash-ink hover:bg-dash-card"}`}>{days === 1 ? calendar.adjusted ? "Latest CSV day" : "Yesterday" : `Last ${days} days`}</button>;
      })}<button type="button" aria-pressed={customDaily || dailyPeriodLabel({ startIso: start, endIso: end }, now, w.clientTimezone) === "Custom date range"} onClick={() => setCustomDaily(true)} className={`rounded-lg border px-3 py-2 text-xs font-medium ${customDaily || dailyPeriodLabel({ startIso: start, endIso: end }, now, w.clientTimezone) === "Custom date range" ? "border-dash-accent bg-dash-accent text-[#0b1728]" : "border-dash-border text-dash-ink"}`}>Custom date range</button></div>
      <WizardDateRangeFields currency={w.clientCurrency} startIso={start} endIso={end} maxIso={yesterday} onStartChange={day => { setCustomDaily(true); chooseRange(day, end < day ? day : end); }} onEndChange={day => { setCustomDaily(true); chooseRange(start > day ? day : start, day); }} />
      <p className="text-xs text-dash-ink-secondary">{w.dataSourceMode === "api" ? "Meta data needed:" : "CSV coverage needed:"} {(w.clientCurrency ? formatClientCalendarRange(start, end, w.clientCurrency) : new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).formatRange(new Date(start + "T12:00:00Z"), new Date(end + "T12:00:00Z")))}. {w.dataSourceMode === "api" ? "Daily data will be fetched for the report." : "Your CSV must have Day-wise breakdown covering this entire range."} Each table row combines your selected campaigns for one day; missing days are not treated as zero delivery.</p>
      {w.customRangeError && <p className="text-sm text-red-400">{w.customRangeError}</p>}
    </section>;
  }
  return <MonthlyPeriodControls stage={stage} />;
}
