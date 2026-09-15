import { beforeEach, describe, expect, it, vi } from "vitest";
import { jsonBody, mockSession } from "@/test/api-route-harness";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      update: vi.fn(),
    },
  },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { POST } from "../account/onboarding/route";

describe("POST /api/account/onboarding", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    vi.mocked(prisma.user.update).mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it("sets onboardingDismissedAt for the signed-in user", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession("user_1"));
    vi.mocked(prisma.user.update).mockResolvedValue({} as never);

    const res = await POST();
    expect(res.status).toBe(200);
    const body = await jsonBody<{ ok: boolean }>(res);
    expect(body.ok).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: { onboardingDismissedAt: expect.any(Date) },
    });
  });
});
