import { describe, expect, it } from "vitest";
import { normalizeAuthEmail } from "@/lib/normalize-auth-email";

describe("normalizeAuthEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeAuthEmail("  Ayuh@Gmail.COM  ")).toBe("ayuh@gmail.com");
  });
});
