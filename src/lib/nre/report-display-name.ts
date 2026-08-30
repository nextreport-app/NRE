export type ReportDisplayNameType = "WEEKLY" | "MONTHLY" | "DAILY" | "COMPARISON" | "CREATIVE";

const TYPE_LABELS: Record<ReportDisplayNameType, string> = {
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  DAILY: "Daily",
  COMPARISON: "Comparison",
  CREATIVE: "Creative",
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

/**
 * "July 30 - August 5" from two "MM/DD/YYYY" strings (report-data.ts's
 * formatDateUS output, what Report.weekStart/weekEnd are always stored as —
 * see reports/route.ts's `data.fileDateRange.split(" to ")`).
 *
 * Deliberately NOT dates.ts's parseDate/getDateRangeShortLabel: parseDate's
 * whole-app job is guessing a raw CSV cell's date format, and for an
 * ambiguous "08/05/2026" (both parts ≤12) it assumes DD-MM-YY (documented
 * "assume Indian DD-MM-YY" — correct for the ad-platform CSVs it actually
 * parses). weekStart/weekEnd are never ambiguous here — they're always
 * MM/DD/YYYY, produced by this app's own formatDateUS — so reusing
 * parseDate on them would silently swap month/day on any date where both
 * are ≤12 (confirmed empirically: parseDate("08/05/2026") reads as May 8,
 * not August 5). This parses the known MM/DD/YYYY shape directly instead.
 */
function formatWeekRange(weekStart: string, weekEnd: string): string {
  const parse = (raw: string) => {
    const [month, day, year] = raw.split("/").map(Number);
    return { month, day, year };
  };
  const s = parse(weekStart);
  const e = parse(weekEnd);
  if (!s.month || !s.day || !e.month || !e.day) return `${weekStart} - ${weekEnd}`;
  const sm = MONTHS[s.month - 1];
  const em = MONTHS[e.month - 1];
  if (s.day === e.day && s.month === e.month && s.year === e.year) return `${sm} ${s.day}`;
  return `${sm} ${s.day} - ${em} ${e.day}`;
}

/**
 * The auto-generated default report name — "Weekly — July 30 - August 5" —
 * stored as Report.displayName at generation time (reports/route.ts) and
 * recomputed here as a fallback anywhere a pre-existing report has no
 * displayName of its own (rows created before this column existed).
 *
 * COMPARISON reports have no weekStart/weekEnd at all (see report-data.ts's
 * "Comparison reports" section) — periodLabel carries their own
 * "[periodA] vs [periodB]" text instead (ComparisonReportData's own
 * periodALabel/periodBLabel, already formatted the same way the comparison
 * cover slide's title uses).
 */
export function defaultReportDisplayName(
  reportType: ReportDisplayNameType,
  weekStart: string | null | undefined,
  weekEnd: string | null | undefined,
  periodLabel?: string | null,
): string {
  const typeLabel = TYPE_LABELS[reportType];
  if (reportType === "COMPARISON") {
    return periodLabel ? `${typeLabel} — ${periodLabel}` : typeLabel;
  }
  if (!weekStart || !weekEnd) return typeLabel;
  return `${typeLabel} — ${formatWeekRange(weekStart, weekEnd)}`;
}
