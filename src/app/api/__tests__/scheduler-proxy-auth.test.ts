import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("next-auth", () => ({
  default: () => ({ auth: (callback: unknown) => callback }),
}));
vi.mock("@/lib/auth.config", () => ({ default: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    reportSchedulerState: { upsert: vi.fn() },
    scheduledReportRun: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));
vi.mock("@/lib/report-schedules/service", () => ({
  enqueueDueSchedules: vi.fn().mockResolvedValue(0),
  processScheduledRun: vi.fn(),
  retryScheduledDelivery: vi.fn(),
}));
vi.mock("@/lib/email-delivery", () => ({
  retryPendingEmails: vi
    .fn()
    .mockResolvedValue({ checked: 0, accepted: 0, failed: 0 }),
}));
import proxy from "@/proxy";
import { GET } from "../cron/report-schedules/route";
import { prisma } from "@/lib/prisma";
const guard = proxy as unknown as (request: NextRequest) => Response;
function request(path: string, secret?: string) {
  const req = new NextRequest(`https://nextreport.in${path}`, {
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });
  Object.defineProperty(req, "auth", { value: null });
  return req;
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", "existing-other-jobs-key");
  vi.stubEnv("REPORT_SCHEDULER_CRON_SECRET", "dedicated-scheduler-key");
  vi.stubEnv("REPORT_SCHEDULER_ENABLED", "true");
});
afterEach(() => vi.unstubAllEnvs());
describe("scheduler entry boundary and handler agree", () => {
  it("lets a dedicated scheduler key through without a browser login and completes its tick", async () => {
    const req = request(
      "/api/cron/report-schedules",
      "dedicated-scheduler-key",
    );
    expect(guard(req).headers.get("x-middleware-next")).toBe("1");
    const result = await GET(req);
    expect(result.status).toBe(200);
    expect(await result.json()).toMatchObject({
      ok: true,
      enqueued: 0,
      processed: 0,
      remaining: 0,
    });
    expect(prisma.reportSchedulerState.upsert).toHaveBeenCalledOnce();
  });
  it("supports dedicated-only setup without the global key", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const req = request(
      "/api/cron/report-schedules",
      "dedicated-scheduler-key",
    );
    expect(guard(req).headers.get("x-middleware-next")).toBe("1");
    expect((await GET(req)).status).toBe(200);
  });
  it.each([undefined, "wrong", "existing-other-jobs-key"])(
    "rejects missing/wrong/global-only credentials before the scheduler: %s",
    (secret) => {
      expect(guard(request("/api/cron/report-schedules", secret)).status).toBe(
        401,
      );
      expect(prisma.reportSchedulerState.upsert).not.toHaveBeenCalled();
    },
  );
  it("preserves the legacy global-key setup when no dedicated key is configured", async () => {
    vi.stubEnv("REPORT_SCHEDULER_CRON_SECRET", "");
    const req = request(
      "/api/cron/report-schedules",
      "existing-other-jobs-key",
    );
    expect(guard(req).headers.get("x-middleware-next")).toBe("1");
    expect((await GET(req)).status).toBe(200);
  });
  it.each([
    "/api/cron/budget-monitor",
    "/api/cron/performance-monitor",
    "/api/cron/trial-reminders",
    "/api/jobs/generate-report",
    "/api/cron/report-schedules/anything",
  ])(
    "does not let the scheduler key authorize other worker paths: %s",
    (path) => {
      expect(guard(request(path, "dedicated-scheduler-key")).status).toBe(401);
      expect(
        guard(request(path, "existing-other-jobs-key")).headers.get(
          "x-middleware-next",
        ),
      ).toBe("1");
    },
  );
  it("does not let the new bearer credential bypass account authentication", () => {
    expect(
      guard(request("/api/account", "dedicated-scheduler-key")).headers.get(
        "location",
      ),
    ).toContain("/login");
  });
});
