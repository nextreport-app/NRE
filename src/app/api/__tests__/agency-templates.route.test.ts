import { POST as upload } from "../account/templates/upload/route";
import { beforeEach, it, expect, vi } from "vitest";
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    agencyTemplate: { findMany: vi.fn(), findFirst: vi.fn() },
    client: { findFirst: vi.fn() },
  },
}));
vi.mock("@/lib/agency-templates/upload", () => ({
  uploadAgencyTemplate: vi.fn(),
}));
vi.mock("@/lib/agency-templates/service", () => ({
  uploadAgencyTemplate: vi.fn(),
  approveAgencyTemplate: vi.fn(),
  removeAgencyTemplate: vi.fn(),
  selectClientDesign: vi.fn(),
}));
vi.mock("@/lib/usage-rate-limit", () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/report-download-response", () => ({
  reportDownloadResponse: vi.fn().mockResolvedValue(new Response("sample")),
}));
vi.mock("@/lib/blob-deletion-outbox", () => ({
  drainBlobDeletionQueue: vi.fn().mockResolvedValue(0),
}));
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: vi.fn(),
}));
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as service from "@/lib/agency-templates/service";
import { uploadAgencyTemplate } from "@/lib/agency-templates/upload";
import { reportDownloadResponse } from "@/lib/report-download-response";
import { GET as list } from "../account/templates/route";
import { PATCH as approve } from "../account/templates/[templateId]/route";
import { GET as download } from "../account/templates/[templateId]/download/route";
import { GET as designs, PATCH as select } from "../clients/[id]/design/route";
const assetParams = { params: Promise.resolve({ templateId: "asset" }) },
  clientParams = { params: Promise.resolve({ id: "client" }) };
const request = (body: object) =>
  new Request("http://localhost/api/test", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({ user: { id: "owner" } } as never);
  vi.mocked(prisma.agencyTemplate.findMany).mockResolvedValue([]);
  vi.mocked(prisma.agencyTemplate.findFirst).mockResolvedValue({
    filePath: "private/design",
    previewPath: "private/preview",
  } as never);
  vi.mocked(prisma.client.findFirst).mockResolvedValue({
    template: "DARK",
    agencyTemplateId: null,
  } as never);
});
it("requires authentication for list, approval and downloads", async () => {
  vi.mocked(auth).mockResolvedValue(null as never);
  expect((await list()).status).toBe(401);
  expect(
    (
      await approve(
        request({ reviewed: true, digest: "a".repeat(64) }),
        assetParams,
      )
    ).status,
  ).toBe(401);
  expect(
    (await download(new Request("http://localhost/sample"), assetParams))
      .status,
  ).toBe(401);
  expect(reportDownloadResponse).not.toHaveBeenCalled();
});
it("lists only the owner's designs and does not return private file URLs", async () => {
  const response = await list();
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(prisma.agencyTemplate.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { userId: "owner" },
      select: expect.not.objectContaining({ filePath: true }),
    }),
  );
});
it("requires an explicit sample review before approval", async () => {
  expect(
    (
      await approve(
        request({ reviewed: false, digest: "a".repeat(64) }),
        assetParams,
      )
    ).status,
  ).toBe(400);
  expect(service.approveAgencyTemplate).not.toHaveBeenCalled();
  expect(
    (
      await approve(
        request({ reviewed: true, digest: "a".repeat(64) }),
        assetParams,
      )
    ).status,
  ).toBe(200);
  expect(service.approveAgencyTemplate).toHaveBeenCalledWith(
    "asset",
    "owner",
    "a".repeat(64),
  );
});
it("authorizes downloads before serving the stored sample with range support", async () => {
  await download(
    new Request("http://localhost/sample?preview=1", {
      headers: { range: "bytes=0-99" },
    }),
    assetParams,
  );
  expect(prisma.agencyTemplate.findFirst).toHaveBeenCalledWith({
    where: { id: "asset", userId: "owner", status: "READY" },
  });
  expect(reportDownloadResponse).toHaveBeenCalledWith(
    expect.any(Request),
    "private/preview",
    "Sample-template-review.pptx",
  );
});
it("does not download another owner's template", async () => {
  vi.mocked(prisma.agencyTemplate.findFirst).mockResolvedValue(null);
  expect(
    (await download(new Request("http://localhost/sample"), assetParams))
      .status,
  ).toBe(404);
  expect(reportDownloadResponse).not.toHaveBeenCalled();
});
it("requires client ownership before listing selectable designs", async () => {
  vi.mocked(prisma.client.findFirst).mockResolvedValue(null);
  expect(
    (await designs(new Request("http://localhost"), clientParams)).status,
  ).toBe(404);
  expect(prisma.agencyTemplate.findMany).not.toHaveBeenCalled();
});
it("selects an owned design through the guarded service", async () => {
  expect(
    (await select(request({ agencyTemplateId: "asset" }), clientParams)).status,
  ).toBe(200);
  expect(service.selectClientDesign).toHaveBeenCalledWith("client", "owner", {
    agencyTemplateId: "asset",
  });
});
it("rejects oversized request bodies before reading uploaded bytes", async () => {
  const response = await upload(
    new Request("http://localhost", {
      method: "POST",
      headers: { "content-length": String(5 * 1024 * 1024) },
    }),
  );
  expect(response.status).toBe(413);
  expect(uploadAgencyTemplate).not.toHaveBeenCalled();
});
