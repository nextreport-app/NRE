"use client";


export function NoDataRowsWarning({ message }: { message: string }) {
  const blocks = message.split("\n\n").map((block) => block.split("\n").filter((line) => line.trim() !== ""));

  return (
    <div className="space-y-3 rounded-lg border border-amber-900 bg-amber-950/30 p-4 text-[14px] text-amber-200">
      {blocks.map((lines, i) => {
        if (lines.every((l) => l.startsWith("• "))) {
          return (
            <ul key={i} className="list-inside list-disc space-y-1">
              {lines.map((l, j) => (
                <li key={j}>{l.replace(/^•\s*/, "")}</li>
              ))}
            </ul>
          );
        }
        if (lines.every((l) => /^\d+\.\s/.test(l))) {
          return (
            <ol key={i} className="list-inside list-decimal space-y-1">
              {lines.map((l, j) => (
                <li key={j}>{l.replace(/^\d+\.\s*/, "")}</li>
              ))}
            </ol>
          );
        }
        return (
          <p key={i} className="font-medium text-amber-100">
            {lines.join(" ")}
          </p>
        );
      })}
    </div>
  );
}

/**
 * Replaces NoDataRowsWarning entirely (not shown alongside it) whenever the
 * client has Previous Month Data on file — see handleAnalyze/fetchPreview's
 * own noCampaignData/hasPreviousMonthData checks at each call site. Offers
 * a Previous Month Summary report (cover + Combined Total table's own
 * Previous Month row + Metric Guide only, no campaign/ad-set/chart slides —
 * see report-data.ts's buildPreviousMonthSummaryReportData) as an
 * alternative to blocking report generation outright.
 */


export function PreviousMonthSummaryOption({
  status,
  error,
  result,
  onGenerate,
  onCancel,
}: {
  status: "idle" | "loading" | "done" | "error";
  error: string | null;
  result: { downloadUrl: string; shareToken: string | null } | null;
  onGenerate: () => void;
  onCancel: () => void;
}) {
  if (status === "done" && result) {
    return (
      <div className="space-y-3 rounded-lg border border-emerald-900 bg-emerald-950/30 p-4 text-[14px] text-emerald-200">
        <p className="font-medium text-emerald-100">Previous Month Summary report generated!</p>
        <div className="flex flex-wrap gap-3">
          <a
            href={result.downloadUrl}
            className="inline-block rounded-md bg-emerald-600 px-4 py-2 text-[14px] font-medium text-dash-ink hover:bg-emerald-500"
          >
            Download PPTX
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-amber-900 bg-amber-950/30 p-4 text-[14px] text-amber-200">
      <p>No active campaigns found in this date range. Your campaigns did not run during this period.</p>
      <p>
        However, we found previous month data for this client. You can still generate a report showing your previous
        month performance summary.
      </p>
      {status === "error" && error && <p className="text-red-300">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onGenerate}
          disabled={status === "loading"}
          className="rounded-md bg-dash-accent px-4 py-2 text-[14px] font-medium text-white hover:bg-dash-accent-hover disabled:opacity-60"
        >
          {status === "loading" ? "Generating…" : "Generate Previous Month Summary Report"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={status === "loading"}
          className="rounded-md border border-dash-border px-4 py-2 text-[14px] text-dash-ink-secondary hover:bg-dash-border disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
