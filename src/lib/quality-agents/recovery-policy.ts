/** Client-safe copy and lifecycle. No model or worker may assert that a report is correct. */
export const RECOVERY_STATES = ["RECORDED", "QUEUED", "INVESTIGATING", "FIX_PROPOSED", "NEEDS_REVIEW", "READY_TO_RECHECK", "VERIFIED"] as const;
export type RecoveryState = typeof RECOVERY_STATES[number];
export type RecoveryStatus = { id: string; state: RecoveryState; updatedAt: string; stale: boolean };
export function recoveryMessage(state: RecoveryState, stale = false): { title: string; detail: string } {
  if (stale) return {title:"Investigation update pending",detail:"Your diagnostic details are saved. No fix has been confirmed yet; you do not need to explain this issue again."};
  switch (state) {
    case "RECORDED": return {title:"Discrepancy recorded",detail:"We saved the diagnostic details for review. No separate ticket is needed for this check."};
    case "QUEUED": return {title:"Investigation queued",detail:"We saved the report settings and failed checks. Your case is waiting for an automated investigation; no fix has been confirmed yet."};
    case "INVESTIGATING": return {title:"Investigating this discrepancy",detail:"We are checking the reporting logic and testing possible causes against sample data. Your original CSV is not shared with the coding agent."};
    case "FIX_PROPOSED": return {title:"A candidate fix is awaiting review",detail:"A tested code change has been proposed. It is not confirmed live yet; your existing report has not changed."};
    case "NEEDS_REVIEW": return {title:"Further investigation needed",detail:"An automatic fix could not be confirmed. The diagnostic details are saved for review, so you do not need to describe this issue again."};
    case "READY_TO_RECHECK": return {title:"An update is live — recheck your report",detail:"The proposed update is included in the production version. Rebuild the preview against the same CSV before generating a new report."};
    case "VERIFIED": return {title:"The recheck passed",detail:"The listed CSV checks now pass for the same report setup. You can generate a new report; previously downloaded files are unchanged."};
  }
}
export function canWorkerTransition(from: string, to: string): boolean {
  return (from === "INVESTIGATING" && ["FIX_PROPOSED","NEEDS_REVIEW"].includes(to)) || (from === "FIX_PROPOSED" && to === "READY_TO_RECHECK");
}
