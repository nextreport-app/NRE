"use client";

import {
  AGENCY_CLIENT_LIMIT,
  PROFESSIONAL_CLIENT_LIMIT,
  AGENCY_PLUS_CLIENT_LIMIT,
  getPlanDisplayName,
} from "@/lib/plan-labels";
import { useSiteCopy } from "@/hooks/use-site-copy";

export function PricingComparisonTable() {
  const { home } = useSiteCopy();
  const copy = home.pricingComparison;
  const rows = [
    [
      copy.clientWorkspaces,
      `Up to ${AGENCY_CLIENT_LIMIT} brands`,
      `Up to ${PROFESSIONAL_CLIENT_LIMIT} brands`,
      `Up to ${AGENCY_PLUS_CLIENT_LIMIT} brands`,
    ],
    [
      copy.reportGeneration,
      ...Array(3).fill("Unlimited, with fair-use safeguards"),
    ],
    [copy.metaReporting, ...Array(3).fill(copy.included)],
    [copy.whiteLabel, ...Array(3).fill(copy.included)],
    [
      copy.support,
      copy.emailSupport,
      copy.prioritySupport,
      copy.prioritySupport,
    ],
  ];
  return (
    <div
      className="mt-16 overflow-x-auto rounded-xl border border-navy-border"
      role="region"
      aria-label="Plan comparison"
      tabIndex={0}
    >
      <table className="w-full min-w-[640px] border-collapse text-left">
        <thead className="bg-navy-panel">
          <tr>
            {[
              copy.featureColumn,
              getPlanDisplayName("starter"),
              getPlanDisplayName("professional"),
              getPlanDisplayName("agency_plus"),
            ].map((label) => (
              <th
                key={label}
                scope="col"
                className="px-4 py-3 text-sm font-semibold text-white"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-navy">
          {rows.map(([label, ...values]) => (
            <tr key={label}>
              <th
                scope="row"
                className="border-t border-navy-border px-4 py-3 text-sm font-medium text-white"
              >
                {label}
              </th>
              {values.map((value, index) => (
                <td
                  key={index}
                  className="border-t border-navy-border px-4 py-3 text-sm text-ink-secondary"
                >
                  {value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
