import { beforeEach, it, expect, vi } from "vitest";
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    client: { findMany: vi.fn() },
    websiteDashboardSnapshot: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/website-dashboard/service", () => ({
  refreshWebsiteDashboard: vi.fn(),
  websiteConnectionKey: () => "key",
}));
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { refreshWebsiteDashboard } from "@/lib/website-dashboard/service";
import { GET } from "../website-overview/route";
import { POST } from "../clients/[id]/website-overview/route";
const params = { params: Promise.resolve({ id: "website" }) };
const request = (days: unknown) =>
  new Request("http://localhost/api/clients/website/website-overview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ days }),
  });
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({ user: { id: "owner" } } as never);
  vi.mocked(prisma.user.findUnique).mockResolvedValue({
    ga4Enabled: true,
    ga4RefreshToken: "secret",
    ga4ConnectedEmail: "owner@example.com",
  } as never);
  vi.mocked(prisma.client.findMany).mockResolvedValue([
    { id: "website", accountName: "NextReport", ga4PropertyId: "552954256" },
  ] as never);
  vi.mocked(prisma.websiteDashboardSnapshot.findMany).mockResolvedValue([]);
});
it("requires login for cached data and refreshes", async () => {
  vi.mocked(auth).mockResolvedValue(null as never);
  expect(
    (await GET(new Request("http://localhost/api/website-overview"))).status,
  ).toBe(401);
  expect((await POST(request(7), params)).status).toBe(401);
  expect(refreshWebsiteDashboard).not.toHaveBeenCalled();
});
it("never calls a provider during cached overview load", async () => {
  const response = await GET(
    new Request("http://localhost/api/website-overview"),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(prisma.client.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: { userId: "owner" } }),
  );
  expect(refreshWebsiteDashboard).not.toHaveBeenCalled();
  expect(JSON.stringify(await response.json())).not.toContain("secret");
});
it("rejects another client's ID without exposing its cache", async () => {
  expect(
    (
      await GET(
        new Request("http://localhost/api/website-overview?clientId=express"),
      )
    ).status,
  ).toBe(404);
  expect(prisma.websiteDashboardSnapshot.findMany).not.toHaveBeenCalled();
});
it("hides cached data after disconnect", async () => {
  vi.mocked(prisma.user.findUnique).mockResolvedValue({
    ga4Enabled: false,
    ga4RefreshToken: null,
  } as never);
  const json = await (
    await GET(new Request("http://localhost/api/website-overview"))
  ).json();
  expect(json.connected).toBe(false);
  expect(json.snapshots).toEqual([]);
  expect(prisma.websiteDashboardSnapshot.findMany).not.toHaveBeenCalled();
});
it("rejects unsupported dates and delegates the owned-client refresh", async () => {
  expect((await POST(request(15), params)).status).toBe(400);
  vi.mocked(refreshWebsiteDashboard).mockResolvedValue({ cached: false });
  expect((await POST(request(30), params)).status).toBe(200);
  expect(refreshWebsiteDashboard).toHaveBeenCalledWith("website", "owner", 30);
});

it("validates and passes custom dates without accepting an arbitrary cache key", async () => {
  const customRange={startIso:"2026-11-01",endIso:"2026-11-10"};
  const customRequest=(range:unknown)=>new Request("http://localhost/api/clients/website/website-overview",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({customRange:range})});
  expect((await POST(customRequest(customRange),params)).status).toBe(200);
  expect(refreshWebsiteDashboard).toHaveBeenCalledWith("website","owner",customRange);
  expect((await POST(customRequest({...customRange,startIso:"2026-02-30"}),params)).status).toBe(400);
  expect((await POST(request(0),params)).status).toBe(400);
});

it("opens the portfolio without implicitly selecting a linked client", async () => {
  const json = await (await GET(new Request("http://localhost/api/website-overview"))).json();
  expect(json.selectedClientId).toBeNull();
  expect(json.clients).toEqual([expect.objectContaining({id: "website", propertyId: "552954256"})]);
  expect(json.snapshots).toEqual([]);
  expect(prisma.websiteDashboardSnapshot.findMany).not.toHaveBeenCalled();
});
it("loads cached snapshots only for an explicitly selected owned client", async () => {
  const json = await (await GET(new Request("http://localhost/api/website-overview?clientId=website"))).json();
  expect(json.selectedClientId).toBe("website");
  expect(prisma.websiteDashboardSnapshot.findMany).toHaveBeenCalledWith({where: {clientId: "website", propertyId: "552954256", connectionKey: "key"}});
  expect(refreshWebsiteDashboard).not.toHaveBeenCalled();
});
