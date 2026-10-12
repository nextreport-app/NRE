import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { appBaseUrl } from "@/lib/pdf/app-base-url";

describe("password reset token hashing", () => {
  it("uses stable sha256 hex for lookup", () => {
    const token = "abc123";
    const hash = createHash("sha256").update(token).digest("hex");
    expect(hash).toHaveLength(64);
    expect(createHash("sha256").update(token).digest("hex")).toBe(hash);
  });
});

describe("password reset email origin", () => {
  it("uses production canonical URL when VERCEL_ENV is production", () => {
    const prev = { ...process.env };
    process.env.VERCEL_ENV = "production";
    process.env.VERCEL_URL = "nre-preview-branch.vercel.app";
    delete process.env.NEXTAUTH_URL;
    expect(appBaseUrl()).toBe("https://nextreport.in");
    process.env = prev;
  });
});
