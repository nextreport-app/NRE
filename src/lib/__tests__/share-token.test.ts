import { describe, it, expect } from "vitest";
import { generateShareToken } from "../share-token";

describe("generateShareToken", () => {
  it("returns a 12-character string", () => {
    expect(generateShareToken()).toHaveLength(12);
  });

  it("only ever uses alphanumeric characters", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateShareToken()).toMatch(/^[A-Za-z0-9]{12}$/);
    }
  });

  it("is not deterministic across calls", () => {
    const tokens = new Set(Array.from({ length: 500 }, () => generateShareToken()));
    expect(tokens.size).toBe(500);
  });
});
