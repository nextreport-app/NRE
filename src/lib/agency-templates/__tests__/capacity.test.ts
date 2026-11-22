import { beforeEach, it, expect, vi } from "vitest";
const db = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  $transaction: vi.fn(),
  user: { findUniqueOrThrow: vi.fn() },
  client: { findFirst: vi.fn() },
  agencyTemplate: { findFirst: vi.fn() },
  report: { count: vi.fn(), create: vi.fn() },
}));
vi.mock("../../prisma", () => ({ prisma: db }));
vi.mock("../../subscription", () => ({
  getSubscriptionStatus: () => ({
    isBlocked: false,
    isTrialing: false,
    isAdminOverride: false,
  }),
}));
vi.mock("../../report-generation-events", () => ({
  recordGenerationOutcome: vi.fn(),
}));
import { createReportWithinCapacity } from "../../report-capacity";
beforeEach(() => {
  vi.clearAllMocks();
  db.$transaction.mockImplementation((fn) => fn(db));
  db.user.findUniqueOrThrow.mockResolvedValue({ emailVerified: new Date() });
  db.client.findFirst.mockResolvedValue({
    id: "client",
    template: "DARK",
    agencyTemplateId: "owned-design",
  });
  db.agencyTemplate.findFirst.mockResolvedValue({
    id: "owned-design",
    baseVariant: "LIGHT",
  });
  db.report.count.mockResolvedValue(0);
  db.report.create.mockImplementation((args) => args.data);
});
it("freezes the selected owned immutable design and its palette on admission", async () => {
  const report = await createReportWithinCapacity("owner", {
    data: {
      clientId: "client",
      platform: "META",
      agencyTemplateId: "spoofed",
      renderTemplateVariant: "DARK",
    },
  });
  expect(report).toMatchObject({
    agencyTemplateId: "owned-design",
    renderTemplateVariant: "LIGHT",
  });
  expect(db.agencyTemplate.findFirst).toHaveBeenCalledWith({
    where: {
      id: "owned-design",
      userId: "owner",
      status: "READY",
      archivedAt: null,
      approvedAt: { not: null },
    },
  });
});
it("freezes built-in palette choices as well", async () => {
  db.client.findFirst.mockResolvedValue({
    id: "client",
    template: "LIGHT",
    agencyTemplateId: null,
  });
  expect(
    await createReportWithinCapacity("owner", {
      data: { clientId: "client", platform: "META" },
    }),
  ).toMatchObject({ agencyTemplateId: null, renderTemplateVariant: "LIGHT" });
});
it("does not silently substitute another design when a saved selection is invalid", async () => {
  db.agencyTemplate.findFirst.mockResolvedValue(null);
  await expect(
    createReportWithinCapacity("owner", {
      data: { clientId: "client", platform: "META" },
    }),
  ).rejects.toMatchObject({ status: 409 });
  expect(db.report.create).not.toHaveBeenCalled();
});
it("does not apply a Meta custom design to GA4 reporting", async () => {
  await createReportWithinCapacity("owner", {
    data: { clientId: "client", platform: "GA4", reportType: "WEBSITE" },
  });
  expect(db.agencyTemplate.findFirst).not.toHaveBeenCalled();
  expect(
    db.report.create.mock.calls[0][0].data.agencyTemplateId,
  ).toBeUndefined();
});
