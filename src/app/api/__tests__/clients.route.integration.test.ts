import { beforeEach, describe, expect, it, vi } from "vitest";
import { jsonBody, mockSession, mockTrialUser } from "@/test/api-route-harness";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    client: {
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GET, POST } from "../clients/route";

describe("GET /api/clients", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    vi.mocked(prisma.client.findMany).mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("lists clients for the signed-in user", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession("user_1"));
    vi.mocked(prisma.client.findMany).mockResolvedValue([{ id: "c1", accountName: "Brand A" }] as never);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await jsonBody<{ clients: { id: string }[] }>(res);
    expect(body.clients).toHaveLength(1);
    expect(prisma.client.findMany).toHaveBeenCalledWith({
      where: { userId: "user_1" },
      orderBy: { createdAt: "desc" },
    });
  });
});

describe("POST /api/clients", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    vi.mocked(prisma.user.findUnique).mockReset();
    vi.mocked(prisma.client.count).mockReset();
    vi.mocked(prisma.client.create).mockReset();
    vi.mocked(prisma.user.update).mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await POST(new Request("http://localhost/api/clients", { method: "POST", body: "{}" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid body", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession("user_1"));
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockTrialUser() as never);
    vi.mocked(prisma.client.count).mockResolvedValue(0);

    const res = await POST(
      new Request("http://localhost/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountName: "" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("creates a client when subscription and capacity allow", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession("user_1"));
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockTrialUser() as never);
    vi.mocked(prisma.client.count).mockResolvedValue(0);
    vi.mocked(prisma.client.create).mockResolvedValue({
      id: "client_new",
      accountName: "Brand A",
      currency: "USD",
      timezone: "America/New_York",
      template: "DARK",
    } as never);
    vi.mocked(prisma.user.update).mockResolvedValue({} as never);

    const res = await POST(
      new Request("http://localhost/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountName: "Brand A",
          currency: "USD",
          timezone: "America/New_York",
          template: "DARK",
        }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await jsonBody<{ client: { id: string } }>(res);
    expect(body.client.id).toBe("client_new");
  });
});
