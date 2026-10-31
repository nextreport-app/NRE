"use client";
import { useWizardContext } from "../wizard-context";
import { WizardDateRangeFields } from "./wizard-date-picker";
import { reportCalendarYesterday } from "@/lib/nre/report-period-selection";
function formatIsoRange(range: { startIso: string; endIso: string }) {
  if (range.startIso > range.endIso) return `${range.startIso} – ${range.endIso}`;
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).formatRange(new Date(range.startIso + "T12:00:00Z"), new Date(range.endIso + "T12:00:00Z"));
}

export function ComparisonPeriodControls({ stage }: { stage: "import" | "generate" }) {
  const w = useWizardContext();
  const a = w.comparisonPeriodA, b = w.comparisonPeriodB;
  const max = reportCalendarYesterday(new Date(), w.clientTimezone);
  const complete = !!(a?.startIso && a.endIso && b?.startIso && b.endIso);
  const invalid = complete && (a!.startIso > a!.endIso || b!.startIso > b!.endIso || a!.endIso > max || b!.endIso > max);
  const first = complete ? [a!.startIso, b!.startIso].sort()[0] : "";
  const last = complete ? [a!.endIso, b!.endIso].sort().at(-1)! : "";
  return <section className="space-y-4 rounded-xl border border-dash-border bg-dash-card p-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-sm font-semibold text-dash-ink">{stage === "import" ? "Which periods would you like to compare?" : "Comparison periods"}</h3><p className="mt-1 text-xs text-dash-ink-secondary">Period A is compared with Period B using the same metrics.</p></div>{stage === "generate" && <button type="button" onClick={() => w.setStep(1)} className="text-sm font-medium text-dash-accent hover:underline">Change dates</button>}</div>
    {stage === "import" && <div className="flex flex-wrap gap-2">{([{ value: "thisWeek", label: "Last 7 days vs previous 7 days" }, { value: "thisMonth", label: "Last two complete months" }, { value: "custom", label: "Custom dates" }] as const).map(option => <button key={option.value} type="button" aria-pressed={w.comparisonPreset === option.value} onClick={() => w.handleComparisonPresetSelect(option.value)} className={`rounded-lg border px-3 py-2 text-xs font-medium ${w.comparisonPreset === option.value ? "border-dash-accent bg-dash-accent text-[#0b1728]" : "border-dash-border text-dash-ink hover:bg-dash-bg"}`}>{option.label}</button>)}</div>}
    <div className="grid gap-4 sm:grid-cols-2">{([{ label: "Period A", range: a, update: w.updateComparisonPeriodA }, { label: "Period B", range: b, update: w.updateComparisonPeriodB }]).map(item => <div key={item.label} className="space-y-2 rounded-lg border border-dash-border bg-dash-bg/40 p-3"><p className="text-xs font-semibold text-dash-ink-secondary">{item.label}</p>{stage === "import" && w.comparisonPreset === "custom" ? <WizardDateRangeFields startIso={item.range?.startIso ?? ""} endIso={item.range?.endIso ?? ""} maxIso={max} onStartChange={iso => item.update("startIso", iso)} onEndChange={iso => item.update("endIso", iso)} /> : <p className="text-sm text-dash-ink">{item.range?.startIso && item.range.endIso ? formatIsoRange(item.range) : "Choose dates on Import"}</p>}</div>)}</div>
    {invalid && <p role="alert" className="text-sm text-red-400">Choose valid date ranges ending no later than yesterday.</p>}
    {stage === "import" && complete && !invalid && <p className="text-xs leading-relaxed text-dash-ink-secondary">CSV coverage needed: {formatIsoRange({ startIso: first, endIso: last })}. Export one CSV with Day-wise breakdown covering both periods.</p>}
  </section>;
}
