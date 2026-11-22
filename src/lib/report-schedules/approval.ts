import { createHash } from "node:crypto";
export function reportApprovalDigest(report: {
  summaryJson: string | null;
  filePath: string | null;
  shareToken: string | null;
  fileName?: string | null;
  displayName?: string | null;
}) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        report.summaryJson,
        report.filePath,
        report.shareToken,
        report.fileName,
        report.displayName,
      ]),
    )
    .digest("hex");
}
