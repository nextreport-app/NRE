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
    $transaction: async (fn: (tx: unknown) => unknown) => fn({ emailDelivery: {updateMany: m.claim} }),
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
import { performanceAlertIntent } from "../alert-intent";
import { deliverQueuedEmail } from "../../email-delivery";
import { buildPerformanceFacts } from "../facts";
import { parseCsvText } from "../../nre/parse-csv";
const now = new Date("2026-11-20T12:00Z"),
  config = { currency: "USD", timezone: "UTC", metaAdAccountId: "123" };
let key: string;
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
  key = performanceAlertIntent("client", JSON.parse(client().performanceMonitorSnapshot), true)!.key;
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
  "other owner",
  "recipient changed",
  "new account",
  "unverified",
  "new window",
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

it("keeps a current critical email eligible when optional warnings are off", async () => {
  m.client.mockResolvedValue({...client(), performanceMonitorEmailEnabled:false});
  expect((await deliverQueuedEmail(key, now)).cancelled).not.toBe(true);
});
it("keeps the same incident queued across a fresh recheck for retry", async () => {
  const c = client();const snapshot=JSON.parse(c.performanceMonitorSnapshot);snapshot.checkedAt="2026-11-20T12:01:00.000Z";c.performanceMonitorSnapshot=JSON.stringify(snapshot);m.client.mockResolvedValue(c);
  expect((await deliverQueuedEmail(key, new Date("2026-11-20T12:02Z"))).cancelled).not.toBe(true);
});
it("delivers an eligible critical alert to the verified owner even with review warnings off", async () => {
  vi.stubEnv("RESEND_API_KEY", "mock-test-key");
  m.client.mockResolvedValue({...client(), performanceMonitorEmailEnabled:false});
  m.claim.mockResolvedValue({count:1});m.send.mockResolvedValue({data:{id:"mock-email"},error:null});
  expect(await deliverQueuedEmail(key, now)).toMatchObject({accepted:true});
  expect(m.send).toHaveBeenCalledWith(expect.objectContaining({to:["owner@example.com"]}), {idempotencyKey:key});
});
it("does not send an already accepted critical alert twice", async () => {
  m.find.mockResolvedValue({key,status:"ACCEPTED"});
  expect(await deliverQueuedEmail(key, now)).toMatchObject({accepted:true,alreadyAccepted:true});
  expect(m.send).not.toHaveBeenCalled();
});
