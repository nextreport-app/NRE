import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/tiktok-api", () => ({
  buildTikTokConnectUrl: vi.fn(() => "https://example.test/authorize"),
  isTikTokOAuthConfigured: vi.fn(() => true),
  TIKTOK_OAUTH_STATE_COOKIE: "test_tiktok_state",
}));
import { auth } from "@/lib/auth";
import { buildTikTokConnectUrl } from "@/lib/tiktok-api";
import { GET } from "../tiktok/connect/route";

beforeEach(() => { vi.clearAllMocks(); vi.mocked(auth).mockResolvedValue({ user: { id: "test" } } as never); });
describe("TikTok connect regional availability", () => {
  it("redirects an unauthenticated visitor to login", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const response = await GET(new NextRequest("https://example.test/api/tiktok/connect"));
    expect(response.headers.get("location")).toBe("https://example.test/login");
  });
  it("blocks India before creating an OAuth grant or state cookie", async () => {
    const response = await GET(new NextRequest("https://example.test/api/tiktok/connect", { headers: { "x-vercel-ip-country": "IN" } }));
    expect(response.headers.get("location")).toContain("region_unavailable");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(buildTikTokConnectUrl).not.toHaveBeenCalled();
  });
  it.each(["US", "GB", null])("preserves OAuth for a configured non-India/unknown location (%s)", async country => {
    const response = await GET(new NextRequest("https://example.test/api/tiktok/connect", { headers: country ? { "x-vercel-ip-country": country } : {} }));
    expect(response.headers.get("location")).toBe("https://example.test/authorize");
    expect(response.headers.get("set-cookie")).toContain("test_tiktok_state=");
    expect(buildTikTokConnectUrl).toHaveBeenCalledOnce();
  });
});
