import { beforeEach, describe, it, expect, vi } from "vitest";
const db = vi.hoisted(() => ({
  report: { findUnique: vi.fn(), update: vi.fn() },
  scheduledReportRun: { update: vi.fn() },
  $queryRaw: vi.fn(),
  $transaction: vi.fn(),
}));
vi.mock("../../prisma", () => ({ prisma: db }));
vi.mock("../../blob-deletion-outbox", () => ({
  queueBlobDeletions: vi.fn().mockResolvedValue(undefined),
}));
import { queueBlobDeletions } from "../../blob-deletion-outbox";
import { updateReviewReport } from "../review-update";
beforeEach(() => {
  vi.clearAllMocks();
  db.$transaction.mockImplementation((fn) => fn(db));
  db.report.findUnique.mockResolvedValue({
    id: "report",
    filePath: "old",
    scheduleRun: { id: "run", status: "APPROVED" },
  });
});
describe("scheduled revision serialization", () => {
  it("revokes unsent approval and returns the run to review", async () => {
    await updateReviewReport(
      { id: "report", requiresApproval: true },
      { summaryJson: "new", filePath: "new" },
    );
    expect(db.report.update).toHaveBeenCalledWith({
      where: { id: "report" },
      data: { summaryJson: "new", filePath: "new", approvedAt: null },
    });
    expect(db.scheduledReportRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "READY",
          approvalDigest: null,
        }),
      }),
    );
    expect(queueBlobDeletions).toHaveBeenCalledWith(db, ["old"]);
  });
  it.each(["SENDING", "REVIEW"])(
    "blocks edits while %s and removes the abandoned new revision",
    async (status) => {
      db.report.findUnique.mockResolvedValue({ scheduleRun: { status } });
      await expect(
        updateReviewReport(
          { id: "report", requiresApproval: true },
          { filePath: "unused" },
        ),
      ).rejects.toMatchObject({ status: 409 });
      expect(db.report.update).not.toHaveBeenCalled();
      expect(queueBlobDeletions).toHaveBeenCalledWith(db, ["unused"]);
    },
  );
  it("allows post-send live publishing without recalling approval", async () => {
    db.report.findUnique.mockResolvedValue({ scheduleRun: { status: "SENT" } });
    await updateReviewReport(
      { id: "report", requiresApproval: true },
      { summaryJson: "new" },
    );
    expect(db.report.update).toHaveBeenCalledWith({
      where: { id: "report" },
      data: { summaryJson: "new" },
    });
    expect(db.scheduledReportRun.update).not.toHaveBeenCalled();
  });
  it("preserves manual report behavior", async () => {
    await updateReviewReport(
      { id: "report", requiresApproval: false },
      { displayName: "new" },
    );
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.report.update).toHaveBeenCalledWith({
      where: { id: "report" },
      data: { displayName: "new" },
    });
  });
});
