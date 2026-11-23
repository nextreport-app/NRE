import { beforeEach, it, expect, vi } from "vitest";
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    report: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/subscription-guard", () => ({
  requireActiveSubscription: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/usage-rate-limit", () => ({
  enforceWizardLimits: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/http-file", () => ({
  fileFromFormData: vi.fn().mockResolvedValue(Buffer.from("image")),
}));
vi.mock("@/lib/logo-processing", () => ({
  contentTypeForLogoFormat: () => "image/png",
  detectLogoFormat: () => "png",
  isLogoValidationError: () => false,
  processLogoUpload: () => ({ buffer: Buffer.from("image"), format: "png" }),
}));
vi.mock("@/lib/storage", () => ({
  saveAgencyLogo: vi
    .fn()
    .mockResolvedValue("https://private.example/new-logo.png"),
  readLogoFile: vi.fn().mockResolvedValue(Buffer.from("image")),
  deleteLogoFile: vi.fn(),
}));
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { saveAgencyLogo, readLogoFile, deleteLogoFile } from "@/lib/storage";
import { POST, DELETE, GET } from "../account/logo/route";
import { GET as publicLogo } from "../r/[token]/agency-logo/route";
const request = () =>
  new Request("https://nextreport.in/api/account/logo", {
    method: "POST",
    body: new FormData(),
  });
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({ user: { id: "owner" } } as never);
  vi.mocked(prisma.user.findUnique).mockResolvedValue({
    agencyLogoUrl: "https://private.example/old-logo.png",
  } as never);
  vi.mocked(prisma.report.findUnique).mockResolvedValue({
    status: "COMPLETE",
    requiresApproval: false,
    approvedAt: null,
    summaryJson: JSON.stringify({
      reportBranding: {
        mode: "agency",
        agencyName: "Agency",
        agencyLogoUrl: "https://private.example/old-logo.png",
      },
    }),
  } as never);
});
it("requires authentication for profile writes", async () => {
  vi.mocked(auth).mockResolvedValue(null as never);
  expect((await POST(request())).status).toBe(401);
  expect((await DELETE()).status).toBe(401);
  expect(saveAgencyLogo).not.toHaveBeenCalled();
});
it("replaces the profile pointer without deleting snapshotted report branding", async () => {
  expect((await POST(request())).status).toBe(200);
  expect(prisma.user.update).toHaveBeenCalledWith({
    where: { id: "owner" },
    data: { agencyLogoUrl: "https://private.example/new-logo.png" },
  });
  expect(deleteLogoFile).not.toHaveBeenCalled();
  expect(
    (
      await publicLogo(new Request("https://nextreport.in/r/token"), {
        params: Promise.resolve({ token: "token" }),
      })
    ).status,
  ).toBe(200);
  expect(readLogoFile).toHaveBeenCalledWith(
    "https://private.example/old-logo.png",
  );
});
it("removes the current profile pointer while old reports can still load their revision", async () => {
  expect((await DELETE()).status).toBe(200);
  expect(prisma.user.update).toHaveBeenCalledWith({
    where: { id: "owner" },
    data: { agencyLogoUrl: null },
  });
  expect(deleteLogoFile).not.toHaveBeenCalled();
  expect(
    (
      await publicLogo(new Request("https://nextreport.in/r/token"), {
        params: Promise.resolve({ token: "token" }),
      })
    ).status,
  ).toBe(200);
  expect(readLogoFile).toHaveBeenCalledWith(
    "https://private.example/old-logo.png",
  );
});
it("does not cache a stale account preview after replacement/removal", async () => {
  expect((await GET()).headers.get("cache-control")).toBe("private, no-store");
});
it("keeps unapproved scheduled draft logos private", async () => {
  vi.mocked(prisma.report.findUnique).mockResolvedValue({
    status: "COMPLETE",
    requiresApproval: true,
    approvedAt: null,
    summaryJson: "{}",
  } as never);
  expect(
    (
      await publicLogo(new Request("https://nextreport.in/r/token"), {
        params: Promise.resolve({ token: "token" }),
      })
    ).status,
  ).toBe(404);
  expect(readLogoFile).not.toHaveBeenCalled();
});
it("does not delete any revision when the profile update fails", async () => {
  vi.mocked(prisma.user.update).mockRejectedValueOnce(
    Error("Synthetic database failure"),
  );
  expect((await POST(request())).status).toBe(500);
  expect(deleteLogoFile).not.toHaveBeenCalled();
});
