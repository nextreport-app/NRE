import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  auth: vi.fn(),
  report: vi.fn(),
  user: vi.fn(),
  clientWrite: vi.fn(),
  reportWrite: vi.fn(),
  save: vi.fn(),
  tx: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    report: { findUnique: m.report },
    user: { findUnique: m.user },
    $transaction: m.tx,
  },
}));
vi.mock("@/lib/storage", () => ({
  readReportFile: async () => Buffer.from("pptx"),
}));
vi.mock("@/lib/google-drive", () => ({
  DEFAULT_DRIVE_FOLDER_NAME: "Drive Folder",
  saveReportToDriveFolder: m.save,
}));
vi.mock("@/lib/client-provider-connections", () => ({
  resolveClientUser: async (u: object) => u,
  clientProviderWriteWhere: () => ({
    providerConnections: {
      some: { id: "client-drive", credentials: "snapshot" },
    },
  }),
}));
import { POST } from "../reports/[id]/save-to-drive/route";
beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ user: { id: "owner" } });
  m.report.mockResolvedValue({
    id: "report",
    status: "COMPLETE",
    filePath: "saved",
    fileName: "report.pptx",
    summaryJson: "version",
    client: { id: "client", userId: "owner" },
  });
  m.user.mockResolvedValue({ googleRefreshToken: "client-token" });
  m.clientWrite.mockResolvedValue({ count: 1 });
  m.reportWrite.mockResolvedValue({ count: 1 });
  m.tx.mockImplementation(
    async (
      fn: (tx: {
        client: { updateMany: typeof m.clientWrite };
        report: { updateMany: typeof m.reportWrite };
      }) => Promise<unknown>,
    ) =>
      fn({
        client: { updateMany: m.clientWrite },
        report: { updateMany: m.reportWrite },
      }),
  );
  m.save.mockImplementation(
    async ({ onProgress }: { onProgress?: (n: number) => void }) => {
      for (const n of [40, 60, 80]) onProgress?.(n);
      return { webViewLink: "https://slides.test/saved" };
    },
  );
});
const invoke = (stream = true) =>
  POST(
    new Request("https://app.test/api/reports/report/save-to-drive", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(stream ? { Accept: "application/x-ndjson" } : {}),
      },
      body: JSON.stringify({ folderId: "folder-b" }),
    }),
    { params: Promise.resolve({ id: "report" }) },
  );
it("streams only completed steps and ends at 100 after profile-guarded persistence", async () => {
  const r = await invoke();
  expect(r.headers.get("content-type")).toContain("ndjson");
  const events = (await r.text())
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  expect(events.map((e) => e.progress)).toEqual([0, 20, 40, 60, 80, 100]);
  expect(events.at(-1).url).toBe("https://slides.test/saved");
  expect(m.save.mock.calls[0][0].refreshToken).toBe("client-token");
  expect(m.clientWrite.mock.calls[0][0].where).toMatchObject({
    id: "client",
    userId: "owner",
    providerConnections: {
      some: { id: "client-drive", credentials: "snapshot" },
    },
  });
});
it("does not publish success or replace the folder when the profile changed", async () => {
  m.clientWrite.mockResolvedValue({ count: 0 });
  const r = await invoke();
  const events = (await r.text())
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  expect(events.at(-1).error).toContain("profile changed");
  expect(events.some((e) => e.progress === 100)).toBe(false);
  expect(m.reportWrite).not.toHaveBeenCalled();
});
it("retains ordinary JSON compatibility", async () => {
  const r = await invoke(false);
  expect(r.status).toBe(200);
  expect((await r.json()).url).toBe("https://slides.test/saved");
});
it("rejects unapproved drafts and other owners before opening the provider", async () => {
  m.report
    .mockResolvedValueOnce({
      requiresApproval: true,
      approvedAt: null,
      client: { userId: "owner" },
    })
    .mockResolvedValueOnce({ client: { userId: "other" } });
  expect((await invoke()).status).toBe(409);
  expect((await invoke()).status).toBe(404);
  expect(m.save).not.toHaveBeenCalled();
});
