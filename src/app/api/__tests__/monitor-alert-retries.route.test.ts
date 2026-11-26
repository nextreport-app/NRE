import { beforeEach, afterEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ retry: vi.fn() }));
vi.mock("@/lib/email-delivery", () => ({ retryPendingEmails: m.retry }));
import { GET } from "../cron/monitor-alert-retries/route";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", "test-secret");
  m.retry.mockResolvedValue({ checked: 1, accepted: 1, failed: 0 });
});
afterEach(() => vi.unstubAllEnvs());
it("requires the cron secret before attempting delivery", async () => {
  expect((await GET(new Request("https://example.test"))).status).toBe(401);
  expect(m.retry).not.toHaveBeenCalled();
});
it("retries only monitoring emails with a bounded batch", async () => {
  const r = await GET(
    new Request("https://example.test", {
      headers: { authorization: "Bearer test-secret" },
    }),
  );
  expect(r.status).toBe(200);
  expect(m.retry).toHaveBeenCalledWith(30, [
    "PERFORMANCE_ALERT",
    "BUDGET_ALERT",
  ]);
});
it("fails closed if the cron secret is missing", async () => {
  vi.stubEnv("CRON_SECRET", "");
  expect((await GET(new Request("https://example.test"))).status).toBe(503);
  expect(m.retry).not.toHaveBeenCalled();
});
