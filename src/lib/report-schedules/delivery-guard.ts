import { reportApprovalDigest } from "./approval";
import { scheduleSettingsSchema } from "./calendar";
interface DeliveryRun {
  id: string;
  status: string;
  settingsJson: string;
  approvalDigest: string | null;
  report: {
    status: string;
    summaryJson: string | null;
    filePath: string | null;
    shareToken: string | null;
    fileName: string | null;
    displayName: string | null;
    approvedAt: Date | null;
    requiresApproval: boolean;
  } | null;
  schedule: { client: { userId: string; user: { email: string } } };
}
export function scheduledDeliveryIsCurrent(
  kind: string,
  key: string,
  userId: string | null,
  to: string[],
  run: DeliveryRun | null,
): boolean {
  if (!run || run.schedule.client.userId !== userId) return false;
  if (kind === "SCHEDULE_NOTICE")
    return (
      ["READY", "FAILED"].includes(run.status) &&
      key === `schedule-notice:${run.id}:${run.status}` &&
      to.length === 1 &&
      to[0] === run.schedule.client.user.email
    );
  try {
    const settings = scheduleSettingsSchema.safeParse(
      JSON.parse(run.settingsJson).settings,
    );
    return (
      kind === "SCHEDULE_CLIENT" &&
      key === `scheduled-client:${run.id}` &&
      run.status === "SENDING" &&
      !!run.report?.approvedAt &&
      !!run.report?.requiresApproval &&
      !!run.report?.filePath &&
      run.report.status === "COMPLETE" &&
      reportApprovalDigest(run.report) === run.approvalDigest &&
      settings.success &&
      JSON.stringify(settings.data.recipients) === JSON.stringify(to)
    );
  } catch {
    return false;
  }
}
