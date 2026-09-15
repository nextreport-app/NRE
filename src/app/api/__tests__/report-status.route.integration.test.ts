import { beforeEach, describe, expect, it, vi } from "vitest";
import { jsonBody, mockSession, routeParams } from "@/test/api-route-harness";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    report: {
      findUnique: vi.fn(),
    },
  },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GET } from "../reports/[id]/status/route";

describe("GET /api/reports/[id]/status", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    vi.mocked(prisma.report.findUnique).mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/reports/r1/status"), routeParams({ id: "r1" }));
    expect(res.status).toBe(401);
  });

  it("returns 404 when report belongs to another user", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession("user_1"));
    vi.mocked(prisma.report.findUnique).mockResolvedValue({
      status: "GENERATING",
      shareToken: "tok",
      errorMessage: null,
      client: { userId: "other_user" },
    } as never);

    const res = await GET(new Request("http://localhost/api/reports/r1/status"), routeParams({ id: "r1" }));
    expect(res.status).toBe(404);
  });

  it("returns poll payload for GENERATING reports without share token", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession("user_1"));
    vi.mocked(prisma.report.findUnique).mockResolvedValue({
      status: "GENERATING",
      shareToken: "tok",
      errorMessage: null,
      client: { userId: "user_1" },
    } as never);

    const res = await GET(new Request("http://localhost/api/reports/r1/status"), routeParams({ id: "r1" }));
    expect(res.status).toBe(200);
    const body = await jsonBody<{ status: string; shareToken: string | null; errorMessage: string | null }>(res);
    expect(body.status).toBe("GENERATING");
    expect(body.shareToken).toBeNull();
    expect(body.errorMessage).toBeNull();
  });

  it("returns share token when generation completes", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession("user_1"));
    vi.mocked(prisma.report.findUnique).mockResolvedValue({
      status: "COMPLETE",
      shareToken: "abc123",
      errorMessage: null,
      client: { userId: "user_1" },
    } as never);

    const res = await GET(new Request("http://localhost/api/reports/r1/status"), routeParams({ id: "r1" }));
    const body = await jsonBody<{ status: string; shareToken: string | null }>(res);
    expect(body.status).toBe("COMPLETE");
    expect(body.shareToken).toBe("abc123");
  });

  it("returns error message when generation fails", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession("user_1"));
    vi.mocked(prisma.report.findUnique).mockResolvedValue({
      status: "FAILED",
      shareToken: null,
      errorMessage: "Render timeout",
      client: { userId: "user_1" },
    } as never);

    const res = await GET(new Request("http://localhost/api/reports/r1/status"), routeParams({ id: "r1" }));
    const body = await jsonBody<{ status: string; errorMessage: string | null }>(res);
    expect(body.status).toBe("FAILED");
    expect(body.errorMessage).toBe("Render timeout");
  });
});
