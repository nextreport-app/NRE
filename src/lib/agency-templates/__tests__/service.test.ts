import { uploadAgencyTemplate } from "../upload";
import { beforeEach, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({
  db: {
    agencyTemplate: {
      count: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    client: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    user: { findUniqueOrThrow: vi.fn() },
    report: { count: vi.fn() },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  },
  put: vi.fn(),
  validate: vi.fn(),
  preview: vi.fn(),
  queue: vi.fn(),
}));
vi.mock("../../prisma", () => ({ prisma: m.db }));
vi.mock("@vercel/blob", () => ({ put: m.put }));
vi.mock("../validate", () => ({ validateAgencyTemplate: m.validate }));
vi.mock("../preview", () => ({ renderAgencyTemplatePreview: m.preview }));
vi.mock("../../blob-deletion-outbox", () => ({ queueBlobDeletions: m.queue }));
vi.mock("../../subscription", () => ({
  getSubscriptionStatus: () => ({ isBlocked: false }),
}));
import {
  approveAgencyTemplate,
  selectClientDesign,
  removeAgencyTemplate,
} from "../service";
const asset = {
  id: "asset",
  userId: "owner",
  baseVariant: "LIGHT",
  status: "READY",
  filePath: "private/template",
  previewPath: "private/preview",
  createdAt: new Date(0),
};
beforeEach(() => {
  vi.clearAllMocks();
  m.db.$transaction.mockImplementation((fn) => fn(m.db));
  m.db.user.findUniqueOrThrow.mockResolvedValue({ emailVerified: new Date() });
  m.db.agencyTemplate.count.mockResolvedValue(0);
  m.db.agencyTemplate.findFirst.mockResolvedValue(asset);
  m.db.agencyTemplate.updateMany.mockResolvedValue({ count: 1 });
  m.db.client.findFirst.mockResolvedValue({ id: "client", template: "DARK" });
  m.db.report.count.mockResolvedValue(0);
  m.validate.mockResolvedValue({
    digest: "hash",
    buffer: Buffer.from("normalized"),
  });
  m.preview.mockResolvedValue(Buffer.from("preview"));
  m.put.mockResolvedValue({ url: "private/blob" });
});
it("stores normalized immutable bytes with a sample before making an upload ready", async () => {
  await uploadAgencyTemplate(
    "owner",
    "Agency design",
    "LIGHT",
    Buffer.from("original"),
  );
  expect(m.put.mock.calls[0][1]).toEqual(Buffer.from("normalized"));
  expect(m.db.agencyTemplate.update).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ status: "READY" }),
    }),
  );
});
it("does not exceed the bounded library quota", async () => {
  m.db.agencyTemplate.count.mockResolvedValue(10);
  await expect(
    uploadAgencyTemplate("owner", "Design", "DARK", Buffer.from("file")),
  ).rejects.toMatchObject({ status: 409 });
  expect(m.put).not.toHaveBeenCalled();
});
it("waits for both storage operations before cleaning up a partially failed upload", async () => {
  let finish!: (value: { url: string }) => void;
  const second = new Promise<{ url: string }>((resolve) => (finish = resolve));
  m.put
    .mockRejectedValueOnce(Error("provider failure"))
    .mockReturnValueOnce(second);
  const uploading = uploadAgencyTemplate(
    "owner",
    "Design",
    "DARK",
    Buffer.from("file"),
  );
  const result = expect(uploading).rejects.toMatchObject({ status: 502 });
  for (let i = 0; i < 20; i++) await Promise.resolve();
  expect(m.queue).not.toHaveBeenCalled();
  finish({ url: "private/late-preview" });
  await result;
  expect(m.queue).toHaveBeenCalled();
  expect(m.db.agencyTemplate.deleteMany).toHaveBeenCalled();
});
it("approves only the reviewed owned immutable digest", async () => {
  await approveAgencyTemplate("asset", "owner", "digest");
  expect(m.db.agencyTemplate.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        id: "asset",
        userId: "owner",
        status: "READY",
        digest: "digest",
        archivedAt: null,
      },
    }),
  );
  m.db.agencyTemplate.updateMany.mockResolvedValue({ count: 0 });
  await expect(
    approveAgencyTemplate("asset", "intruder", "digest"),
  ).rejects.toMatchObject({ status: 409 });
});
it("selects an approved owned asset and its correct palette", async () => {
  await selectClientDesign("client", "owner", { agencyTemplateId: "asset" });
  expect(m.db.agencyTemplate.findFirst).toHaveBeenCalledWith({
    where: {
      id: "asset",
      userId: "owner",
      status: "READY",
      archivedAt: null,
      approvedAt: { not: null },
    },
  });
  expect(m.db.client.update).toHaveBeenCalledWith({
    where: { id: "client" },
    data: { agencyTemplateId: "asset", template: "LIGHT" },
  });
});
it("rejects another client's design update and unapproved assets", async () => {
  m.db.client.findFirst.mockResolvedValueOnce(null);
  await expect(
    selectClientDesign("client", "intruder", { agencyTemplateId: "asset" }),
  ).rejects.toMatchObject({ status: 404 });
  m.db.agencyTemplate.findFirst.mockResolvedValueOnce(null);
  await expect(
    selectClientDesign("client", "owner", { agencyTemplateId: "other" }),
  ).rejects.toThrow("approved");
  expect(m.db.client.update).not.toHaveBeenCalled();
});
it("archives referenced templates and keeps old report assets available", async () => {
  m.db.report.count.mockResolvedValue(1);
  expect(await removeAgencyTemplate("asset", "owner")).toEqual({
    archived: true,
  });
  expect(m.db.agencyTemplate.delete).not.toHaveBeenCalled();
  expect(m.queue).not.toHaveBeenCalled();
  expect(m.db.client.updateMany).toHaveBeenCalledWith({
    where: { userId: "owner", agencyTemplateId: "asset" },
    data: { agencyTemplateId: null },
  });
});
it("deletes only unused assets and queues both private files for cleanup", async () => {
  expect(await removeAgencyTemplate("asset", "owner")).toEqual({
    archived: false,
  });
  expect(m.queue).toHaveBeenCalledWith(m.db, [
    "private/template",
    "private/preview",
  ]);
});
it("will not race an upload still in progress", async () => {
  m.db.agencyTemplate.findFirst.mockResolvedValue({
    ...asset,
    status: "UPLOADING",
    createdAt: new Date(),
  });
  await expect(removeAgencyTemplate("asset", "owner")).rejects.toMatchObject({
    status: 409,
  });
  expect(m.queue).not.toHaveBeenCalled();
});
