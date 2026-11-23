import { beforeEach, afterEach, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({
  client: vi.fn(),
  upsert: vi.fn(),
  update: vi.fn(),
  user: vi.fn(),
  token: vi.fn(),
  fetch: vi.fn(),
  blocked: false,
}));
vi.mock("../../prisma", () => ({
  prisma: {
    client: { findUnique: m.client },
    websiteDashboardSnapshot: { upsert: m.upsert, updateMany: m.update },
    user: { updateMany: m.user },
  },
}));
vi.mock("../../subscription", () => ({
  getSubscriptionStatus: () => ({ isBlocked: m.blocked }),
}));
vi.mock("../../ga4-api", () => ({ refreshGa4AccessToken: m.token }));
vi.mock("../fetch", () => ({ fetchWebsiteSnapshot: m.fetch }));
import { refreshWebsiteDashboard, websiteConnectionKey } from "../service";
import { websitePeriods, WEBSITE_METRICS } from "../model";
const now = new Date("2026-11-20T12:00Z");
const client = {
  id: "own-website",
  userId: "owner",
  ga4PropertyId: "552954256",
  user: {
    ga4Enabled: true,
    ga4RefreshToken: "refresh-secret",
    emailVerified: now,
  },
};
const record = {
  id: "snapshot",
  propertyId: "552954256",
  connectionKey: websiteConnectionKey("refresh-secret"),
  dataJson: null as string | null,
  error: null,
  lastAttemptAt: null as Date | null,
};
const snapshot = {
  version: 1,
  days: 7,
  property: {
    propertyId: "552954256",
    displayName: "NextReport",
    timezone: "Asia/Kolkata",
    currency: "INR",
  },
  checkedAt: now.toISOString(),
  ...websitePeriods(7, "Asia/Kolkata", now),
  current: Object.fromEntries(WEBSITE_METRICS.map((k) => [k, null])),
  previous: Object.fromEntries(WEBSITE_METRICS.map((k) => [k, null])),
  channels: [],
  pages: [],
  trend: [],
  warnings: [],
  empty: true,
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(now);
  m.blocked = false;
  m.client.mockResolvedValue(client);
  m.upsert.mockResolvedValue(record);
  m.update.mockResolvedValue({ count: 1 });
  m.user.mockResolvedValue({ count: 1 });
  m.token.mockResolvedValue({ access_token: "fresh" });
  m.fetch.mockResolvedValue(snapshot);
});
afterEach(() => vi.useRealTimers());
it("rejects another owner before accessing GA4", async () => {
  await expect(
    refreshWebsiteDashboard("own-website", "intruder", 7, now),
  ).rejects.toMatchObject({ status: 404 });
  expect(m.token).not.toHaveBeenCalled();
});
it("requires active verified accounts", async () => {
  m.blocked = true;
  await expect(
    refreshWebsiteDashboard("own-website", "owner", 7, now),
  ).rejects.toMatchObject({ status: 403 });
  expect(m.token).not.toHaveBeenCalled();
});
it("does not assume an ad client's property or invent a default", async () => {
  m.client.mockResolvedValue({ ...client, ga4PropertyId: null });
  await expect(
    refreshWebsiteDashboard("own-website", "owner", 7, now),
  ).rejects.toThrow("Link a GA4 property");
  expect(m.fetch).not.toHaveBeenCalled();
});
it("requires a GA4 connection, independently of Meta", async () => {
  m.client.mockResolvedValue({
    ...client,
    user: { ...client.user, ga4Enabled: false },
  });
  await expect(
    refreshWebsiteDashboard("own-website", "owner", 7, now),
  ).rejects.toThrow("Connect Google Analytics");
});
it("leases and freezes the property/connection before saving", async () => {
  await refreshWebsiteDashboard("own-website", "owner", 7, now);
  expect(m.token).toHaveBeenCalledWith("refresh-secret");
  expect(m.fetch).toHaveBeenCalledWith("fresh", "552954256", 7, now);
  expect(m.update).toHaveBeenLastCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        propertyId: "552954256",
        lastAttemptAt: now,
        client: expect.objectContaining({
          ga4PropertyId: "552954256",
          userId: "owner",
        }),
      }),
      data: expect.objectContaining({ error: null, leaseUntil: null }),
    }),
  );
});
it("reuses a recent successful snapshot rather than refetching", async () => {
  m.upsert.mockResolvedValue({
    ...record,
    lastAttemptAt: now,
    dataJson: JSON.stringify(snapshot),
  });
  expect(await refreshWebsiteDashboard("own-website", "owner", 7, now)).toEqual(
    { cached: true },
  );
  expect(m.token).not.toHaveBeenCalled();
});
it("cooldowns failed checks and rejects concurrent refreshes", async () => {
  m.upsert.mockResolvedValue({ ...record, lastAttemptAt: now });
  await expect(
    refreshWebsiteDashboard("own-website", "owner", 7, now),
  ).rejects.toMatchObject({ status: 429 });
  m.upsert.mockResolvedValue(record);
  m.update.mockResolvedValue({ count: 0 });
  await expect(
    refreshWebsiteDashboard("own-website", "owner", 7, now),
  ).rejects.toMatchObject({ status: 429 });
  expect(m.token).not.toHaveBeenCalled();
});
it("retains prior data on failure and hides provider error details", async () => {
  m.fetch.mockRejectedValue(Error("private provider body"));
  await expect(
    refreshWebsiteDashboard("own-website", "owner", 7, now),
  ).rejects.toThrow("GA4 refresh failed");
  expect(m.update).toHaveBeenLastCalledWith(
    expect.objectContaining({
      data: {
        error: expect.stringContaining("Prior figures"),
        leaseUntil: null,
      },
    }),
  );
  expect(m.update).not.toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ dataJson: null }),
    }),
  );
});
it("does not use a stale access token if refreshing the grant fails", async () => {
  m.token.mockRejectedValue(Error("expired grant"));
  await expect(
    refreshWebsiteDashboard("own-website", "owner", 7, now),
  ).rejects.toThrow("connection");
  expect(m.fetch).not.toHaveBeenCalled();
});
it("fails closed if the owner disconnects during refresh", async () => {
  m.user.mockResolvedValue({ count: 0 });
  await expect(
    refreshWebsiteDashboard("own-website", "owner", 7, now),
  ).rejects.toMatchObject({ status: 409 });
  expect(m.fetch).not.toHaveBeenCalled();
});
it("cannot commit data after a property relink", async () => {
  m.update
    .mockResolvedValueOnce({ count: 1 })
    .mockResolvedValueOnce({ count: 0 });
  await expect(
    refreshWebsiteDashboard("own-website", "owner", 7, now),
  ).rejects.toMatchObject({ status: 409 });
});
it("invalidates prior cache when the connected GA4 account changes", async () => {
  m.upsert.mockResolvedValue({
    ...record,
    connectionKey: "old",
    dataJson: JSON.stringify(snapshot),
    lastAttemptAt: now,
  });
  await refreshWebsiteDashboard("own-website", "owner", 7, now);
  expect(m.update).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ dataJson: null, checkedAt: null }),
    }),
  );
});

