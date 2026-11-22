import { beforeEach, it, expect, vi } from "vitest";
import { createHash } from "node:crypto";
vi.mock("../../prisma", () => ({
  prisma: { agencyTemplate: { findFirst: vi.fn() } },
}));
vi.mock("../../storage", () => ({ readReportFile: vi.fn() }));
vi.mock("../../pptx/templates", () => ({
  loadTemplateBufferForPlatform: vi.fn(),
}));
import { prisma } from "../../prisma";
import { readReportFile } from "../../storage";
import { loadTemplateBufferForPlatform } from "../../pptx/templates";
import { loadReportTemplate } from "../load";
const bytes = Buffer.from("immutable deck");
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.agencyTemplate.findFirst).mockResolvedValue({
    filePath: "private/deck",
    archivedAt: new Date(),
    digest: createHash("sha256").update(bytes).digest("hex"),
  } as never);
  vi.mocked(readReportFile).mockResolvedValue(bytes);
});
it("preserves the normal built-in path when no custom design was saved", async () => {
  await loadReportTemplate("META", "DARK", "owner", null);
  expect(loadTemplateBufferForPlatform).toHaveBeenCalledWith("META", "DARK");
  expect(prisma.agencyTemplate.findFirst).not.toHaveBeenCalled();
});
it("loads an archived report's original design rather than silently switching to a new one", async () => {
  expect(
    await loadReportTemplate("META", "LIGHT", "owner", "original"),
  ).toEqual(bytes);
  expect(prisma.agencyTemplate.findFirst).toHaveBeenCalledWith({
    where: {
      id: "original",
      userId: "owner",
      status: "READY",
      approvedAt: { not: null },
    },
  });
});
it("rejects foreign/unavailable designs and altered stored bytes", async () => {
  vi.mocked(prisma.agencyTemplate.findFirst).mockResolvedValueOnce(null);
  await expect(
    loadReportTemplate("META", "DARK", "intruder", "original"),
  ).rejects.toMatchObject({ status: 409 });
  vi.mocked(readReportFile).mockResolvedValue(Buffer.from("different"));
  await expect(
    loadReportTemplate("META", "DARK", "owner", "original"),
  ).rejects.toThrow("integrity");
});
it("does not reinterpret Meta starter uploads as GA4 designs", async () => {
  await expect(
    loadReportTemplate("GA4", "LIGHT", "owner", "original"),
  ).rejects.toThrow("Meta reports only");
  expect(readReportFile).not.toHaveBeenCalled();
});
