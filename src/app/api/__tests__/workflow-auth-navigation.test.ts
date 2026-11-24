import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("next-auth", () => ({
  default: () => ({ auth: (callback: unknown) => callback }),
}));
vi.mock("@/lib/auth.config", () => ({ default: {} }));
import proxy from "@/proxy";
import { safeAuthRedirect } from "@/lib/safe-auth-redirect";
const invoke = (path: string, signedIn = false) => {
  const req = new NextRequest(`https://nextreport.in${path}`);
  Object.defineProperty(req, "auth", {
    value: signedIn ? { user: { id: "owner" } } : null,
  });
  return (proxy as unknown as (r: NextRequest) => Response)(req);
};
describe("workflow entry and login context", () => {
  it.each([
    "/performance/meta-ads?client=express",
    "/performance/google-analytics?client=express",
    "/reports?tab=scheduled",
    "/clients?task=schedule",
    "/clients/express/reports/new?resumeReport=report",
  ])("preserves the full protected destination %s", (path) => {
    const location = new URL(invoke(path).headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("callbackUrl")).toBe(path);
  });
  it("uses My Clients by default and honors safe callback context for an existing login", () => {
    expect(
      new URL(invoke("/login", true).headers.get("location")!).pathname,
    ).toBe("/clients");
    const url = new URL(
      invoke(
        "/login?callbackUrl=%2Fperformance%2Fgoogle-analytics%3Fclient%3Dexpress",
        true,
      ).headers.get("location")!,
    );
    expect(url.pathname + url.search).toBe("/performance/google-analytics?client=express");
  });
  it.each([
    "//evil.test",
    "/\\evil.test",
    "/login",
    "/signup?callbackUrl=/login",
    "/clients/../login",
    "/%6cogin",
    "/%2F%2Fevil.test",
  ])("rejects unsafe or looping auth callbacks %s", (value) =>
    expect(safeAuthRedirect(value)).toBe("/clients"),
  );
  it("retains real unknown-page behavior and lets the layout/API enforce signed-in ownership", () => {
    expect(invoke("/a-missing-page").headers.get("x-middleware-next")).toBe(
      "1",
    );
    expect(
      invoke("/performance/meta-ads?client=express", true).headers.get("x-middleware-next"),
    ).toBe("1");
  });
});
