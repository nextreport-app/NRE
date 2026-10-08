"use client";

import { useId, useState } from "react";
import Link from "next/link";
import {
  META_CSV_BASE_COLUMNS,
  META_CSV_EXPORT_PATH,
  META_CSV_OBJECTIVE_COLUMN_GROUPS,
  metaCsvColumnsForObjectiveGroup,
} from "@/lib/nre/meta-csv-export-guide";

/** Meta-only — export path, wrong-file warning, and objective column checklist on Import. */
export function WizardMetaCsvExportHelp() {
  const selectId = useId();
  const [groupId, setGroupId] = useState<string>("traffic_lpv");
  const columns = metaCsvColumnsForObjectiveGroup(groupId);
  const group = META_CSV_OBJECTIVE_COLUMN_GROUPS.find((g) => g.id === groupId);

  return (
    <div className="space-y-3 rounded-lg border border-amber-500/35 bg-amber-950/20 px-4 py-3 text-[13px] leading-relaxed text-dash-ink-secondary">
      <div>
        <p className="text-[14px] font-semibold text-amber-100">{META_CSV_EXPORT_PATH.title}</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>
            <span className="text-white">Do:</span> {META_CSV_EXPORT_PATH.doThis}
          </li>
          <li>
            <span className="text-amber-200">Avoid:</span> {META_CSV_EXPORT_PATH.notThis}
          </li>
          <li>{META_CSV_EXPORT_PATH.dayBreakdown}</li>
        </ul>
      </div>

      <div className="rounded-md border border-dash-border/60 bg-[#0d1b2e]/50 px-3 py-2.5">
        <label htmlFor={selectId} className="text-[13px] font-semibold text-white">
          Metrics to include in your CSV
        </label>
        <p className="mt-0.5 text-[12px] text-dash-ink-muted">
          Base columns for every report, plus extras for how your campaigns optimize. Match Ads Manager column picker
          before export.
        </p>
        <select
          id={selectId}
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
          className="mt-2 w-full rounded-md border border-dash-border bg-dash-bg px-2.5 py-2 text-[13px] text-white"
        >
          <option value="_base">All campaigns — base only</option>
          {META_CSV_OBJECTIVE_COLUMN_GROUPS.map((g) => (
            <option key={g.id} value={g.id}>
              {g.label}
            </option>
          ))}
        </select>
        {group?.note ? <p className="mt-2 text-[12px] text-dash-ink-muted">{group.note}</p> : null}
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {(groupId === "_base" ? META_CSV_BASE_COLUMNS : columns).map((col) => (
            <li
              key={col}
              className="rounded-full border border-dash-border/80 bg-dash-bg/80 px-2 py-0.5 text-[11px] text-dash-ink"
            >
              {col}
            </li>
          ))}
        </ul>
      </div>

      <p className="text-[12px]">
        <Link href="/help/download#meta-metrics" className="text-dash-accent hover:underline">
          Full export guide
        </Link>
        {" · "}
        <Link href="/help/metrics" className="text-dash-accent hover:underline">
          How metrics map after upload
        </Link>
      </p>
    </div>
  );
}
