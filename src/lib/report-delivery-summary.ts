/** Email labels and date ranges must follow the saved report, never today's date. */
export function reportDeliverySummary(report: {
  reportType: string;
  summaryJson: string | null;
  weekStart: string | null;
  weekEnd: string | null;
}) {
  const labels: Record<string, string> = {
    WEEKLY: "Weekly",
    MONTHLY: "Monthly",
    HISTORICAL: "Multi-month",
    DAILY: "Single-day",
    DAY_BREAKDOWN: "Daily",
    COMPARISON: "Comparison",
  };
  let dateRange =
    report.weekStart && report.weekEnd
      ? `${report.weekStart} - ${report.weekEnd}`
      : "—";
  try {
    const saved = JSON.parse(report.summaryJson ?? "null");
    if (
      saved?.kind === "comparison" &&
      typeof saved.periodALabel === "string" &&
      typeof saved.periodBLabel === "string"
    )
      dateRange = `${saved.periodALabel} vs ${saved.periodBLabel}`;
    else if (typeof saved?.cover?.dateRange === "string")
      dateRange = saved.cover.dateRange;
  } catch {
    /* Legacy reports use stored period columns. */
  }
  return { reportType: labels[report.reportType] ?? "Performance", dateRange };
}
