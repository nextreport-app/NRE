import { beforeEach, afterEach, it, expect, vi } from "vitest";
vi.mock("../../prisma", () => ({
  prisma: { reportSchedulerState: { findUnique: vi.fn() } },
}));
import { prisma } from "../../prisma";
import { schedulerHealth } from "../health";
const now = new Date("2026-11-23T12:00Z");
beforeEach(() => {
  vi.stubEnv("REPORT_SCHEDULER_ENABLED", "true");
  vi.stubEnv("CRON_SECRET", "private-test-secret");
  vi.mocked(prisma.reportSchedulerState.findUnique).mockResolvedValue({
    id: "main",
    checkedAt: new Date("2026-11-23T11:55Z"),
  });
});
afterEach(() => vi.unstubAllEnvs());
it("requires activation, a cron secret and a recent completed heartbeat", async () => {
  expect((await schedulerHealth(now)).healthy).toBe(true);
  vi.stubEnv("CRON_SECRET", "");
  expect(await schedulerHealth(now)).toMatchObject({
    healthy: false,
    configured: false,
  });
});
it.each(["2026-11-23T12:01Z", "2026-11-23T11:39Z"])(
  "does not accept future/stale heartbeat %s",
  async (at) => {
    vi.mocked(prisma.reportSchedulerState.findUnique).mockResolvedValue({
      id: "main",
      checkedAt: new Date(at),
    });
    expect((await schedulerHealth(now)).healthy).toBe(false);
  },
);
