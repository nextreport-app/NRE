import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/find-user-by-email", () => ({
  findUserByEmail: vi.fn(),
}));

import { findUserByEmail } from "@/lib/find-user-by-email";
import { POST } from "@/app/api/auth/account-login-hint/route";

describe("POST /api/auth/account-login-hint", () => {
  beforeEach(() => {
    vi.mocked(findUserByEmail).mockReset();
  });

  it("returns oauth_only when user exists without passwordHash", async () => {
    vi.mocked(findUserByEmail).mockResolvedValue({
      id: "u1",
      passwordHash: null,
    } as Awaited<ReturnType<typeof findUserByEmail>>);

    const res = await POST(
      new Request("http://localhost/api/auth/account-login-hint", {
        method: "POST",
        body: JSON.stringify({ email: "founder@gmail.com" }),
      }),
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ hint: "oauth_only" });
  });

  it("returns credentials when user has a password", async () => {
    vi.mocked(findUserByEmail).mockResolvedValue({
      id: "u1",
      passwordHash: "hash",
    } as Awaited<ReturnType<typeof findUserByEmail>>);

    const res = await POST(
      new Request("http://localhost/api/auth/account-login-hint", {
        method: "POST",
        body: JSON.stringify({ email: "user@example.com" }),
      }),
    );
    await expect(res.json()).resolves.toEqual({ hint: "credentials" });
  });
});
