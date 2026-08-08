/** The public read-only share page's URL — see app/r/[token]/page.tsx. Shared by report-history-list.tsx (recent 10) and full-report-history-list.tsx (all reports). */
export function shareReportUrl(shareToken: string): string {
  return `nextreport.in/r/${shareToken}`;
}

export function formatReportDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}
