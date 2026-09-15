import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
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
import {
  allowedReportRetentionOptions,
  DEFAULT_REPORT_RETENTION_DAYS,
  maxReportRetentionDaysForPlan,
  normalizeReportRetentionDays,
  purgeExpiredReports,
  purgeExpiredReportsForUser,
  REPORT_RETENTION_DAYS,
} from "@/lib/report-retention";

describe("report retention options", () => {
  it("caps starter/trial at 30 days", () => {
    expect(maxReportRetentionDaysForPlan("starter")).toBe(30);
    expect(allowedReportRetentionOptions("trial")).toEqual([7, 14, 30]);
  });

  it("allows professional accounts up to 90 days", () => {
    expect(maxReportRetentionDaysForPlan("professional")).toBe(90);
    expect(allowedReportRetentionOptions("professional")).toEqual([7, 14, 30, 60, 90]);
  });

  it("normalizes invalid values to the plan default", () => {
    expect(normalizeReportRetentionDays(90, "starter")).toBe(30);
    expect(normalizeReportRetentionDays(60, "professional")).toBe(60);
    expect(normalizeReportRetentionDays(null, "professional")).toBe(DEFAULT_REPORT_RETENTION_DAYS);
  });

  it("keeps REPORT_RETENTION_DAYS alias for legacy imports", () => {
    expect(REPORT_RETENTION_DAYS).toBe(DEFAULT_REPORT_RETENTION_DAYS);
  });
});

describe("purgeExpiredReportsForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes reports older than the user's retention window", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ reportRetentionDays: 14 } as never);
    const findMany = vi.mocked(prisma.report.findMany);
    const deleteMany = vi.mocked(prisma.report.deleteMany);

    findMany
      .mockResolvedValueOnce([{ id: "r1", filePath: "https://blob/a.pptx", pdfPath: null }] as never)
      .mockResolvedValueOnce([] as never);
    deleteMany.mockResolvedValue({ count: 1 });

    const deleted = await purgeExpiredReportsForUser("user-1", new Date("2026-09-07T12:00:00Z"));
    expect(deleted).toBe(1);

    const cutoff = findMany.mock.calls[0]![0]!.where!.createdAt!.lt as Date;
    const expected = new Date("2026-09-07T12:00:00Z");
    expected.setDate(expected.getDate() - 14);
    expect(cutoff.toISOString()).toBe(expected.toISOString());
    expect(findMany.mock.calls[0]![0]!.where!.client).toEqual({ userId: "user-1" });
  });
});

describe("purgeExpiredReports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("purges each distinct retention setting separately", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { reportRetentionDays: 30 },
      { reportRetentionDays: 90 },
    ] as never);

    const findMany = vi.mocked(prisma.report.findMany);
    findMany.mockResolvedValue([] as never);

    await purgeExpiredReports(new Date("2026-09-07T12:00:00Z"));

    expect(findMany).toHaveBeenCalledTimes(2);
    expect(findMany.mock.calls[0]![0]!.where!.client!.user).toEqual({ reportRetentionDays: 30 });
    expect(findMany.mock.calls[1]![0]!.where!.client!.user).toEqual({ reportRetentionDays: 90 });
  });
});