it("preserves the safe provider recovery message without marking old data fresh", async () => {
  const { ga4RequestError } = await import("../../ga4-request-error");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const error = await ga4RequestError(new Response(JSON.stringify({ error: { details: [{ reason: "SERVICE_DISABLED" }], message: "private provider detail" } }), { status: 403 }), "report");
  m.fetch.mockRejectedValue(error);
  await expect(refreshWebsiteDashboard("own-website", "owner", 7, now)).rejects.toThrow("GA4_REPORT_API_DISABLED_403");
  expect(m.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: { error: error.message, leaseUntil: null } }));
  expect(error.message).not.toContain("private provider detail");
  vi.restoreAllMocks();
});

it("uses one bounded custom cache and delegates the exact dates", async () => {
  const selection={startIso:"2026-11-01",endIso:"2026-11-10"};
  const custom={...snapshot,days:10,rangeMode:"custom",currentPeriod:selection,previousPeriod:{startIso:"2026-10-22",endIso:"2026-10-31"}};
  m.fetch.mockResolvedValue(custom);
  await refreshWebsiteDashboard("own-website","owner",selection,now);
  expect(m.upsert).toHaveBeenCalledWith(expect.objectContaining({where:{clientId_days:{clientId:"own-website",days:0}}}));
  expect(m.fetch).toHaveBeenCalledWith("fresh","552954256",selection,now);
});
it("does not reuse a recent custom result for another date range or bypass its cooldown", async () => {
  const selection={startIso:"2026-11-01",endIso:"2026-11-10"};
  const custom={...snapshot,days:10,rangeMode:"custom",currentPeriod:selection,previousPeriod:{startIso:"2026-10-22",endIso:"2026-10-31"}};
  m.upsert.mockResolvedValue({...record,dataJson:JSON.stringify(custom),lastAttemptAt:now});
  expect(await refreshWebsiteDashboard("own-website","owner",selection,now)).toEqual({cached:true});
  await expect(refreshWebsiteDashboard("own-website","owner",{...selection,endIso:"2026-11-11"},now)).rejects.toMatchObject({status:429});
  expect(m.fetch).not.toHaveBeenCalled();
});
