import { beforeEach, it, expect, vi } from "vitest";
vi.mock("@vercel/blob", () => ({
  put: vi.fn(),
  del: vi.fn(),
  get: vi.fn(),
  issueSignedToken: vi.fn(),
  presignUrl: vi.fn(),
}));
import { put, del } from "@vercel/blob";
import { saveAgencyLogo } from "../storage";
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(put).mockImplementation(
    async (path) => ({ url: `https://private.example/${path}` }) as never,
  );
});
it("keeps same-format uploads and cross-format revisions immutable without deleting historical assets", async () => {
  const a = await saveAgencyLogo("owner", Buffer.from("first"), "png"),
    b = await saveAgencyLogo("owner", Buffer.from("second"), "png"),
    c = await saveAgencyLogo("owner", Buffer.from("third"), "svg");
  expect(new Set([a, b, c]).size).toBe(3);
  expect(a).toMatch(/logos\/agency-owner\/[a-f0-9-]+\.png$/);
  expect(c).toMatch(/\.svg$/);
  expect(del).not.toHaveBeenCalled();
  for (const call of vi.mocked(put).mock.calls)
    expect(call[2]).toMatchObject({
      access: "private",
      allowOverwrite: false,
      addRandomSuffix: false,
    });
});
