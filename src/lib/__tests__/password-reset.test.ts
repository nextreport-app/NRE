import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

describe("password reset token hashing", () => {
  it("uses stable sha256 hex for lookup", () => {
    const token = "abc123";
    const hash = createHash("sha256").update(token).digest("hex");
    expect(hash).toHaveLength(64);
    expect(createHash("sha256").update(token).digest("hex")).toBe(hash);
  });
});
