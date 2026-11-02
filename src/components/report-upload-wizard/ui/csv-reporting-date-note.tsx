"use client";
import { csvReportingCalendar } from "@/lib/nre/csv-reporting-calendar";
import type { CsvDateBounds } from "@/lib/nre/date-range";
export function CsvReportingDateNote({ bounds, timezone, now = new Date() }: { bounds: CsvDateBounds | null | undefined; timezone: string; now?: Date }) {
  const calendar = csvReportingCalendar(bounds, now, timezone);
  if (!bounds || !calendar.adjusted) return null;
  const format = (iso: string) => new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));
  return <section role="status" className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm nre-wizard-confidence--warn"><p className="font-semibold">Using the latest available CSV date: {format(calendar.endIso)}</p><p className="mt-1">Your CSV covers {format(bounds.minIso)} through {format(bounds.maxIso)}. It does not include yesterday ({format(calendar.yesterday)}). Report presets use the latest available day instead. Review the reporting dates shown below; missing days are not treated as zero.</p></section>;
}
