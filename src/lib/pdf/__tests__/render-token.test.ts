import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { signPdfRenderToken, verifyPdfRenderToken } from "../render-token";

describe("pdf render token", () => {
  const originalSecret = process.env.AUTH_SECRET;

  beforeEach(() => {
    process.env.AUTH_SECRET = "test-pdf-secret";
    delete process.env.PDF_RENDER_SECRET;
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = originalSecret;
  });

  it("signs and verifies a share token", () => {
    const sig = signPdfRenderToken("abc123token");
    expect(verifyPdfRenderToken("abc123token", sig)).toBe(true);
    expect(verifyPdfRenderToken("abc123token", "bad-signature")).toBe(false);
    expect(verifyPdfRenderToken("other", sig)).toBe(false);
  });
});
