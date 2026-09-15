import { beforeEach, describe, expect, it, vi } from "vitest";
import { jsonBody } from "@/test/api-route-harness";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    waitlistEntry: {
      upsert: vi.fn(),
    },
  },
}));

vi.mock("@/lib/inbound-notifications", () => ({
  sendInboundEmail: vi.fn(),
  autoReplyFireAndForget: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { autoReplyFireAndForget, sendInboundEmail } from "@/lib/inbound-notifications";
import { POST } from "../waitlist/route";

describe("POST /api/waitlist", () => {
  beforeEach(() => {
    vi.mocked(prisma.waitlistEntry.upsert).mockReset();
    vi.mocked(sendInboundEmail).mockReset();
    vi.mocked(autoReplyFireAndForget).mockReset();
    vi.mocked(prisma.waitlistEntry.upsert).mockResolvedValue({} as never);
    vi.mocked(sendInboundEmail).mockResolvedValue({ success: true });
  });

  it("returns 400 for invalid email", async () => {
    const res = await POST(
      new Request("http://localhost/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "not-an-email" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("accepts newsletter signups without auth", async () => {
    const res = await POST(
      new Request("http://localhost/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "visitor@example.com" }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await jsonBody<{ ok: boolean }>(res);
    expect(body.ok).toBe(true);
    expect(prisma.waitlistEntry.upsert).toHaveBeenCalled();
    expect(sendInboundEmail).toHaveBeenCalled();
    expect(autoReplyFireAndForget).toHaveBeenCalled();
  });
});
