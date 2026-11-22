import { describe, it, expect } from "vitest";
import { inboxItem, inboxCounts, inboxStatuses } from "../inbox";
import { reportApprovalDigest } from "../approval";
const date = new Date("2026-11-23T03:30Z");
const report = {
  id: "report",
  status: "COMPLETE",
  displayName: "Weekly report",
  approvedAt: null as Date | null,
  slidesUrl: "https://docs.google.com/presentation/d/example/edit",
  shareToken: "private-token",
  summaryJson: '{"secret":"summary"}',
  filePath: "private-storage-key",
  fileName: "report.pptx",
};
const settings = {
  cadence: "WEEKLY",
  weekday: 1,
  time: "09:00",
  timezone: "Asia/Kolkata",
  recipients: ["client@example.com"],
};
function run(status = "READY") {
  return {
    id: "run",
    status,
    dueAt: date,
    createdAt: date,
    deliveredAt: null,
    error: null,
    sourceSessionId: "source",
    settingsJson: JSON.stringify({ settings }),
    approvalDigest: null as string | null,
    schedule: { client: { id: "client", accountName: "Client" } },
    report: { ...report },
  };
}
describe("review inbox projection", () => {
  it("exposes an owner review digest without exposing private storage, summary or public links", () => {
    const item = inboxItem(run());
    expect(item.canApprove).toBe(true);
    expect(item.canSend).toBe(false);
    expect(item.report?.digest).toBe(reportApprovalDigest(report));
    expect(item.report?.shareToken).toBeNull();
    expect(item.report?.slidesUrl).toBeNull();
    expect(JSON.stringify(item)).not.toContain("private-storage-key");
    expect(JSON.stringify(item)).not.toContain('"secret"');
    expect(item.period).toEqual({
      startIso: "2026-11-16",
      endIso: "2026-11-22",
    });
  });
  it("only offers send for the exact approved completed version", () => {
    const r = run("APPROVED");
    r.report.approvedAt = date;
    r.approvalDigest = reportApprovalDigest(r.report);
    expect(inboxItem(r).canSend).toBe(true);
    r.report.summaryJson = "changed";
    expect(inboxItem(r).canSend).toBe(false);
    expect(inboxItem(r).report?.shareToken).toBeNull();
  });
  it("does not offer retry or skip on ambiguous delivery", () => {
    const r = run("REVIEW");
    r.report.approvedAt = date;
    r.approvalDigest = reportApprovalDigest(r.report);
    const item = inboxItem(r);
    expect(item.canCheckDelivery).toBe(false);
    expect(item.canSend).toBe(false);
    expect(item.canSkip).toBe(false);
    expect(item.report?.shareToken).toBeNull();
  });
  it("offers same-message delivery check only with a matching approved digest", () => {
    const r = run("SENDING");
    r.report.approvedAt = date;
    r.approvalDigest = reportApprovalDigest(r.report);
    expect(inboxItem(r).canCheckDelivery).toBe(true);
    expect(inboxItem(r).canSkip).toBe(false);
    r.report.approvedAt = null;
    expect(inboxItem(r).canCheckDelivery).toBe(false);
  });
  it("keeps sent and skipped runs terminal", () => {
    for (const status of ["SENT", "SKIPPED"]) {
      const item = inboxItem(run(status));
      expect(
        item.canApprove ||
          item.canSend ||
          item.canCheckDelivery ||
          item.canSkip,
      ).toBe(false);
    }
  });
  it("preserves approved sent live links after an allowed post-send edit", () => {
    const r = run("SENT");
    r.report.approvedAt = date;
    r.report.summaryJson = "post-send-edit";
    expect(inboxItem(r).report?.shareToken).toBe("private-token");
  });
  it("isolates malformed settings without inventing recipients or allowing approval", () => {
    const r = run();
    r.settingsJson = "invalid";
    const item = inboxItem(r);
    expect(item.settingsError).toBeTruthy();
    expect(item.recipients).toEqual([]);
    expect(item.canApprove || item.canSend).toBe(false);
    expect(item.report?.digest).toBeNull();
  });
  it("does not publish an arbitrary external Slides URL", () => {
    const r = run("APPROVED");
    r.report.approvedAt = date;
    r.report.slidesUrl = "javascript:alert(1)";
    expect(inboxItem(r).report?.slidesUrl).toBeNull();
  });
  it("counts every pending draft, including older rows; history is separate", () => {
    const counts = inboxCounts([
      { status: "READY", _count: { _all: 31 } },
      { status: "SENT", _count: { _all: 200 } },
      { status: "REVIEW", _count: { _all: 2 } },
      { status: "SENDING", _count: { _all: 1 } },
    ]);
    expect(counts).toMatchObject({
      todo: 34,
      ready: 31,
      history: 200,
      attention: 2,
      working: 1,
    });
    expect(inboxStatuses("todo")).toEqual({ notIn: ["SENT", "SKIPPED"] });
  });
});
