import { beforeEach, it, expect, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
const m = vi.hoisted(() => ({
  auth: vi.fn(),
  find: vi.fn(),
  owned: vi.fn(),
  upsert: vi.fn(),
  update: vi.fn(),
  clear: vi.fn(),
  user: vi.fn(),
  exchange: vi.fn(),
  email: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/prisma", () => {
  const prisma = {
    client: { findFirst: m.find, updateMany: m.owned, update: m.update },
    clientProviderConnection: { upsert: m.upsert },
    searchConsoleSnapshot: { deleteMany: m.clear },
    user: { update: m.user },
    $transaction: async (fn: (tx: unknown) => unknown) => fn(prisma),
  };
  return { prisma };
});
vi.mock("@/lib/search-console/api", () => ({
  GSC_STATE_COOKIE: "gsc-state",
  GSC_SCOPE: "webmasters-readonly",
  exchangeGscCode: m.exchange,
  gscEmail: m.email,
}));
import { GET } from "../gsc/callback/route";
import { POST as disconnect } from "../gsc/disconnect/route";
import {
  bindProviderOAuth,
  providerScopeCookie,
} from "@/lib/client-provider-oauth";
import {
  decryptMetaToken,
  isEncryptedMetaToken,
} from "@/lib/meta-token-storage";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("AUTH_SECRET", "gsc-oauth-test-key-at-least-32-characters");
  m.auth.mockResolvedValue({ user: { id: "owner" } });
  m.find.mockResolvedValue({ id: "client" });
  m.owned.mockResolvedValue({ count: 1 });
  m.exchange.mockResolvedValue({
    access_token: "private-access",
    refresh_token: "private-refresh",
    scope: "webmasters-readonly openid email",
  });
  m.email.mockResolvedValue("client@example.test");
});
async function req(client = "client", state = "nonce") {
  const response = await bindProviderOAuth(
    new NextRequest(
      `https://app.test/api/gsc/connect${client ? `?clientId=${client}` : ""}`,
    ),
    NextResponse.redirect("https://google.test"),
    "gsc",
    "owner",
    "nonce",
  );
  return new NextRequest(
    `https://app.test/api/gsc/callback?state=${state}&code=private-code`,
    {
      headers: {
        cookie: `gsc-state=nonce; gsc-state_pkce=owner:verifier; ${providerScopeCookie("gsc")}=${response.cookies.get(providerScopeCookie("gsc"))!.value}`,
      },
    },
  );
}
it("persists only the initiating client's encrypted Search Console grant and clears its site/cache", async () => {
  const response = await GET(await req());
  expect(new URL(response.headers.get("location")!).href).toBe(
    "https://app.test/clients/client?gsc_connected=1#search-console",
  );
  expect(m.user).not.toHaveBeenCalled();
  const record = m.upsert.mock.calls[0][0].create;
  expect(record.provider).toBe("gsc");
  const values = JSON.parse(decryptMetaToken(record.credentials));
  expect(isEncryptedMetaToken(values.gscRefreshToken)).toBe(true);
  expect(decryptMetaToken(values.gscRefreshToken)).toBe("private-refresh");
  expect(JSON.stringify(record)).not.toContain("private-access");
  expect(m.update).toHaveBeenCalledWith({
    where: { id: "client" },
    data: { gscSiteUrl: null },
  });
  expect(m.clear).toHaveBeenCalledWith({ where: { clientId: "client" } });
  expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
});
it("keeps the agency grant separate and invalidates only inherited assignments", async () => {
  await GET(await req(""));
  expect(m.upsert).not.toHaveBeenCalled();
  const data = m.user.mock.calls[0][0].data;
  expect(isEncryptedMetaToken(data.gscRefreshToken)).toBe(true);
  expect(m.owned).toHaveBeenCalledWith({
    where: {
      userId: "owner",
      providerConnections: { none: { provider: "gsc" } },
    },
    data: { gscSiteUrl: null },
  });
});
it("rejects a callback for another signed-in owner before exchanging the code", async () => {
  const request = await req();
  m.auth.mockResolvedValue({ user: { id: "other" } });
  await GET(request);
  expect(m.exchange).not.toHaveBeenCalled();
  expect(m.upsert).not.toHaveBeenCalled();
});
it("rejects state mismatch before any code exchange", async () => {
  await GET(await req("client", "wrong"));
  expect(m.exchange).not.toHaveBeenCalled();
  expect(m.user).not.toHaveBeenCalled();
});
it.each([
  { access_token: "a", scope: "webmasters-readonly" },
  { access_token: "a", refresh_token: "r", scope: "analytics.readonly" },
])("rejects missing refresh grants or declined permissions", async (tokens) => {
  m.exchange.mockResolvedValue(tokens);
  const response = await GET(await req());
  expect(response.headers.get("location")).toContain(
    "gsc_error=missing_permission",
  );
  expect(m.user).not.toHaveBeenCalled();
  expect(m.upsert).not.toHaveBeenCalled();
});
it("agency disconnect clears only inherited sites, without revoking other provider grants", async () => {
  expect((await disconnect()).status).toBe(200);
  expect(m.user).toHaveBeenCalledWith({
    where: { id: "owner" },
    data: { gscEnabled: false, gscRefreshToken: null, gscConnectedEmail: null },
  });
  expect(m.owned.mock.calls[0][0].where.providerConnections).toEqual({
    none: { provider: "gsc" },
  });
});
