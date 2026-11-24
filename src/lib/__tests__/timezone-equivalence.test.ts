import { describe, expect, it } from "vitest";
import {
  canonicalTimezone,
  timezonesEquivalent,
} from "../timezone-equivalence";
describe("IANA timezone equivalence", () => {
  it.each([
    ["Canada/Eastern", "America/Toronto"],
    ["US/Eastern", "America/New_York"],
    ["Asia/Calcutta", "Asia/Kolkata"],
    ["UTC", "Etc/UTC"],
  ])("accepts aliases %s and %s", (a, b) => {
    expect(timezonesEquivalent(a, b)).toBe(true);
    expect(timezonesEquivalent(b, a)).toBe(true);
  });
  it.each([
    ["America/Toronto", "America/New_York"],
    ["UTC", "Europe/London"],
    ["EST", "America/New_York"],
    ["America/Chicago", "America/Toronto"],
  ])(
    "does not equate distinct zones just because their offsets can match: %s and %s",
    (a, b) => expect(timezonesEquivalent(a, b)).toBe(false),
  );
  it("fails closed for invalid or absent timezone identifiers", () => {
    expect(canonicalTimezone("invalid")).toBeNull();
    expect(timezonesEquivalent("invalid", "invalid")).toBe(false);
    expect(timezonesEquivalent("", "UTC")).toBe(false);
  });
});
