import { beforeEach, afterEach, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({
  client: { findUnique: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
  user: { update: vi.fn() },
  blocked: false,
  fetch: vi.fn(),
  metadata: vi.fn(),
  values: vi.fn(),
  queue: vi.fn(),
  deliver: vi.fn(),
}));
vi.mock("../../prisma", () => ({ prisma: { client: m.client, user: m.user } }));
vi.mock("../../subscription", () => ({
  getSubscriptionStatus: () => ({ isBlocked: m.blocked }),
}));
vi.mock("../../meta-api", () => ({
  ensureFreshMetaAccessToken: vi
    .fn()
    .mockResolvedValue({ accessToken: "fresh", refreshed: false }),
  fetchMetaAdAccountMetadata: m.metadata,
  fetchMetaCampaignValueInsights: m.values,
}));
vi.mock("../../meta-token-storage", () => ({
  decryptMetaToken: () => "token",
  encryptMetaToken: () => "encrypted",
}));
vi.mock("../../nre/meta-api-sync", () => ({ fetchMetaReportCsv: m.fetch }));
vi.mock("../../email-delivery", () => ({
  queueEmail: m.queue,
  deliverQueuedEmail: m.deliver,
}));
import { checkClientPerformance } from "../service";
const now = new Date("2026-11-20T12:00Z");
const config = { metaAdAccountId: "123", currency: "USD", timezone: "UTC" };
const client = {
  id: "client",
  userId: "owner",
  accountName: "Test",
  ...config,
  performanceMonitorEnabled: true,
  performanceMonitorEmailEnabled: true,
  performanceMonitorSnapshot: null as string | null,
  user: {
    email: "owner@example.com",
    emailVerified: now,
    metaAdsEnabled: true,
    metaAccessToken: "secret",
  },
};
const csv =
  "Campaign name,Day,Amount spent (USD),Results,Result type,Impressions,Clicks (all)\nLeads,2026-11-19,100,10,On-Facebook leads,10000,50\nLeads,2026-11-12,100,20,On-Facebook leads,10000,100";
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(now);
  m.blocked = false;
  m.client.findUnique.mockResolvedValue(client);
  m.client.findFirst.mockResolvedValue(client);
  m.client.updateMany.mockResolvedValue({ count: 1 });
  m.metadata.mockResolvedValue({ currency: "USD", timezone_name: "UTC" });
  m.fetch.mockResolvedValue({ csvText: csv });
  m.deliver.mockResolvedValue({ accepted: true });
});
afterEach(() => vi.useRealTimers());
it("requires ownership before contacting Meta", async () => {
  await expect(
    checkClientPerformance("client", "other", now),
  ).rejects.toMatchObject({ status: 404 });
  expect(m.fetch).not.toHaveBeenCalled();
});
it("requires active verified accounts and rotates blocked scans out of the queue", async () => {
  m.blocked = true;
  await expect(
    checkClientPerformance("client", "owner", now),
  ).rejects.toMatchObject({ status: 403 });
  expect(m.client.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({ data: { performanceMonitorLastAttemptAt: now } }),
  );
  expect(m.fetch).not.toHaveBeenCalled();
});
it("requires opt-in and a linked account", async () => {
  m.client.findUnique.mockResolvedValue({
    ...client,
    performanceMonitorEnabled: false,
  });
  await expect(checkClientPerformance("client", "owner", now)).rejects.toThrow(
    "Enable performance",
  );
  expect(m.fetch).not.toHaveBeenCalled();
});
it("leases and cools down concurrent checks", async () => {
  m.client.updateMany.mockResolvedValue({ count: 0 });
  await expect(
    checkClientPerformance("client", "owner", now),
  ).rejects.toMatchObject({ status: 429 });
  expect(m.fetch).not.toHaveBeenCalled();
});
it("uses fresh Meta data, exact closed periods, and owner email only", async () => {
  const s = await checkClientPerformance("client", "owner", now);
  expect(s.error).toBeUndefined();
  expect(m.fetch).toHaveBeenCalledWith(
    expect.objectContaining({
      adAccountId: "123",
      sinceIso: "2026-11-06",
      untilIso: "2026-11-19",
      requireDirectResultEvidence: true,
    }),
  );
  expect(m.queue).toHaveBeenCalledWith(
    expect.objectContaining({
      key: "performance-alert:client:2026-11-19:2026-11-13:review",
      kind: "PERFORMANCE_ALERT",
      payload: expect.objectContaining({ to: ["owner@example.com"] }),
    }),
  );
});
it("does not send mail when owner opted out", async () => {
  m.client.findUnique.mockResolvedValue({
    ...client,
    performanceMonitorEmailEnabled: false,
  });
  await checkClientPerformance("client", "owner", now);
  expect(m.queue).not.toHaveBeenCalled();
});
it("rejects currency/timezone mismatch before data fetch", async () => {
  m.metadata.mockResolvedValue({ currency: "INR", timezone_name: "UTC" });
  const s = await checkClientPerformance("client", "owner", now);
  expect(s.error).toContain("currency");
  expect(m.fetch).not.toHaveBeenCalled();
  expect(m.queue).not.toHaveBeenCalled();
});
it("keeps prior facts with an error on fetch failure and sends no alert", async () => {
  const previous = await checkClientPerformance("client", "owner", now);
  m.queue.mockClear();
  m.client.findUnique.mockResolvedValue({
    ...client,
    performanceMonitorSnapshot: JSON.stringify(previous),
  });
  m.fetch.mockRejectedValue(Error("token details must not leak"));
  const s = await checkClientPerformance("client", "owner", now);
  expect(s.facts).toEqual(previous.facts);
  expect(s.error).toContain("failed");
  expect(s.error).not.toContain("token details");
  expect(m.queue).not.toHaveBeenCalled();
});
it("does not publish a fresh snapshot if account settings changed during sync", async () => {
  m.client.updateMany
    .mockResolvedValueOnce({ count: 1 })
    .mockResolvedValueOnce({ count: 0 });
  const s = await checkClientPerformance("client", "owner", now);
  expect(s.error).toContain("settings changed");
  expect(m.queue).not.toHaveBeenCalled();
});
it("does not invent warnings on a successful empty response", async () => {
  m.fetch.mockResolvedValue({ csvText: csv.split("\n")[0] });
  const s = await checkClientPerformance("client", "owner", now);
  expect(s.error).toBeUndefined();
  expect(s.facts?.empty).toBe(true);
  expect(m.queue).not.toHaveBeenCalled();
});
it("marks failed email separately without losing measured facts", async () => {
  m.deliver.mockResolvedValue({ accepted: false });
  const s = await checkClientPerformance("client", "owner", now);
  expect(s.facts).toBeDefined();
  expect(s.error).toBeUndefined();
  expect(s.emailError).toContain("not been confirmed");
});

