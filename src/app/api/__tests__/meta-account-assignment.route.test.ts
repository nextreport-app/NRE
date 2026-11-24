import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  auth: vi.fn(),
  client: vi.fn(),
  user: vi.fn(),
  save: vi.fn(),
  updateUser: vi.fn(),
  token: vi.fn(),
  metadata: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    client: { findUnique: m.client, updateMany: m.save },
    user: { findUnique: m.user, update: m.updateUser },
  },
}));
vi.mock("@/lib/meta-api", () => ({
  ensureFreshMetaAccessToken: m.token,
  fetchMetaAdAccountMetadata: m.metadata,
}));
vi.mock("@/lib/meta-token-storage", () => ({
  decryptMetaToken: () => "token",
  encryptMetaToken: () => "encrypted",
}));
import { POST } from "../clients/[id]/meta-account/route";
const params = { params: Promise.resolve({ id: "client" }) };
const request = (body: object = { accountId: "act_123" }) =>
  new Request("https://test/api/clients/client/meta-account", {
    method: "POST",
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ user: { id: "owner" } });
  m.client.mockResolvedValue({
    userId: "owner",
    metaAdAccountId: null,
    currency: "USD",
    timezone: "UTC",
  });
  m.user.mockResolvedValue({
    metaAdsEnabled: true,
    metaAccessToken: "encrypted",
  });
  m.token.mockResolvedValue({ accessToken: "fresh", refreshed: false });
  m.metadata.mockResolvedValue({
    id: "act_123",
    name: "Verified Meta name",
    currency: "USD",
    timezone_name: "UTC",
  });
  m.save.mockResolvedValue({ count: 1 });
});
describe("explicit client ad account assignment", () => {
  it("verifies provider access and saves only the account binding without report import or monitoring changes", async () => {
    expect((await POST(request(), params)).status).toBe(200);
    expect(m.metadata).toHaveBeenCalledWith("fresh", "123");
    expect(m.save).toHaveBeenCalledWith({
      where: {
        id: "client",
        userId: "owner",
        metaAdAccountId: null,
        currency: "USD",
        timezone: "UTC",
      },
      data: { metaAdAccountId: "123", metaAdAccountName: "Verified Meta name" },
    });
  });
  it("requires authentication and ownership before contacting Meta", async () => {
    m.auth.mockResolvedValue(null);
    expect((await POST(request(), params)).status).toBe(401);
    m.auth.mockResolvedValue({ user: { id: "other" } });
    expect((await POST(request(), params)).status).toBe(404);
    expect(m.metadata).not.toHaveBeenCalled();
    expect(m.save).not.toHaveBeenCalled();
  });
  it("rejects invalid IDs and untrusted supplied names", async () => {
    expect((await POST(request({ accountId: "other" }), params)).status).toBe(
      400,
    );
    expect(
      (await POST(request({ accountId: "123", name: "Spoofed" }), params))
        .status,
    ).toBe(400);
    expect(m.save).not.toHaveBeenCalled();
  });
  it("does not substitute an existing client's different account", async () => {
    m.client.mockResolvedValue({ userId: "owner", metaAdAccountId: "456" });
    expect((await POST(request(), params)).status).toBe(409);
    expect(m.metadata).not.toHaveBeenCalled();
    expect(m.save).not.toHaveBeenCalled();
  });
  it("rejects disconnected or inaccessible accounts", async () => {
    m.user.mockResolvedValue({ metaAdsEnabled: false });
    expect((await POST(request(), params)).status).toBe(400);
    m.user.mockResolvedValue({
      metaAdsEnabled: true,
      metaAccessToken: "encrypted",
    });
    m.metadata.mockRejectedValue(new Error("Provider error"));
    expect((await POST(request(), params)).status).toBe(403);
    expect(m.save).not.toHaveBeenCalled();
  });
  it.each([
    { currency: "EUR", timezone_name: "UTC" },
    { currency: "USD", timezone_name: "America/Chicago" },
  ])(
    "does not silently change client currency/timezone %j",
    async (mismatch) => {
      m.metadata.mockResolvedValue({
        id: "act_123",
        name: "Account",
        ...mismatch,
      });
      expect((await POST(request(), params)).status).toBe(409);
      expect(m.save).not.toHaveBeenCalled();
    },
  );
  it("handles concurrent client changes without overwriting their account", async () => {
    m.save.mockResolvedValue({ count: 0 });
    expect((await POST(request(), params)).status).toBe(409);
  });
  it("is idempotent for the existing account and never changes saved notification preferences", async () => {
    m.client.mockResolvedValue({
      userId: "owner",
      metaAdAccountId: "123",
      currency: "USD",
      timezone: "UTC",
    });
    expect((await POST(request(), params)).status).toBe(200);
    expect(m.save).not.toHaveBeenCalled();
  });
});

it("assigns CAD Canada/Eastern to a CAD America/Toronto client without changing client settings", async () => {
  m.client.mockResolvedValue({ userId: "owner", metaAdAccountId: null, currency: "CAD", timezone: "America/Toronto" });
  m.metadata.mockResolvedValue({ id: "act_123", name: "Nope", currency: "CAD", timezone_name: "Canada/Eastern" });
  expect((await POST(request(), params)).status).toBe(200);
  expect(m.save).toHaveBeenCalledWith({ where: { id: "client", userId: "owner", metaAdAccountId: null, currency: "CAD", timezone: "America/Toronto" }, data: { metaAdAccountId: "123", metaAdAccountName: "Nope" } });
});
it("still rejects a different currency when timezones are aliases", async () => {
  m.client.mockResolvedValue({ userId: "owner", metaAdAccountId: null, currency: "USD", timezone: "America/Toronto" });
  m.metadata.mockResolvedValue({ id: "act_123", currency: "CAD", timezone_name: "Canada/Eastern" });
  const response = await POST(request(), params);
  expect(response.status).toBe(409);
  expect((await response.json()).error).toContain("this client is set to USD");
  expect(m.save).not.toHaveBeenCalled();
});
