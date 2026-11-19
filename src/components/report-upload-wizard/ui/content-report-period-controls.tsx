"use client";
import { useWizardContext } from "../wizard-context";
import { csvReportingCalendar } from "@/lib/nre/csv-reporting-calendar";
export function ContentReportPeriodControls() {
  const w = useWizardContext();
  const end = csvReportingCalendar(
    w.dataSourceMode === "api" ? null : w.dateBounds,
    new Date(),
    w.clientTimezone,
  ).endIso;
  function preset(days: number) {
    const start = new Date(end + "T12:00:00Z");
    start.setUTCDate(start.getUTCDate() - days + 1);
    w.setDateMode("custom");
    w.setCustomStart(start.toISOString().slice(0, 10));
    w.setCustomEnd(end);
  }
  return (
    <details className="rounded-xl border border-dash-border bg-dash-bg/30 p-4">
      <summary className="cursor-pointer text-sm font-medium text-dash-ink">
        Reporting period
        <span className="mt-1 block text-sm font-normal text-dash-ink-secondary">
          {w.customStart} – {w.customEnd}
        </span>
      </summary>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => preset(7)}
          className="rounded border border-dash-border px-3 py-2 text-sm text-dash-ink"
        >
          Last 7 days
        </button>
        <button
          type="button"
          onClick={() => preset(30)}
          className="rounded border border-dash-border px-3 py-2 text-sm text-dash-ink"
        >
          Last 30 days
        </button>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-dash-ink-secondary">
          From
          <input
            aria-label="Report start date"
            type="date"
            value={w.customStart}
            max={w.customEnd || end}
            onChange={(event) => {
              w.setDateMode("custom");
              w.setCustomStart(event.target.value);
            }}
            className="mt-1 block w-full rounded border border-dash-border bg-dash-card p-2 text-sm text-dash-ink"
          />
        </label>
        <label className="text-xs text-dash-ink-secondary">
          To
          <input
            aria-label="Report end date"
            type="date"
            value={w.customEnd}
            min={w.customStart}
            max={end}
            onChange={(event) => {
              w.setDateMode("custom");
              w.setCustomEnd(event.target.value);
            }}
            className="mt-1 block w-full rounded border border-dash-border bg-dash-card p-2 text-sm text-dash-ink"
          />
        </label>
      </div>
    </details>
  );
}
