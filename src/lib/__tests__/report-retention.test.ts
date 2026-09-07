import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    report: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/storage", () => ({
  deleteReportFile: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from "@/lib/prisma";
import { purgeExpiredReports, REPORT_RETENTION_DAYS } from "@/lib/report-retention";

describe("report-retention", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes reports older than retention window", async () => {
    const findMany = vi.mocked(prisma.report.findMany);
    const deleteMany = vi.mocked(prisma.report.deleteMany);

    findMany
      .mockResolvedValueOnce([
        { id: "r1", filePath: "https://blob/a.pptx", pdfPath: null },
      ] as never)
      .mockResolvedValueOnce([] as never);

    deleteMany.mockResolvedValue({ count: 1 });

    const deleted = await purgeExpiredReports(new Date("2026-09-07T12:00:00Z"));
    expect(deleted).toBe(1);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          createdAt: {
            lt: expect.any(Date),
          },
        },
      }),
    );

    const cutoff = findMany.mock.calls[0]![0]!.where!.createdAt!.lt as Date;
    const expected = new Date("2026-09-07T12:00:00Z");
    expected.setDate(expected.getDate() - REPORT_RETENTION_DAYS);
    expect(cutoff.toISOString()).toBe(expected.toISOString());
  });
});
