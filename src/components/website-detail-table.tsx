"use client";
import { useState } from "react";
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
  const [all, setAll] = useState(false);
  const columns = all
    ? WEBSITE_DETAIL_COLUMNS
    : WEBSITE_DETAIL_COLUMNS.filter(([key]) =>
        [
          "sessions",
          "totalUsers",
          "screenPageViews",
          "engagementRate",
          "bounceRate",
          "keyEvents",
        ].includes(key),
      );
  return (
    <>
      <button
        className="mt-3 rounded-lg border border-dash-border px-3 py-2 text-xs"
        aria-expanded={all}
        onClick={() => setAll(!all)}
      >
        {all ? "Show key metrics" : "Show all metrics"}
      </button>
      <div className="mt-3 max-w-full overflow-x-auto">
        <table
          className="w-full text-left text-sm"
          style={{ minWidth: all ? 1100 : 760 }}
        >
          <thead>
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
