import { beforeEach, describe, expect, it, vi } from "vitest";
import { jsonBody, mockSession } from "@/test/api-route-harness";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GET, PATCH } from "../account/route";

describe("GET /api/account", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    vi.mocked(prisma.user.findUnique).mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns account settings for the signed-in user", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession("user_1"));
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      agencyName: "Acme Agency",
      googleDriveEnabled: false,
      googleConnectedEmail: null,
      reportRetentionDays: 30,
      planId: "trial",
      trialEndsAt: new Date("2026-09-22T00:00:00Z"),
      email: "trial@example.com",
    } as never);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await jsonBody<{ agencyName: string; reportRetentionDays: number; reportRetentionOptions: number[] }>(res);
    expect(body.agencyName).toBe("Acme Agency");
    expect(body.reportRetentionDays).toBe(30);
    expect(body.reportRetentionOptions).toEqual([7, 14, 30]);
  });
});

describe("PATCH /api/account", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    vi.mocked(prisma.user.findUnique).mockReset();
    vi.mocked(prisma.user.update).mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await PATCH(new Request("http://localhost/api/account", { method: "PATCH", body: "{}" }));
    expect(res.status).toBe(401);
  });

  it("rejects retention days above plan cap", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession("user_1"));
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      planId: "trial",
      trialEndsAt: new Date("2026-09-22T00:00:00Z"),
      email: "trial@example.com",
    } as never);

    const res = await PATCH(
      new Request("http://localhost/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportRetentionDays: 90 }),
      }),
    );
    expect(res.status).toBe(400);
    const body = await jsonBody<{ error: string }>(res);
    expect(body.error).toMatch(/plan allows report retention/i);
  });

  it("updates allowed settings", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession("user_1"));
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      planId: "professional",
      trialEndsAt: new Date("2026-09-22T00:00:00Z"),
      email: "pro@example.com",
    } as never);
    vi.mocked(prisma.user.update).mockResolvedValue({} as never);

    const res = await PATCH(
      new Request("http://localhost/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agencyName: "New Agency", reportRetentionDays: 60 }),
      }),
    );
    expect(res.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: { agencyName: "New Agency", reportRetentionDays: 60 },
    });
  });
});
