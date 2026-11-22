vi.mock("@/lib/email-delivery", () => ({
  retryPendingEmails: vi
    .fn()
    .mockResolvedValue({ checked: 0, accepted: 0, failed: 0 }),
}));
import { retryPendingEmails } from "@/lib/email-delivery";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
vi.mock("@/lib/prisma", () => ({
  prisma: {
    reportSchedulerState: { upsert: vi.fn() },
    scheduledReportRun: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/report-schedules/service", () => ({
  enqueueDueSchedules: vi.fn(),
  processScheduledRun: vi.fn(),
  retryScheduledDelivery: vi.fn(),
}));
import { prisma } from "@/lib/prisma";
import * as service from "@/lib/report-schedules/service";
import { GET } from "../cron/report-schedules/route";
const request = (secret = "test-secret") =>
  new Request("http://localhost/api/cron/report-schedules", {
    headers: { authorization: `Bearer ${secret}` },
  });
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", "test-secret");
  vi.stubEnv("REPORT_SCHEDULER_ENABLED", "true");
  vi.mocked(prisma.scheduledReportRun.findMany).mockResolvedValue([]);
  vi.mocked(service.enqueueDueSchedules).mockResolvedValue(0);
});
afterEach(() => vi.unstubAllEnvs());
describe("private scheduler tick", () => {
  it("requires configuration and authentication", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(request())).status).toBe(503);
    vi.stubEnv("CRON_SECRET", "test-secret");
    expect((await GET(request("wrong"))).status).toBe(401);
    expect(prisma.reportSchedulerState.upsert).not.toHaveBeenCalled();
  });
  it("does not advertise a heartbeat when disabled", async () => {
    vi.stubEnv("REPORT_SCHEDULER_ENABLED", "false");
    expect((await GET(request())).status).toBe(503);
    expect(prisma.reportSchedulerState.upsert).not.toHaveBeenCalled();
  });
  it("updates health and resumes draft preparation separately from explicit sends", async () => {
    vi.mocked(prisma.scheduledReportRun.findMany).mockResolvedValue([
      { id: "draft", status: "GENERATING" },
      { id: "delivery", status: "SENDING" },
    ] as never);
    const result = await GET(request());
    expect(result.status).toBe(200);
    expect(prisma.reportSchedulerState.upsert).toHaveBeenCalled();
    expect(service.processScheduledRun).toHaveBeenCalledWith("draft");
    expect(service.retryScheduledDelivery).toHaveBeenCalledWith("delivery");
    expect(service.retryScheduledDelivery).not.toHaveBeenCalledWith("draft");
  });
});

it("does not publish a successful heartbeat when tick preparation throws", async () => {
  vi.mocked(service.enqueueDueSchedules).mockRejectedValueOnce(
    Error("Synthetic preparation outage"),
  );
  expect((await GET(request())).status).toBe(500);
  expect(prisma.reportSchedulerState.upsert).not.toHaveBeenCalled();
  expect(retryPendingEmails).not.toHaveBeenCalled();
});
it("retries only existing delivery intents after processing", async () => {
  const result = await GET(request());
  expect(result.status).toBe(200);
  expect(retryPendingEmails).toHaveBeenCalledWith(10);
  expect(
    vi.mocked(retryPendingEmails).mock.invocationCallOrder[0],
  ).toBeLessThan(
    vi.mocked(prisma.reportSchedulerState.upsert).mock.invocationCallOrder[0],
  );
});
