"use client";

import type { CsvVerificationResult } from "@/lib/nre/csv-report-reconciliation";
import type { PreviewStatus } from "../types";

export type ReadinessItem = {
  id: string;
  label: string;
  status: "done" | "pending" | "warning" | "optional";
  detail?: string;
};

function statusIcon(status: ReadinessItem["status"]): string {
  switch (status) {
    case "done":
      return "✓";
    case "warning":
      return "!";
    case "optional":
      return "○";
    default:
      return "…";
  }
}

function statusClass(status: ReadinessItem["status"]): string {
  switch (status) {
    case "done":
      return "border-emerald-500/40 bg-emerald-950/20 text-emerald-100";
    case "warning":
      return "border-amber-500/40 bg-amber-950/20 text-amber-100";
    case "optional":
      return "border-dash-border bg-dash-bg/40 text-dash-ink-secondary";
    default:
      return "border-sky-500/35 bg-sky-950/15 text-sky-100";
  }
}

export function buildGenerateStepReadinessItems(input: {
  campaignsSelected: number;
  previewStatus: PreviewStatus;
  generateStepPreviewReady: boolean;
  csvVerification: CsvVerificationResult | null;
  previewRefreshing: boolean;
  reportTypeLabel: string;
  periodLabel?: string;
  objectivesBlocking?: number;
}): ReadinessItem[] {
  const items: ReadinessItem[] = [];

  items.push({
    id: "data",
    label: "Campaign data loaded",
    status: input.campaignsSelected > 0 ? "done" : "pending",
    detail: input.campaignsSelected > 0 ? `${input.campaignsSelected} campaign(s) selected` : "Complete steps 1–3 first",
  });

  if (input.objectivesBlocking && input.objectivesBlocking > 0) {
    items.push({
      id: "objectives",
      label: "Campaign objectives",
      status: "warning",
      detail: `${input.objectivesBlocking} campaign(s) need confirmation on step 2`,
    });
  } else {
    items.push({
      id: "objectives",
      label: "Campaign objectives",
      status: input.campaignsSelected > 0 ? "done" : "pending",
    });
  }

  items.push({
    id: "report-config",
    label: "Report type & dates",
    status: input.generateStepPreviewReady ? "done" : input.previewStatus === "invalid" ? "warning" : "pending",
    detail: [input.reportTypeLabel, input.periodLabel].filter(Boolean).join(" · ") || undefined,
  });

  if (input.previewStatus === "invalid") {
    items.push({
      id: "preview",
      label: "Preview",
      status: "warning",
      detail: "Fix the errors above before generating",
    });
  } else if (input.previewRefreshing) {
    items.push({
      id: "preview",
      label: "Preview",
      status: "pending",
      detail: "Updating totals…",
    });
  } else if (input.generateStepPreviewReady) {
    items.push({
      id: "preview",
      label: "Preview ready",
      status: "done",
    });
  } else {
    items.push({
      id: "preview",
      label: "Preview",
      status: "pending",
      detail: "Loading report options…",
    });
  }

  const v = input.csvVerification;
  if (v?.status === "ok") {
    items.push({
      id: "csv",
      label: "CSV verification",
      status: "done",
      detail: v.scopesVerified?.length ? v.scopesVerified.join(" · ") : "Totals match your export",
    });
  } else if (v?.status === "mismatch") {
    items.push({
      id: "csv",
      label: "CSV verification",
      status: "warning",
      detail: "Review mismatches before sharing with clients",
    });
  } else if (v?.status === "skipped" && v.skipReason) {
    items.push({
      id: "csv",
      label: "CSV verification",
      status: "optional",
      detail: v.skipReason,
    });
  }

  return items;
}

export function ReportReadinessPanel({ items }: { items: ReadinessItem[] }) {
  const doneCount = items.filter((i) => i.status === "done").length;
  const ready = items.every((i) => i.status === "done" || i.status === "optional");

  return (
    <section className="rounded-lg border border-dash-border bg-dash-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-[16px] font-semibold text-white">Report readiness</h4>
        <span
          className={`rounded-full px-3 py-1 text-[12px] font-semibold uppercase tracking-wide ${
            ready ? "bg-emerald-500/15 text-emerald-200" : "bg-sky-500/15 text-sky-200"
          }`}
        >
          {ready ? "Ready to generate" : `${doneCount}/${items.length} complete`}
        </span>
      </div>
      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className={`flex gap-3 rounded-md border px-3 py-2.5 ${statusClass(item.status)}`}
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black/20 text-[13px] font-bold" aria-hidden>
              {statusIcon(item.status)}
            </span>
            <div className="min-w-0">
              <p className="text-[14px] font-medium">{item.label}</p>
              {item.detail ? <p className="mt-0.5 text-[12px] leading-snug opacity-90">{item.detail}</p> : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