it("does not repeat continuing owner warnings", async()=>{
 const first=await checkClientPerformance("client","owner",now);
 m.queue.mockClear();m.deliver.mockClear();
 m.client.findUnique.mockResolvedValue({...client,performanceMonitorSnapshot:JSON.stringify(first)});
 const next=await checkClientPerformance("client","owner",now);
 expect(next.facts?.campaigns[0].signals.every(s=>s.state==="continuing")).toBe(true);
 expect(m.queue).not.toHaveBeenCalled();
});
it("fixed historical custom comparisons never email",async()=>{
 m.client.findUnique.mockResolvedValue({...client,performanceCustomStart:"2026-11-13",performanceCustomEnd:"2026-11-19",performanceWindowDays:7});
 const result=await checkClientPerformance("client","owner",now);
 expect(result.error).toBeUndefined();expect(result.facts?.campaigns[0].signals.length).toBeGreaterThan(0);expect(m.queue).not.toHaveBeenCalled();
});
it("purchase lookup failure preserves delivery data and marks ROAS unavailable",async()=>{
 m.fetch.mockResolvedValue({csvText:csv.replaceAll("On-Facebook leads","Website purchases")});
 m.values.mockRejectedValue(Error("Meta temporarily unavailable"));
 const result=await checkClientPerformance("client","owner",now);
 expect(result.error).toBeUndefined();expect(result.facts?.valueWarning).toBe(true);expect(result.facts?.current.spend).toBe(100);expect(result.facts?.campaigns[0].signals.some(s=>s.key==="roas-unavailable")).toBe(true);
});
