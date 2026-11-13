"use client";

export function WizardPeriodSummary({ rows, onChangeDates }: {
  rows: { label: string; value: string }[];
  onChangeDates?: () => void;
}) {
  return <section aria-label="Report includes" className="rounded-lg border border-dash-border bg-dash-card [font-family:inherit]">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-dash-border px-4 py-3">
      <h3 className="text-sm font-semibold text-dash-ink">Report includes</h3>
      {onChangeDates && <button type="button" onClick={onChangeDates} className="min-h-9 rounded-md px-2 text-sm font-medium text-dash-accent hover:bg-dash-bg focus-visible:outline-2 focus-visible:outline-dash-accent">Change dates</button>}
    </div>
    <dl className="divide-y divide-dash-border/50 px-4">
      {rows.map(row => <div key={row.label} className="grid gap-1 py-2 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-baseline sm:gap-4">
        <dt className="text-[13px] leading-6 text-dash-ink-secondary">{row.label}</dt>
        <dd className="min-w-0 break-words text-sm font-normal leading-6 tracking-normal text-dash-ink [font-variant-numeric:normal]">{row.value}</dd>
      </div>)}
    </dl>
  </section>;
}
