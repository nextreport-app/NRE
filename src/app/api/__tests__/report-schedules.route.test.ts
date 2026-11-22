vi.mock("@/lib/usage-rate-limit", () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(null),
}));
import { beforeEach, describe, it, expect, vi } from "vitest";
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    client: { findUnique: vi.fn() },
    reportSchedule: { findMany: vi.fn(), findFirst: vi.fn() },
    scheduledReportRun: { findFirst: vi.fn() },
  },
}));
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: vi.fn(),
}));
vi.mock("@/lib/report-schedules/service", () => ({
  saveReportSchedule: vi.fn(),
  createManualDraft: vi.fn(),
  processScheduledRun: vi.fn(),
  approveScheduledDraft: vi.fn(),
  sendApprovedDraft: vi.fn(),
  skipScheduledDraft: vi.fn(),
}));
vi.mock("@/lib/report-schedules/health", () => ({
  schedulerHealth: vi
    .fn()
    .mockResolvedValue({ healthy: false, configured: false }),
}));
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { after } from "next/server";
import * as service from "@/lib/report-schedules/service";
import { GET, POST } from "../clients/[id]/report-schedules/route";
const params = { params: Promise.resolve({ id: "client" }) };
const settings = {
  cadence: "WEEKLY",
  time: "09:00",
  timezone: "UTC",
  recipients: ["client@example.com"],
};
const request = (body: object) =>
  new Request("http://localhost/api/clients/client/report-schedules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({ user: { id: "owner" } } as never);
  vi.mocked(prisma.client.findUnique).mockResolvedValue({
    id: "client",
    userId: "owner",
    timezone: "UTC",
    metaAdAccountId: "account",
  } as never);
  vi.mocked(prisma.reportSchedule.findMany).mockResolvedValue([]);
  vi.mocked(prisma.scheduledReportRun.findFirst).mockResolvedValue({
    id: "run",
  } as never);
  vi.mocked(prisma.reportSchedule.findFirst).mockResolvedValue({
    id: "schedule",
    settingsJson: JSON.stringify(settings),
  } as never);
});
describe("owner scheduled report controls", () => {
  it("requires login for reads and writes", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    expect((await GET(new Request("http://localhost"), params)).status).toBe(
      401,
    );
    expect(
      (
        await POST(
          request({ action: "prepare", scheduleId: "schedule" }),
          params,
        )
      ).status,
    ).toBe(401);
    expect(service.createManualDraft).not.toHaveBeenCalled();
  });
  it("rejects a different client owner", async () => {
    vi.mocked(prisma.client.findUnique).mockResolvedValue({
      userId: "other",
    } as never);
    expect(
      (
        await POST(
          request({ action: "prepare", scheduleId: "schedule" }),
          params,
        )
      ).status,
    ).toBe(404);
    expect(service.createManualDraft).not.toHaveBeenCalled();
  });
  it("returns private non-cacheable schedule data", async () => {
    const result = await GET(new Request("http://localhost"), params);
    expect(result.headers.get("cache-control")).toBe("private, no-store");
    expect((await result.json()).health.healthy).toBe(false);
  });
  it.each([
    {
      action: "save",
      settings: { ...settings, recipients: [] },
      enabled: false,
    },
    {
      action: "approve",
      runId: "run",
      digest: "a".repeat(64),
      reviewed: false,
    },
    { action: "send", runId: "" },
    { action: "save", settings: { ...settings, time: "25:00" }, enabled: true },
  ])("rejects invalid or unreviewed input %#", async (body) =>
    expect((await POST(request(body), params)).status).toBe(400),
  );
  it("does not let an action escape the current client", async () => {
    vi.mocked(prisma.scheduledReportRun.findFirst).mockResolvedValue(null);
    expect(
      (await POST(request({ action: "send", runId: "other" }), params)).status,
    ).toBe(404);
    expect(service.sendApprovedDraft).not.toHaveBeenCalled();
  });
  it("queues preparation after returning acceptance", async () => {
    vi.mocked(service.createManualDraft).mockResolvedValue({
      id: "run",
    } as never);
    expect(
      (
        await POST(
          request({ action: "prepare", scheduleId: "schedule" }),
          params,
        )
      ).status,
    ).toBe(202);
    expect(after).toHaveBeenCalled();
    expect(service.sendApprovedDraft).not.toHaveBeenCalled();
  });
  it("approval does not imply send", async () => {
    expect(
      (
        await POST(
          request({
            action: "approve",
            runId: "run",
            digest: "a".repeat(64),
            reviewed: true,
          }),
          params,
        )
      ).status,
    ).toBe(200);
    expect(service.approveScheduledDraft).toHaveBeenCalledWith(
      "run",
      "owner",
      "a".repeat(64),
    );
    expect(service.sendApprovedDraft).not.toHaveBeenCalled();
  });
  it("distinguishes queued from provider-accepted delivery", async () => {
    vi.mocked(service.sendApprovedDraft).mockResolvedValue({ accepted: false });
    const result = await POST(
      request({ action: "send", runId: "run" }),
      params,
    );
    expect(await result.json()).toEqual({ ok: false, pending: true });
  });
  it("hides public token from an unapproved draft", async () => {
    vi.mocked(prisma.reportSchedule.findMany).mockResolvedValue([
      {
        id: "schedule",
        settingsJson: JSON.stringify(settings),
        runs: [
          {
            id: "run",
            status: "READY",
            settingsJson: JSON.stringify({ settings }),
            report: {
              id: "report",
              status: "COMPLETE",
              approvedAt: null,
              shareToken: "secret",
              filePath: "deck",
              summaryJson: "{}",
            },
          },
        ],
      },
    ] as never);
    const result = await GET(new Request("http://localhost"), params);
    const json = await result.json();
    expect(json.schedules[0].runs[0].report.shareToken).toBeNull();
    expect(json.schedules[0].runs[0].report.digest).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(json)).not.toContain('"summaryJson"');
  });
});
