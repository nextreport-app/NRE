import { scheduleSettingsSchema, periodForOccurrence } from "./calendar";
import { reportApprovalDigest } from "./approval";
export const INBOX_VIEWS = [
  "todo",
  "ready",
  "approved",
  "working",
  "attention",
  "history",
] as const;
export type InboxView = (typeof INBOX_VIEWS)[number];
export const INBOX_STATUSES = {
  ready: ["READY"],
  approved: ["APPROVED"],
  working: ["PENDING", "PREPARING", "GENERATING", "SENDING"],
  attention: ["FAILED", "REVIEW"],
  history: ["SENT", "SKIPPED"],
};
export function inboxStatuses(view: InboxView) {
  return view === "todo"
    ? { notIn: INBOX_STATUSES.history }
    : { in: INBOX_STATUSES[view] };
}
export function inboxCounts(
  groups: { status: string; _count: { _all: number } }[],
) {
  const counts = {
    todo: 0,
    ready: 0,
    approved: 0,
    working: 0,
    attention: 0,
    history: 0,
  };
  for (const g of groups) {
    if (!INBOX_STATUSES.history.includes(g.status))
      counts.todo += g._count._all;
    for (const key of [
      "ready",
      "approved",
      "working",
      "attention",
      "history",
    ] as const)
      if (INBOX_STATUSES[key].includes(g.status)) counts[key] += g._count._all;
  }
  return counts;
}
interface InboxRun {
  id: string;
  status: string;
  dueAt: Date;
  createdAt: Date;
  deliveredAt: Date | null;
  error: string | null;
  sourceSessionId: string | null;
  settingsJson: string;
  approvalDigest: string | null;
  schedule: { client: { id: string; accountName: string } };
  report: null | {
    id: string;
    status: string;
    displayName: string | null;
    approvedAt: Date | null;
    slidesUrl: string | null;
    shareToken: string | null;
    summaryJson: string | null;
    filePath: string | null;
    fileName: string | null;
  };
}
export function inboxItem(run: InboxRun) {
  let settings: ReturnType<typeof scheduleSettingsSchema.parse> | null = null;
  try {
    const parsed = scheduleSettingsSchema.safeParse(
      JSON.parse(run.settingsJson).settings,
    );
    if (parsed.success) settings = parsed.data;
  } catch {}
  const report = run.report,
    complete = report?.status === "COMPLETE",
    digest = complete ? reportApprovalDigest(report) : null;
  const approved =
    !!report?.approvedAt &&
    !!report.shareToken &&
    complete &&
    run.approvalDigest === digest;
  const publicCopy =
    !!report?.approvedAt &&
    complete &&
    (run.status === "SENT" ||
      (approved && ["APPROVED", "SENDING"].includes(run.status)));
  return {
    id: run.id,
    clientId: run.schedule.client.id,
    clientName: run.schedule.client.accountName,
    status: run.status,
    dueAt: run.dueAt.toISOString(),
    createdAt: run.createdAt.toISOString(),
    deliveredAt: run.deliveredAt?.toISOString() ?? null,
    error: run.error,
    settingsError: settings
      ? null
      : "This draft's saved settings could not be read. Manage the client's schedule before preparing another copy.",
    timezone: settings?.timezone ?? "UTC",
    cadence: settings?.cadence ?? null,
    recipients: settings?.recipients ?? [],
    period: settings ? periodForOccurrence(settings, run.dueAt) : null,
    sourceSessionId: run.sourceSessionId,
    canApprove: !!settings && complete && run.status === "READY",
    canSend: !!settings && approved && run.status === "APPROVED",
    canCheckDelivery: !!settings && approved && run.status === "SENDING",
    canSkip: [
      "READY",
      "APPROVED",
      "PENDING",
      "PREPARING",
      "GENERATING",
      "FAILED",
    ].includes(run.status),
    report: report
      ? {
          id: report.id,
          status: report.status,
          displayName: report.displayName,
          digest: settings && run.status === "READY" ? digest : null,
          shareToken: publicCopy ? report.shareToken : null,
          slidesUrl:
            publicCopy &&
            /^https:\/\/docs\.google\.com\/presentation\//.test(
              report.slidesUrl ?? "",
            )
              ? report.slidesUrl
              : null,
        }
      : null,
  };
}
export type InboxItem = ReturnType<typeof inboxItem>;
