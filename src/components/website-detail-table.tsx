"use client";
import type {
  WebsiteMetric,
  WebsiteMetrics,
} from "@/lib/website-dashboard/model";
export const WEBSITE_DETAIL_COLUMNS: Array<[WebsiteMetric, string]> = [
  ["sessions", "Sessions"],
  ["totalUsers", "Users"],
  ["newUsers", "New users"],
  ["screenPageViews", "Views"],
  ["engagedSessions", "Engaged sessions"],
  ["engagementRate", "Engagement"],
  ["bounceRate", "Bounce rate"],
  ["keyEvents", "Key events"],
  ["sessionKeyEventRate", "Key event rate"],
  ["averageSessionDuration", "Avg. session"],
];
export function formatWebsiteMetric(
  key: WebsiteMetric,
  value: number | null | undefined,
) {
  if (value == null) return "—";
  if (key === "averageSessionDuration") {
    const seconds = Math.round(value);
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  }
  return (
    new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(
      key.endsWith("Rate") ? value * 100 : value,
    ) + (key.endsWith("Rate") ? "%" : "")
  );
}
export function WebsiteDetailTable({
  rows,
  kind,
}: {
  rows: Array<Partial<WebsiteMetrics> & { name?: string; date?: string }>;
  kind: "date" | "page";
}) {
  const columns = WEBSITE_DETAIL_COLUMNS;
  return (
    <>
      <div className={`mt-3 max-w-full overflow-x-auto ${kind === "date" ? "max-h-[420px] overflow-y-auto" : ""}`}>
        <table
          className="w-full text-left text-sm"
          style={{ minWidth: 1100 }}
        >
          <thead className="sticky top-0 bg-dash-card">
            <tr>
              <th className="pb-3 pr-5">
                {kind === "date" ? "Date" : "Landing page"}
              </th>
              {columns.map(([key, label]) => (
                <th key={key} className="whitespace-nowrap pb-3 pr-4">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.date ?? row.name}
                className="border-t border-dash-border"
              >
                <th className="max-w-xs break-all py-3 pr-5 text-left font-normal">
                  {kind === "date"
                    ? row.date?.replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3")
                    : row.name}
                </th>
                {columns.map(([key]) => (
                  <td key={key} className="whitespace-nowrap py-3 pr-4">
                    {formatWebsiteMetric(key, row[key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
