import { beforeEach, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({
  client: vi.fn(),
  user: vi.fn(),
  scopes: vi.fn(),
  upsert: vi.fn(),
  update: vi.fn(),
  token: vi.fn(),
  query: vi.fn(),
  blocked: false,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    client: { findFirst: m.client },
    clientProviderConnection: { findMany: m.scopes },
    searchConsoleSnapshot: { upsert: m.upsert, updateMany: m.update },
  },
}));
vi.mock("@/lib/subscription", () => ({
  getSubscriptionStatus: () => ({ isBlocked: m.blocked }),
}));
vi.mock("../api", () => ({ refreshGscToken: m.token, queryGsc: m.query }));
import { encryptMetaToken } from "@/lib/meta-token-storage";
import {
  refreshGscDashboard,
  fetchGscSnapshot,
  gscConnectionKey,
} from "../service";
import { gscPeriods, parseGscSnapshot } from "../model";
const now = new Date("2026-11-25T12:00:00Z");
let token: string;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("AUTH_SECRET", "gsc-test-encryption-key-at-least-32-chars");
  token = encryptMetaToken("private-refresh");
  m.blocked = false;
  m.client.mockResolvedValue({
    id: "client",
    userId: "owner",
    gscSiteUrl: "sc-domain:example.com",
    hasProviderConnections: false,
    user: { gscEnabled: true, gscRefreshToken: token, emailVerified: now },
  });
  m.token.mockResolvedValue({ access_token: "access" });
  m.query.mockImplementation(async (_t, _s, _start, _end, dimensions) => [
    {
      clicks: 12,
      impressions: 120,
      ctr: 0.1,
      position: 3,
      ...(dimensions.length
        ? { keys: [dimensions[0] === "date" ? "2026-11-01" : "example"] }
        : {}),
    },
  ]);
  m.upsert.mockResolvedValue({
    id: "record",
    siteUrl: "sc-domain:example.com",
    connectionKey: gscConnectionKey(token),
    rangeKey: "30",
    lastAttemptAt: null,
    dataJson: null,
  });
  m.update.mockResolvedValue({ count: 1 });
});
it("fetches period totals and top breakdowns in bounded batches", async () => {
  let active = 0,
    peak = 0;
  const original = m.query.getMockImplementation()!;
  m.query.mockImplementation(async (...args) => {
    active++;
    peak = Math.max(active, peak);
    try {
      return await original(...args);
    } finally {
      active--;
    }
  });
  const data = await fetchGscSnapshot(
    "access",
    "sc-domain:example.com",
    30,
    now,
  );
  expect(data.current.clicks).toBe(12);
  expect(data.current.impressions).toBe(120);
  expect(data.queries).toHaveLength(1);
  expect(data.pages).toHaveLength(1);
  expect(data.countries).toHaveLength(1);
  expect(data.devices).toHaveLength(1);
  expect(m.query).toHaveBeenCalledTimes(7);
  expect(peak).toBeLessThanOrEqual(3);
  expect(
    parseGscSnapshot(JSON.stringify(data), "sc-domain:example.com"),
  ).not.toBeNull();
});
it("treats HTTP-success empty data as empty, with unavailable CTR/rank", async () => {
  m.query.mockResolvedValue([]);
  const data = await fetchGscSnapshot("t", "sc-domain:example.com", 7, now);
  expect(data.empty).toBe(true);
  expect(data.current).toEqual({
    clicks: 0,
    impressions: 0,
    ctr: null,
    position: null,
  });
});
it("does not contact Google for a foreign or missing client", async () => {
  m.client.mockResolvedValue(null);
  await expect(
    refreshGscDashboard("other", "client", 30, now),
  ).rejects.toMatchObject({ status: 404 });
  expect(m.client).toHaveBeenCalledWith({
    where: { id: "client", userId: "other" },
    include: { user: true },
  });
  expect(m.token).not.toHaveBeenCalled();
});
it("requires an active verified account before refreshing", async () => {
  m.blocked = true;
  await expect(
    refreshGscDashboard("owner", "client", 30, now),
  ).rejects.toMatchObject({ status: 403 });
  expect(m.token).not.toHaveBeenCalled();
});
it("writes only when the same site and inherited grant still belong to the owner", async () => {
  await refreshGscDashboard("owner", "client", 30, now);
  expect(m.token).toHaveBeenCalledWith("private-refresh");
  const write = m.update.mock.calls.find((args) => args[0].data.dataJson)![0];
  expect(write.where.client).toMatchObject({
    userId: "owner",
    gscSiteUrl: "sc-domain:example.com",
    user: { gscRefreshToken: token, gscEnabled: true },
    providerConnections: { none: { provider: "gsc" } },
  });
  expect(JSON.stringify(write.data)).not.toContain("private-refresh");
});
it("retains old data on failure without exposing raw provider details", async () => {
  m.query.mockRejectedValue(Error("secret provider body"));
  await expect(refreshGscDashboard("owner", "client", 30, now)).rejects.toThrow(
    "could not load this date range",
  );
  expect(m.update.mock.calls.at(-1)![0].data).toEqual({
    error: expect.stringContaining("saved figures"),
    leaseUntil: null,
  });
});
it("rejects stale writers and concurrent claims", async () => {
  m.update.mockResolvedValue({ count: 0 });
  await expect(
    refreshGscDashboard("owner", "client", 30, now),
  ).rejects.toMatchObject({ status: 429 });
  expect(m.token).not.toHaveBeenCalled();
});
it("refuses plaintext/corrupt grants instead of silently falling back", async () => {
  const client = await m.client();
  client.user.gscRefreshToken = "corrupt";
  await expect(refreshGscDashboard("owner", "client", 30, now)).rejects.toThrow(
    "Reconnect Search Console",
  );
  expect(m.query).not.toHaveBeenCalled();
});
it("binds scoped writes to the exact encrypted credential row", async () => {
  const client = await m.client();
  client.hasProviderConnections = true;
  m.scopes.mockResolvedValue([
    {
      id: "scoped",
      provider: "gsc",
      credentials: encryptMetaToken(
        JSON.stringify({
          gscEnabled: true,
          gscRefreshToken: encryptMetaToken("client-refresh"),
        }),
      ),
    },
  ]);
  await refreshGscDashboard("owner", "client", 30, now);
  const write = m.update.mock.calls.find((args) => args[0].data.dataJson)![0];
  expect(write.where.client.providerConnections.some).toMatchObject({
    id: "scoped",
    provider: "gsc",
  });
  expect(write.where.client.user).toBeUndefined();
  expect(m.token).toHaveBeenCalledWith("client-refresh");
});
it("preserves custom window identity", async () => {
  m.query.mockResolvedValue([]);
  const data = await fetchGscSnapshot(
    "a",
    "sc-domain:example.com",
    { startIso: "2026-10-01", endIso: "2026-10-07" },
    now,
  );
  expect(data.rangeKey).toBe("2026-10-01:2026-10-07");
  expect(data.previousPeriod).toEqual({
    startIso: "2026-09-24",
    endIso: "2026-09-30",
  });
  expect(gscPeriods(30, now).current.endIso).toBe("2026-11-22");
});

