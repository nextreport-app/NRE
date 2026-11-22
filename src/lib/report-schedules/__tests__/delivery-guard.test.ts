import { describe, it, expect } from "vitest";
import { scheduledDeliveryIsCurrent } from "../delivery-guard";
import { reportApprovalDigest } from "../approval";
import { isReportPublished } from "../../report-publication";
const report = {
  status: "COMPLETE",
  summaryJson: "{}",
  filePath: "private/deck.pptx",
  shareToken: "token",
  fileName: "deck.pptx",
  displayName: "Weekly",
  requiresApproval: true,
  approvedAt: new Date(),
};
const run = {
  id: "run",
  status: "SENDING",
  settingsJson: JSON.stringify({
    settings: {
      cadence: "WEEKLY",
      time: "09:00",
      timezone: "UTC",
      recipients: ["client@example.com"],
    },
  }),
  report,
  approvalDigest: reportApprovalDigest(report),
  schedule: {
    client: { userId: "owner", user: { email: "owner@example.com" } },
  },
};
const allowed = (
  r: typeof run | null = run,
  to = ["client@example.com"],
  owner = "owner",
) =>
  scheduledDeliveryIsCurrent(
    "SCHEDULE_CLIENT",
    "scheduled-client:run",
    owner,
    to,
    r,
  );
describe("draft delivery boundary", () => {
  it("keeps legacy reports public and drafts private until approved", () => {
    expect(isReportPublished({})).toBe(true);
    expect(isReportPublished({ ...report, approvedAt: null })).toBe(false);
    expect(isReportPublished(report)).toBe(true);
  });
  it("accepts exactly the frozen approved report and recipients", () =>
    expect(allowed()).toBe(true));
  it.each(["READY", "PENDING", "APPROVED", "SKIPPED", "REVIEW", "SENT"])(
    "blocks state %s",
    (status) => expect(allowed({ ...run, status })).toBe(false),
  );
  it("rejects changed content, file, name and token", () => {
    for (const key of [
      "summaryJson",
      "filePath",
      "displayName",
      "fileName",
      "shareToken",
    ]) {
      expect(allowed({ ...run, report: { ...report, [key]: "changed" } })).toBe(
        false,
      );
    }
  });
  it("rejects owner/recipient mismatch and missing approval", () => {
    expect(allowed(run, ["other@example.com"])).toBe(false);
    expect(allowed(run, undefined, "intruder")).toBe(false);
    expect(
      allowed({
        ...run,
        report: { ...report, approvedAt: null } as unknown as typeof report,
      }),
    ).toBe(false);
    expect(allowed(null)).toBe(false);
  });
  it("rejects malformed stored settings", () =>
    expect(allowed({ ...run, settingsJson: "{" })).toBe(false));
  it("sends ready notices only to the owner", () => {
    const ready = { ...run, status: "READY" };
    expect(
      scheduledDeliveryIsCurrent(
        "SCHEDULE_NOTICE",
        "schedule-notice:run:READY",
        "owner",
        ["owner@example.com"],
        ready,
      ),
    ).toBe(true);
    expect(
      scheduledDeliveryIsCurrent(
        "SCHEDULE_NOTICE",
        "schedule-notice:run:READY",
        "owner",
        ["client@example.com"],
        ready,
      ),
    ).toBe(false);
    expect(
      scheduledDeliveryIsCurrent(
        "SCHEDULE_NOTICE",
        "schedule-notice:run:READY",
        "owner",
        ["owner@example.com"],
        run,
      ),
    ).toBe(false);
  });
});
