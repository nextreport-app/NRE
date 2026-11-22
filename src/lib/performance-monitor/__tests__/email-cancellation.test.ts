import { beforeEach, afterEach, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({
  find: vi.fn(),
  client: vi.fn(),
  update: vi.fn(),
  send: vi.fn(),
  claim: vi.fn(),
}));
vi.mock("../../prisma", () => ({
  prisma: {
    emailDelivery: {
      findUnique: m.find,
      update: m.update,
      updateMany: m.claim,
    },
    client: { findUnique: m.client },
  },
}));
vi.mock("../../email", () => ({
  FROM_ADDRESS: "no-reply@example.com",
  getResendClient: () => ({ emails: { send: m.send } }),
}));
vi.mock("../../subscription", () => ({
  getSubscriptionStatus: () => ({ isBlocked: false }),
}));
import { deliverQueuedEmail } from "../../email-delivery";
import { buildPerformanceFacts } from "../facts";
import { parseCsvText } from "../../nre/parse-csv";
const now = new Date("2026-11-20T12:00Z"),
  key = "performance-alert:client:2026-11-19:2026-11-13:review",
  config = { currency: "USD", timezone: "UTC", metaAdAccountId: "123" };
function client() {
  const parsed = parseCsvText(
    "Campaign name,Day,Amount spent (USD),Results,Result type,Impressions,Clicks (all)\nCampaign,2026-11-19,100,10,On-Facebook leads,10000,50\nCampaign,2026-11-12,100,20,On-Facebook leads,10000,100",
  );
  return {
    id: "client",
    userId: "owner",
    ...config,
    performanceMonitorEnabled: true,
    performanceMonitorEmailEnabled: true,
    user: { email: "owner@example.com", emailVerified: now },
    performanceMonitorSnapshot: JSON.stringify({
      version: 2,
      config,
      checkedAt: now.toISOString(),
      facts: buildPerformanceFacts(parsed.rows, parsed.headers, config, now),
    }),
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("RESEND_API_KEY", "");
  m.find.mockResolvedValue({
    key,
    kind: "PERFORMANCE_ALERT",
    userId: "owner",
    status: "PENDING",
    payloadJson: JSON.stringify({
      to: ["owner@example.com"],
      text: `Last checked: ${now.toISOString()}.`,
    }),
  });
  m.client.mockResolvedValue(client());
});
afterEach(() => vi.unstubAllEnvs());
it("keeps a current owner notification queued when email is not configured", async () => {
  expect((await deliverQueuedEmail(key, now)).cancelled).not.toBe(true);
  expect(m.update).not.toHaveBeenCalled();
});
it.each([
  "disabled",
  "email off",
  "other owner",
  "recipient changed",
  "new account",
  "unverified",
  "new window",
  "superseded snapshot",
])("cancels obsolete warning mail: %s", async (reason) => {
  const c = client();
  if (reason === "disabled") c.performanceMonitorEnabled = false;
  if (reason === "email off") c.performanceMonitorEmailEnabled = false;
  if (reason === "other owner") c.userId = "other";
  if (reason === "recipient changed") c.user.email = "other@example.com";
  if (reason === "new account") c.metaAdAccountId = "456";
  if (reason === "unverified") c.user.emailVerified = null as never;
  if (reason === "superseded snapshot") {
    const s = JSON.parse(c.performanceMonitorSnapshot);
    s.checkedAt = "2026-11-20T12:01:00.000Z";
    c.performanceMonitorSnapshot = JSON.stringify(s);
  }
  m.client.mockResolvedValue(c);
  expect(
    (
      await deliverQueuedEmail(
        key,
        reason === "new window" ? new Date("2026-11-21T01:00Z") : now,
      )
    ).cancelled,
  ).toBe(true);
  expect(m.send).not.toHaveBeenCalled();
});
