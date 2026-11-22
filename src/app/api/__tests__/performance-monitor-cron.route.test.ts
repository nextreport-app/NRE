import { beforeEach, afterEach, it, expect, vi } from "vitest";
vi.mock("@/lib/prisma", () => ({ prisma: { client: { findMany: vi.fn() } } }));
vi.mock("@/lib/performance-monitor/service", () => ({
  checkClientPerformance: vi.fn(),
}));
import { prisma } from "@/lib/prisma";
import { checkClientPerformance } from "@/lib/performance-monitor/service";
import { ServiceError } from "@/lib/service-error";
import { GET } from "../cron/performance-monitor/route";
const request = (token = "secret") =>
  new Request("http://localhost/api/cron/performance-monitor", {
    headers: { authorization: `Bearer ${token}` },
  });
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", "secret");
  vi.mocked(prisma.client.findMany).mockResolvedValue([]);
  vi.mocked(checkClientPerformance).mockResolvedValue({ version: 1 } as never);
});
afterEach(() => vi.unstubAllEnvs());
it("requires a configured secret and valid authentication", async () => {
  vi.stubEnv("CRON_SECRET", "");
  expect((await GET(request())).status).toBe(503);
  vi.stubEnv("CRON_SECRET", "secret");
  expect((await GET(request("wrong"))).status).toBe(401);
  expect(prisma.client.findMany).not.toHaveBeenCalled();
});
it("checks opted-in accounts and reports partial failure", async () => {
  vi.mocked(prisma.client.findMany).mockResolvedValue([
    { id: "a", userId: "owner" },
    { id: "b", userId: "owner" },
    { id: "c", userId: "owner" },
  ] as never);
  vi.mocked(checkClientPerformance)
    .mockResolvedValueOnce({ version: 1 } as never)
    .mockResolvedValueOnce({ version: 1, error: "sync failed" } as never)
    .mockRejectedValueOnce(new ServiceError("busy", 429));
  const result = await GET(request());
  expect(result.status).toBe(503);
  expect(await result.json()).toMatchObject({
    checked: 3,
    failed: 1,
    skipped: 1,
    remaining: 0,
  });
  expect(prisma.client.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({ performanceMonitorEnabled: true }),
    }),
  );
});
