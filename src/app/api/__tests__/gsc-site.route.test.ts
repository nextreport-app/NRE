import { beforeEach, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({
  auth: vi.fn(),
  context: vi.fn(),
  access: vi.fn(),
  sites: vi.fn(),
  update: vi.fn(),
  clear: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/search-console/service", () => ({
  gscContext: m.context,
  gscAccess: m.access,
  gscGrantWhere: () => ({
    userId: "owner",
    providerConnections: { none: { provider: "gsc" } },
  }),
}));
vi.mock("@/lib/search-console/api", async () => ({
  ...(await vi.importActual<object>("@/lib/search-console/api")),
  listGscSites: m.sites,
}));
vi.mock("@/lib/prisma", () => {
  const tx = {
    client: { updateMany: m.update },
    searchConsoleSnapshot: { deleteMany: m.clear },
  };
  return {
    prisma: { $transaction: async (fn: (tx: unknown) => unknown) => fn(tx) },
  };
});
import { PATCH, GET, DELETE } from "../clients/[id]/gsc-site/route";
import { ServiceError } from "@/lib/service-error";
const params = { params: Promise.resolve({ id: "client" }) };
const request = (siteUrl = "sc-domain:example.com") =>
  new Request("https://app.test/api/clients/client/gsc-site", {
    method: "PATCH",
    body: JSON.stringify({ siteUrl }),
  });
beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ user: { id: "owner" } });
  m.context.mockResolvedValue({
    client: { gscSiteUrl: "sc-domain:example.com" },
    user: {},
  });
  m.access.mockResolvedValue("private-access");
  m.sites.mockResolvedValue([
    { siteUrl: "sc-domain:example.com", permissionLevel: "siteOwner" },
  ]);
  m.update.mockResolvedValue({ count: 1 });
});
it("lists sites without returning credentials", async () => {
  const response = await GET(new Request("https://app.test"), params);
  const body = await response.json();
  expect(body.siteUrl).toBe("sc-domain:example.com");
  expect(JSON.stringify(body)).not.toContain("private-access");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});
it("saves an accessible exact property and invalidates cached queries atomically", async () => {
  expect((await PATCH(request(), params)).status).toBe(200);
  expect(m.update).toHaveBeenCalledWith({
    where: {
      id: "client",
      userId: "owner",
      providerConnections: { none: { provider: "gsc" } },
    },
    data: { gscSiteUrl: "sc-domain:example.com" },
  });
  expect(m.clear).toHaveBeenCalledWith({ where: { clientId: "client" } });
});
it("does not accept an unlisted domain or URL-prefix variant", async () => {
  expect((await PATCH(request("https://example.com/"), params)).status).toBe(
    403,
  );
  expect(m.update).not.toHaveBeenCalled();
});
it("rejects site changes when the grant changed during selection", async () => {
  m.update.mockResolvedValue({ count: 0 });
  expect((await PATCH(request(), params)).status).toBe(409);
  expect(m.clear).not.toHaveBeenCalled();
});
it("checks ownership before querying Google", async () => {
  m.context.mockRejectedValue(new ServiceError("Not found", 404));
  expect((await GET(new Request("https://app.test"), params)).status).toBe(404);
  expect(m.access).not.toHaveBeenCalled();
  expect(m.sites).not.toHaveBeenCalled();
});
it("unlinks even when Google authorization has expired", async () => {
  m.access.mockRejectedValue(Error("expired"));
  expect((await DELETE(new Request("https://app.test"), params)).status).toBe(
    200,
  );
  expect(m.access).not.toHaveBeenCalled();
  expect(m.clear).toHaveBeenCalled();
});
it("rejects signed-out writes and malformed site names", async () => {
  m.auth.mockResolvedValue(null);
  expect((await PATCH(request(), params)).status).toBe(401);
  m.auth.mockResolvedValue({ user: { id: "owner" } });
  expect((await PATCH(request("javascript:alert(1)"), params)).status).toBe(
    400,
  );
  expect(m.sites).not.toHaveBeenCalled();
});
