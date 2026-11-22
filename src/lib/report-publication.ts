/** Legacy/manual reports remain public as before. Scheduled drafts require explicit owner approval. */
export function isReportPublished(report: {
  requiresApproval?: boolean;
  approvedAt?: Date | null;
}) {
  return !report.requiresApproval || !!report.approvedAt;
}
