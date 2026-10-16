"use client";

import { AGENCY_CLIENT_LIMIT } from "@/lib/plan-labels";
import { useSiteCopy } from "@/hooks/use-site-copy";

function Cell({ children, header }: { children: React.ReactNode; header?: boolean }) {
  return (
    <td className={`border-t border-navy-border px-4 py-3 text-sm ${header ? "font-medium text-white" : "text-ink-secondary"}`}>
      {children}
    </td>
  );
}

export function PricingComparisonTable() {
  const { home } = useSiteCopy();
  const rows = home.pricingComparison;

  return (
    <div className="mt-16 overflow-x-auto rounded-xl border border-navy-border">
      <table className="w-full min-w-[520px] border-collapse text-left">
        <thead className="bg-navy-panel">
          <tr>
            <th scope="col" className="px-4 py-3 text-sm font-semibold text-white">
              {rows.featureColumn}
            </th>
            <th scope="col" className="px-4 py-3 text-sm font-semibold text-white">
              {rows.agencyColumn}
            </th>
            <th scope="col" className="px-4 py-3 text-sm font-semibold text-accent-orange">
              {rows.proColumn}
            </th>
          </tr>
        </thead>
        <tbody className="bg-navy">
          <tr>
            <Cell header>{rows.clientWorkspaces}</Cell>
            <Cell>{rows.agencyClients.replace("{n}", String(AGENCY_CLIENT_LIMIT))}</Cell>
            <Cell>{rows.unlimitedClients}</Cell>
          </tr>
          <tr>
            <Cell header>{rows.reportGeneration}</Cell>
            <Cell>{rows.unlimitedReports}</Cell>
            <Cell>{rows.unlimitedReports}</Cell>
          </tr>
          <tr>
            <Cell header>{rows.metaReporting}</Cell>
            <Cell>{rows.included}</Cell>
            <Cell>{rows.included}</Cell>
          </tr>
          <tr>
            <Cell header>{rows.otherPlatforms}</Cell>
            <Cell>{rows.roadmapIncluded}</Cell>
            <Cell>{rows.roadmapIncluded}</Cell>
          </tr>
          <tr>
            <Cell header>{rows.whiteLabel}</Cell>
            <Cell>{rows.included}</Cell>
            <Cell>{rows.included}</Cell>
          </tr>
          <tr>
            <Cell header>{rows.support}</Cell>
            <Cell>{rows.emailSupport}</Cell>
            <Cell>{rows.prioritySupport}</Cell>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
