import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
vi.mock("@/lib/prisma", () => ({
  prisma: {
    client: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    clientProviderConnection: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      updateMany: vi.fn(),
    },
    websiteDashboardSnapshot: { deleteMany: vi.fn() },
    searchConsoleSnapshot: { deleteMany: vi.fn() },
    user: { update: vi.fn() },
    $transaction: vi.fn(),
  },
}));
import { prisma } from "@/lib/prisma";
import { encryptMetaToken, decryptMetaToken } from "@/lib/meta-token-storage";
import {
  resolveClientUser,
  resolveClientUserById,
  updateResolvedProviderUser,
  saveClientProvider,
  clientProviderSummaries,
  clientProviderWriteWhere,
  providerKeys,
} from "../client-provider-connections";
import {
  bindProviderOAuth,
  providerScopeCookie,
  persistOAuthProvider,
  providerOAuthReturn,
} from "../client-provider-oauth";
const owner = {
  id: "owner",
  ga4Enabled: true,
  ga4RefreshToken: "agency-ga4",
  googleRefreshToken: "agency-drive",
  metaAdsEnabled: true,
  metaAccessToken: "agency-meta",
};
const client = {
  id: "client-a",
  userId: "owner",
  hasProviderConnections: true,
};
const credentials = {
  ga4Enabled: true,
  ga4RefreshToken: "private-ga4",
  ga4ConnectedEmail: "client@example.test",
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("AUTH_SECRET", "client-provider-test-key-at-least-32-characters");
  vi.mocked(prisma.clientProviderConnection.findMany).mockResolvedValue([]);
  vi.mocked(prisma.client.findFirst).mockResolvedValue(client as never);
  vi.mocked(prisma.client.findUnique).mockResolvedValue(client as never);
  vi.mocked(prisma.client.updateMany).mockResolvedValue({ count: 1 });
  vi.mocked(prisma.clientProviderConnection.updateMany).mockResolvedValue({
    count: 1,
  });
  vi.mocked(prisma.$transaction).mockImplementation(
    async (fn: unknown) =>
      (fn as (tx: typeof prisma) => unknown)(prisma) as never,
  );
});
const row = (provider: string, values: object) => ({
  id: "row-" + provider,
  clientId: client.id,
  provider,
  credentials: encryptMetaToken(JSON.stringify(values)),
});
describe("isolated provider credentials", () => {
  it("keeps already linked clients on existing agency grants without querying overrides", async () => {
    expect(
      await resolveClientUser(owner, {
        ...client,
        hasProviderConnections: false,
        ga4PropertyId: "12345",
      }),
    ).toMatchObject(owner);
    expect(prisma.clientProviderConnection.findMany).not.toHaveBeenCalled();
  });
  it("does not inherit analytics or Search Console identity for an unconfigured client", async () => {
    const agency = {...owner,ga4ConnectedEmail:"agency@example.test",gscEnabled:true,gscRefreshToken:"agency-gsc",gscConnectedEmail:"agency@example.test"};
    const fresh = {...client,hasProviderConnections:false,ga4PropertyId:null,gscSiteUrl:null};
    const effective = await resolveClientUser(agency,fresh);
    expect(effective).toMatchObject({ga4Enabled:false,ga4RefreshToken:null,ga4ConnectedEmail:null,gscEnabled:false,gscRefreshToken:null,gscConnectedEmail:null,metaAccessToken:"agency-meta"});
    const summaries = await clientProviderSummaries(agency,fresh);
    expect(summaries.filter(s=>s.provider==="ga4"||s.provider==="gsc")).toEqual([
      expect.objectContaining({provider:"ga4",connected:false,label:null}),
      expect.objectContaining({provider:"gsc",connected:false,label:null}),
    ]);
    expect(agency.ga4RefreshToken).toBe("agency-ga4");
  });
  it("keeps an existing Search Console site working without implicitly connecting GA4", async () => {
    const effective = await resolveClientUser({...owner,gscEnabled:true,gscRefreshToken:"agency-gsc"},{...client,hasProviderConnections:false,gscSiteUrl:"sc-domain:client.test"});
    expect(effective.gscRefreshToken).toBe("agency-gsc");
    expect(effective.ga4RefreshToken).toBeNull();
  });
  it("does not expose one client's scoped login in a different client's setup", async () => {
    vi.mocked(prisma.clientProviderConnection.findMany).mockResolvedValueOnce([row("ga4",credentials)] as never).mockResolvedValueOnce([]);
    expect((await resolveClientUser(owner,client)).ga4RefreshToken).toBe("private-ga4");
    expect((await resolveClientUser(owner,{...client,id:"client-b"})).ga4RefreshToken).toBeNull();
  });
  it("loads the client's saved resource bindings before resolving API access by ID", async () => {
    vi.mocked(prisma.client.findUnique).mockResolvedValue({...client,hasProviderConnections:false,ga4PropertyId:null,gscSiteUrl:null} as never);
    expect((await resolveClientUserById(owner,"owner","client-a")).ga4RefreshToken).toBeNull();
    expect(prisma.client.findUnique).toHaveBeenCalledWith({where:{id:"client-a"},select:{id:true,userId:true,hasProviderConnections:true,ga4PropertyId:true,gscSiteUrl:true}});
    vi.mocked(prisma.client.findUnique).mockResolvedValue({...client,hasProviderConnections:false,ga4PropertyId:"12345"} as never);
    expect((await resolveClientUserById(owner,"owner","client-a")).ga4RefreshToken).toBe("agency-ga4");
  });
  it.each([
    ["meta", "metaAccessToken"], ["google-drive", "googleRefreshToken"],
    ["google-ads", "googleAdsRefreshToken"], ["tiktok", "tiktokAccessToken"],
  ] as const)("keeps two clients' %s profiles and writes separate", async (provider,key) => {
    const shared: typeof owner & Record<string, unknown> = {...owner,[key]:"default-token"};
    const a=row(provider,{[key]:"client-a-token"}), b={...row(provider,{[key]:"client-b-token"}),id:"other-row",clientId:"client-b"};
    vi.mocked(prisma.clientProviderConnection.findMany).mockResolvedValueOnce([a] as never).mockResolvedValueOnce([b] as never);
    const first=await resolveClientUser(shared,client), second=await resolveClientUser(shared,{...client,id:"client-b"});
    expect(first[key]).toBe("client-a-token"); expect(second[key]).toBe("client-b-token"); expect(shared[key]).toBe("default-token");
    expect(clientProviderWriteWhere(first,provider)).toEqual({providerConnections:{some:{id:a.id,credentials:a.credentials,provider}}});
    expect(clientProviderWriteWhere(second,provider)).toEqual({providerConnections:{some:{id:b.id,credentials:b.credentials,provider}}});
    await updateResolvedProviderUser({where:{id:"owner"},data:{[key]:"refreshed-a"}},first);
    expect(prisma.clientProviderConnection.updateMany).toHaveBeenCalledWith(expect.objectContaining({where:{id:a.id,credentials:a.credentials,client:{userId:"owner"}}}));
    expect(second[key]).toBe("client-b-token"); expect(prisma.user.update).not.toHaveBeenCalled();
  });
  it("overrides only this client's chosen provider and never mutates shared credentials", async () => {
    vi.mocked(prisma.clientProviderConnection.findMany).mockResolvedValue([
      row("ga4", credentials),
    ] as never);
    const effective = await resolveClientUser(owner, client);
    expect(effective.ga4RefreshToken).toBe("private-ga4");
    expect(effective.metaAccessToken).toBe("agency-meta");
    expect(owner.ga4RefreshToken).toBe("agency-ga4");
    expect(prisma.clientProviderConnection.findMany).toHaveBeenCalledWith({
      where: { clientId: "client-a", client: { userId: "owner" } },
    });
    const publicStatus = JSON.stringify(
      await clientProviderSummaries(owner, client),
    );
    expect(publicStatus).toContain("client@example.test");
    expect(publicStatus).not.toContain("private-ga4");
    expect(publicStatus).not.toContain("agency-ga4");
  });
  it("scopes fresh-token persistence and fails closed when a connection changes", async () => {
    const record = row("ga4", credentials);
    vi.mocked(prisma.clientProviderConnection.findMany).mockResolvedValue([
      record,
    ] as never);
    const effective = await resolveClientUser(owner, client);
    await updateResolvedProviderUser(
      { where: { id: "owner" }, data: { ga4AccessToken: "fresh-private" } },
      effective,
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
    const saved = vi.mocked(prisma.clientProviderConnection.updateMany).mock
      .calls[0][0];
    expect(saved.where).toEqual({
      id: "row-ga4",
      credentials: record.credentials,
      client: { userId: "owner" },
    });
    expect(decryptMetaToken(saved.data!.credentials as string)).toContain(
      "fresh-private",
    );
    vi.mocked(prisma.clientProviderConnection.updateMany).mockResolvedValue({
      count: 0,
    });
    await expect(
      updateResolvedProviderUser(
        { where: { id: "owner" }, data: { ga4AccessToken: "stale" } },
        effective,
      ),
    ).rejects.toThrow("connection changed");
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
  it("rejects a client owned by another user before reading any credentials", async () => {
    vi.mocked(prisma.client.findUnique).mockResolvedValue({
      ...client,
      userId: "other",
    } as never);
    await expect(
      resolveClientUserById(owner, "owner", "client-a"),
    ).rejects.toThrow("Not found");
    expect(prisma.clientProviderConnection.findMany).not.toHaveBeenCalled();
  });
  it("will not fall back to the agency login when stored credentials are corrupt", async () => {
    vi.mocked(prisma.clientProviderConnection.findMany).mockResolvedValue([
      { ...row("ga4", credentials), credentials: "broken" },
    ] as never);
    expect((await resolveClientUser(owner, client)).ga4RefreshToken).toBeNull();
  });
  it("encrypts scoped grants and clears the affected saved asset inside one ownership-checked transaction", async () => {
    await saveClientProvider("owner", "client-a", "ga4", credentials);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.client.updateMany).toHaveBeenCalledWith({
      where: { id: "client-a", userId: "owner" },
      data: { hasProviderConnections: true },
    });
    const input = vi.mocked(prisma.clientProviderConnection.upsert).mock
      .calls[0][0];
    expect(input.create.credentials).not.toContain("private-ga4");
    expect(JSON.parse(decryptMetaToken(input.create.credentials))).toEqual(
      credentials,
    );
    expect(prisma.websiteDashboardSnapshot.deleteMany).toHaveBeenCalledWith({
      where: { clientId: "client-a" },
    });
  });
});
describe("provider OAuth scope", () => {
  it.each(providerKeys)(
    "binds %s to the initiating owner, client and OAuth state",
    async (provider) => {
      const start = new NextRequest(
        `https://nextreport.test/api/${provider}/connect?clientId=client-a`,
      );
      const response = await bindProviderOAuth(
        start,
        NextResponse.redirect("https://provider.test"),
        provider,
        "owner",
        "state-a",
      );
      const cookie = response.cookies.get(providerScopeCookie(provider))!.value;
      const request = (state = "state-a") =>
        new NextRequest(
          `https://nextreport.test/api/${provider}/callback?state=${state}`,
          { headers: { cookie: `${providerScopeCookie(provider)}=${cookie}` } },
        );
      expect(cookie).not.toContain("client-a");
      const field =
        provider === "gsc" ? {gscEnabled: true, gscRefreshToken: "private"} : provider === "ga4"
          ? { ga4Enabled: true, ga4RefreshToken: "private" }
          : provider === "meta"
            ? { metaAdsEnabled: true, metaAccessToken: "private" }
            : provider === "google-ads"
              ? { googleAdsRefreshToken: "private" }
              : provider === "tiktok"
                ? { tiktokAccessToken: "private" }
                : { googleRefreshToken: "private" };
      await persistOAuthProvider(request(), provider, "owner", field);
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(prisma.clientProviderConnection.upsert).toHaveBeenCalledOnce();
      await expect(
        persistOAuthProvider(request("wrong"), provider, "owner", field),
      ).rejects.toThrow("Invalid or expired");
      await expect(
        persistOAuthProvider(request(), provider, "other", field),
      ).rejects.toThrow("Invalid or expired");
      const returnUrl = providerOAuthReturn(
        request(),
        provider,
        "?connected=1",
      );
      expect(returnUrl.pathname).toBe("/clients/client-a");
      expect(returnUrl.search).toBe("?connected=1");
    },
  );
  it("rejects connection attempts for a foreign client without issuing cookies", async () => {
    vi.mocked(prisma.client.findFirst).mockResolvedValue(null);
    const res = await bindProviderOAuth(
      new NextRequest("https://test/api/ga4/connect?clientId=foreign"),
      NextResponse.redirect("https://provider.test"),
      "ga4",
      "owner",
      "state",
    );
    expect(res.status).toBe(404);
    expect(res.headers.get("set-cookie")).toBeNull();
  });
  it("does not silently turn a missing scoped callback into an agency-wide update", async () => {
    await expect(
      persistOAuthProvider(
        new NextRequest("https://test/api/ga4/callback?state=state"),
        "ga4",
        "owner",
        credentials,
      ),
    ).rejects.toThrow("Invalid or expired");
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
