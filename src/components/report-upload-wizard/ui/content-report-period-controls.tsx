"use client";
import { useState } from "react";
import { useWizardContext } from "../wizard-context";
import { csvReportingCalendar } from "@/lib/nre/csv-reporting-calendar";
export function ContentReportPeriodControls() {
  const w = useWizardContext();
  const end = csvReportingCalendar(
    w.dataSourceMode === "api" ? null : w.dateBounds,
    new Date(),
    w.clientTimezone,
  ).endIso;
  const [customSelected, setCustomSelected] = useState(false);
  function startFor(days: number) {
    const start = new Date(end + "T12:00:00Z");
    start.setUTCDate(start.getUTCDate() - days + 1);
    return start.toISOString().slice(0, 10);
  }
  const selected = !customSelected && w.customEnd === end
    ? w.customStart === startFor(7) ? "last7"
      : w.customStart === startFor(30) ? "last30" : "custom"
    : "custom";
  function preset(days: number) {
    setCustomSelected(false);
    w.editDateMode("custom");
    w.editCustomStart(startFor(days));
    w.editCustomEnd(end);
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
        {([['last7', 'Last 7 days'], ['last30', 'Last 30 days'], ['custom', 'Custom date range']] as const).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            aria-pressed={selected === mode}
            onClick={() => mode === "custom" ? setCustomSelected(true) : preset(mode === "last7" ? 7 : 30)}
            className={`min-h-10 rounded-lg border px-3 py-2 text-sm font-medium ${selected === mode ? 'border-dash-accent bg-dash-accent text-[#0b1728]' : 'border-dash-border text-dash-ink hover:bg-dash-bg'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {selected === "custom" && <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-dash-ink-secondary">
          From
          <input
            aria-label="Report start date"
            type="date"
            value={w.customStart}
            max={w.customEnd || end}
            onChange={(event) => {
              w.editDateMode("custom");
              setCustomSelected(true);
              w.editCustomStart(event.target.value);
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
              w.editDateMode("custom");
              setCustomSelected(true);
              w.editCustomEnd(event.target.value);
            }}
            className="mt-1 block w-full rounded border border-dash-border bg-dash-card p-2 text-sm text-dash-ink"
          />
        </label>
      </div>}
    </details>
  );
}