it("rejects an old writer when the linked site or credential was replaced mid-refresh", async () => {
  m.update.mockResolvedValueOnce({ count: 1 }).mockResolvedValue({ count: 0 });
  await expect(
    refreshGscDashboard("owner", "client", 30, now),
  ).rejects.toMatchObject({ status: 409 });
});
it("reuses a recent successful matching snapshot without new Google calls", async () => {
  const data = await fetchGscSnapshot("a", "sc-domain:example.com", 30, now);
  m.token.mockClear();
  m.query.mockClear();
  m.upsert.mockResolvedValue({
    id: "record",
    siteUrl: "sc-domain:example.com",
    connectionKey: gscConnectionKey(token),
    rangeKey: "30",
    lastAttemptAt: now,
    error: null,
    dataJson: JSON.stringify(data),
  });
  expect(await refreshGscDashboard("owner", "client", 30, now)).toEqual({
    cached: true,
  });
  expect(m.token).not.toHaveBeenCalled();
  expect(m.query).not.toHaveBeenCalled();
});
it("rejects duplicate daily rows rather than publishing a misleading chart", async () => {
  const original = m.query.getMockImplementation()!;
  m.query.mockImplementation(async (...args) => {
    const rows = await original(...args);
    return args[4][0] === "date" ? [...rows, ...rows] : rows;
  });
  await expect(
    fetchGscSnapshot("a", "sc-domain:example.com", 30, now),
  ).rejects.toThrow("duplicate");
});
