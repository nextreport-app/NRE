import { ShareReportView } from "@/components/share-report-view";
import type { ShareReportData } from "@/lib/nre/share-report";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ReportShareReview } from "@/components/report-share-review";
import Link from "next/link";
import { isShareComparisonReportData } from "@/lib/nre/share-comparison-report";
import { ShareComparisonReportView } from "@/components/share-comparison-report-view";

export default async function ReportCopyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; reportId: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { id, reportId } = await params;
  const { from } = await searchParams;
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: { client: true },
  });
  if (
    !report ||
    report.client.userId !== session.user.id ||
    report.clientId !== id
  )
    notFound();

  const fromGenerate = from === "generate";
  const backHref = fromGenerate
    ? `/clients/${id}/reports/new?resumeReport=${reportId}`
    : from === "automation-report"
      ? `/clients/${id}/schedules${report.scheduleRunId ? `#report-run-${report.scheduleRunId}` : ""}`
      : from === "scheduled"
        ? "/reports?tab=scheduled"
        : from === "reports"
          ? "/reports"
          : `/clients/${id}/reports`;
  const backLabel = fromGenerate
    ? "← Back to Generate screen"
    : from === "automation-report"
      ? "← Back to automation"
      : from === "scheduled"
        ? "← Back to scheduled drafts"
        : from === "reports"
          ? "← Back to reports"
          : "← Back to client history";
  const approvalNotice =
    report.requiresApproval && !report.approvedAt ? (
      <p className="rounded-lg border border-dash-accent/40 p-3 text-sm text-dash-ink">
        This report is private. After reviewing,{" "}
        <Link
          href={
            from === "automation-report" ? backHref : "/reports?tab=scheduled"
          }
          className="font-semibold text-dash-accent underline"
        >
          return to your reports
        </Link>{" "}
        to confirm recipients and click Send.
      </p>
    ) : null;

  let comparison: unknown = null;
  try {
    comparison = report.summaryJson ? JSON.parse(report.summaryJson) : null;
  } catch {
    /* Existing review handles unavailable payloads. */
  }
  if (from === "automation") {
    const sample = comparison as ShareReportData | null;
    if (
      report.status !== "COMPLETE" ||
      !report.requiresApproval ||
      report.scheduleRunId ||
      report.platform !== "META" ||
      !["WEEKLY", "MONTHLY"].includes(report.reportType) ||
      sample?.version !== 1 ||
      !Array.isArray(sample.campaigns)
    )
      notFound();
    return (
      <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
        <h1 className="text-xl font-semibold text-dash-ink">
          Review automation sample
        </h1>
        <p className="rounded-xl border border-dash-border bg-dash-card p-4 text-sm text-dash-ink-secondary">
          This sample is private. Return to the setup tab to confirm it, or
          change campaigns, objectives and metrics there and regenerate. Nothing
          has been sent to the client.
        </p>
        <ShareReportView
          data={sample}
          clientCurrency={report.client.currency}
          clientTimezone={report.client.timezone}
          mode="preview"
        />
      </div>
    );
  }
  if (isShareComparisonReportData(comparison))
    return (
      <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
        <Link href={backHref} className="text-sm text-dash-accent">
          {backLabel}
        </Link>
        <h1 className="text-xl font-semibold text-dash-ink">
          Review comparison report
        </h1>
        <p className="text-sm text-dash-ink-secondary">
          Review both periods below. To change campaigns, metrics or dates,
          return to the report setup and generate again.
        </p>
        {approvalNotice}
        <ShareComparisonReportView
          clientCurrency={report.client.currency}
          clientTimezone={report.client.timezone}
          data={comparison}
          shareToken={
            report.requiresApproval && !report.approvedAt
              ? undefined
              : (report.shareToken ?? undefined)
          }
        />
      </div>
    );

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1440px] space-y-4 px-4 py-5 sm:px-6">
      <Link
        href={backHref}
        className="text-[13px] text-dash-accent hover:underline"
      >
        {backLabel}
      </Link>
      <h1 className="text-[20px] font-semibold text-dash-ink">
        Edit browser report
      </h1>
      {approvalNotice}
      <ReportShareReview
        clientId={id}
        reportId={reportId}
        shareToken={
          report.requiresApproval && !report.approvedAt
            ? null
            : report.shareToken
        }
        returnToGenerateHref={fromGenerate ? backHref : null}
      />
    </div>
  );
}
