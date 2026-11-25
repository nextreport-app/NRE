import { beforeEach, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({
  auth: vi.fn(),
  user: vi.fn(),
  clients: vi.fn(),
  records: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: m.user },
    client: { findMany: m.clients },
    searchConsoleSnapshot: { findMany: m.records },
  },
}));
vi.mock("@/lib/search-console/service", () => ({
  gscConnectionKey: (token: string) => `hash-${token}`,
  refreshGscDashboard: m.refresh,
}));
import { GET } from "../search-console-overview/route";
import { POST } from "../clients/[id]/search-console/route";
beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ user: { id: "owner" } });
  m.user.mockResolvedValue({
    gscEnabled: true,
    gscRefreshToken: "private-token",
    gscConnectedEmail: "owner@example.test",
  });
  m.clients.mockResolvedValue([
    {
      id: "a",
      accountName: "Client A",
      userId: "owner",
      hasProviderConnections: false,
      gscSiteUrl: "sc-domain:example.com",
    },
  ]);
  m.records.mockResolvedValue([]);
  m.refresh.mockResolvedValue({ cached: false });
});
it("lists only the owner's clients and never returns tokens", async () => {
  const response = await GET(
    new Request("https://app.test/api/search-console-overview"),
  );
  const body = await response.json();
  expect(m.clients.mock.calls[0][0].where).toEqual({ userId: "owner" });
  expect(body.selectedClientId).toBeNull();
  expect(JSON.stringify(body)).not.toContain("private-token");
  expect(m.records).not.toHaveBeenCalled();
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});
it("reads snapshots bound to the selected site and exact credential", async () => {
  await GET(
    new Request("https://app.test/api/search-console-overview?clientId=a"),
  );
  expect(m.records).toHaveBeenCalledWith({
    where: {
      clientId: "a",
      siteUrl: "sc-domain:example.com",
      connectionKey: "hash-private-token",
    },
  });
});
it("does not default to the first client for an unknown requested id", async () => {
  const response = await GET(
    new Request(
      "https://app.test/api/search-console-overview?clientId=foreign",
    ),
  );
  expect(response.status).toBe(404);
  expect(m.records).not.toHaveBeenCalled();
});
it("requires authentication for both cached reads and refreshes", async () => {
  m.auth.mockResolvedValue(null);
  expect((await GET(new Request("https://app.test"))).status).toBe(401);
  expect(
    (
      await POST(
        new Request("https://app.test", {
          method: "POST",
          body: '{"days":30}',
        }),
        { params: Promise.resolve({ id: "a" }) },
      )
    ).status,
  ).toBe(401);
  expect(m.refresh).not.toHaveBeenCalled();
});
it.each([
  { days: 1 },
  { days: 30, siteUrl: "untrusted" },
  { customRange: { startIso: "2026-02-30", endIso: "2026-03-01" } },
  { customRange: { startIso: "2026-01-01", endIso: "2026-11-01" } },
])("rejects invalid refresh ranges without provider calls", async (body) => {
  const response = await POST(
    new Request("https://app.test", {
      method: "POST",
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: "a" }) },
  );
  expect(response.status).toBe(400);
  expect(m.refresh).not.toHaveBeenCalled();
});
it("passes the authenticated owner and validated period to refresh", async () => {
  const response = await POST(
    new Request("https://app.test", { method: "POST", body: '{"days":30}' }),
    { params: Promise.resolve({ id: "a" }) },
  );
  expect(response.status).toBe(200);
  expect(m.refresh).toHaveBeenCalledWith("owner", "a", 30);
});

it("preserves retry-after guidance on provider quota failures", async () => {
  const { ServiceError } = await import("@/lib/service-error");
  m.refresh.mockRejectedValue(
    new ServiceError("Search Console temporarily limited requests", 429, 300),
  );
  const response = await POST(
    new Request("https://app.test", { method: "POST", body: '{"days":30}' }),
    { params: Promise.resolve({ id: "a" }) },
  );
  expect(response.status).toBe(429);
  expect(response.headers.get("retry-after")).toBe("300");
});
