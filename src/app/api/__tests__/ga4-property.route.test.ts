import { beforeEach, it, expect, vi } from "vitest";
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    client: { findUnique: vi.fn(), update: vi.fn() },
    websiteDashboardSnapshot: { deleteMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/ga4-session", () => ({ getGa4AccessTokenForUser: vi.fn() }));
vi.mock("@/lib/ga4-api", () => ({
  listGa4Properties: vi.fn(),
  fetchGa4PropertyMetadata: vi.fn(),
}));
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGa4AccessTokenForUser } from "@/lib/ga4-session";
import { fetchGa4PropertyMetadata } from "@/lib/ga4-api";
import { PATCH, DELETE } from "../clients/[id]/ga4-property/route";
const params = { params: Promise.resolve({ id: "website" }) };
const request = (propertyId = "552954256") =>
  new Request("http://localhost/api/clients/website/ga4-property", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ propertyId, propertyName: "Client supplied label" }),
  });
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({ user: { id: "owner" } } as never);
  vi.mocked(prisma.client.findUnique).mockResolvedValue({
    userId: "owner",
    ga4PropertyId: "old",
  } as never);
  vi.mocked(getGa4AccessTokenForUser).mockResolvedValue("fresh");
  vi.mocked(fetchGa4PropertyMetadata).mockResolvedValue({
    propertyId: "552954256",
    displayName: "NextReport",
    timezone: "Asia/Kolkata",
    currency: "INR",
  });
  vi.mocked(prisma.$transaction).mockImplementation(
    async (fn: unknown) =>
      (fn as (db: typeof prisma) => unknown)(prisma) as never,
  );
  vi.mocked(prisma.client.update).mockResolvedValue({
    ga4PropertyId: "552954256",
    ga4PropertyName: "NextReport",
  } as never);
});
it("requires login and client ownership", async () => {
  vi.mocked(auth).mockResolvedValue(null as never);
  expect((await PATCH(request(), params)).status).toBe(401);
  vi.mocked(auth).mockResolvedValue({ user: { id: "intruder" } } as never);
  expect((await PATCH(request(), params)).status).toBe(404);
  expect(fetchGa4PropertyMetadata).not.toHaveBeenCalled();
});
it("rejects nonnumeric property IDs", async () => {
  expect((await PATCH(request("properties/123/other"), params)).status).toBe(
    400,
  );
  expect(fetchGa4PropertyMetadata).not.toHaveBeenCalled();
});
it("verifies access and uses the real GA4 property name", async () => {
  const result = await PATCH(request(), params);
  expect(result.status).toBe(200);
  expect(await result.json()).toEqual({
    propertyId: "552954256",
    propertyName: "NextReport",
  });
  expect(fetchGa4PropertyMetadata).toHaveBeenCalledWith("fresh", "552954256");
  expect(prisma.websiteDashboardSnapshot.deleteMany).toHaveBeenCalledWith({
    where: { clientId: "website" },
  });
});
it("will not link an inaccessible property", async () => {
  vi.mocked(fetchGa4PropertyMetadata).mockRejectedValue(
    Error("private provider error"),
  );
  expect((await PATCH(request(), params)).status).toBe(400);
  expect(prisma.client.update).not.toHaveBeenCalled();
});
it("requires a working GA4 grant", async () => {
  vi.mocked(getGa4AccessTokenForUser).mockResolvedValue(null);
  expect((await PATCH(request(), params)).status).toBe(400);
  expect(prisma.client.update).not.toHaveBeenCalled();
});
it("unlinks atomically and invalidates cached data", async () => {
  expect((await DELETE(request(), params)).status).toBe(200);
  expect(prisma.client.update).toHaveBeenCalledWith({
    where: { id: "website" },
    data: { ga4PropertyId: null, ga4PropertyName: null },
  });
  expect(prisma.websiteDashboardSnapshot.deleteMany).toHaveBeenCalledWith({
    where: { clientId: "website" },
  });
});
