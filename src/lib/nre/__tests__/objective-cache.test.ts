import { describe, expect, it } from "vitest";
import { lookupCachedObjective, mergeObjectiveCache, parseObjectiveCache } from "../objective-cache";

describe("parseObjectiveCache", () => {
  it("returns an empty map for null/undefined/blank input", () => {
    expect(parseObjectiveCache(null)).toEqual({});
    expect(parseObjectiveCache(undefined)).toEqual({});
    expect(parseObjectiveCache("")).toEqual({});
  });

  it("returns an empty map for malformed JSON", () => {
    expect(parseObjectiveCache("{not json")).toEqual({});
  });

  it("returns an empty map for valid JSON that isn't an object", () => {
    expect(parseObjectiveCache("42")).toEqual({});
    expect(parseObjectiveCache('"a string"')).toEqual({});
    expect(parseObjectiveCache("null")).toEqual({});
  });

  it("parses a well-formed cache, normalizing campaign name keys", () => {
    const raw = JSON.stringify({
      "  Shoes - Purchases  ": { key: "purchases", resultLabel: "PURCHASES", costLabel: "COST PER PURCHASE" },
    });
    const cache = parseObjectiveCache(raw);
    expect(cache["shoes - purchases"]).toEqual({
      key: "purchases",
      resultLabel: "PURCHASES",
      costLabel: "COST PER PURCHASE",
    });
  });

  it("drops entries that don't match the CachedObjective shape (corrupt/stale cache degrades gracefully)", () => {
    const raw = JSON.stringify({
      "Valid Campaign": { key: "purchases", resultLabel: "PURCHASES", costLabel: "COST PER PURCHASE" },
      "Missing Key": { resultLabel: "PURCHASES", costLabel: "COST PER PURCHASE" },
      "Null Entry": null,
      "String Entry": "not an object",
    });
    const cache = parseObjectiveCache(raw);
    expect(Object.keys(cache)).toEqual(["valid campaign"]);
  });
});

describe("lookupCachedObjective", () => {
  it("is case-insensitive and trims whitespace, matching normalizeCampaignName everywhere else in this codebase", () => {
    const cache = parseObjectiveCache(
      JSON.stringify({ "Shoes - Purchases": { key: "purchases", resultLabel: "PURCHASES", costLabel: "COST PER PURCHASE" } }),
    );
    expect(lookupCachedObjective(cache, "  SHOES - purchases  ")).toEqual({
      key: "purchases",
      resultLabel: "PURCHASES",
      costLabel: "COST PER PURCHASE",
    });
  });

  it("returns null for a campaign not in the cache", () => {
    expect(lookupCachedObjective({}, "Unknown Campaign")).toBeNull();
  });
});

describe("mergeObjectiveCache", () => {
  it("adds new confirmations to an empty/null existing cache", () => {
    const merged = mergeObjectiveCache(null, {
      "New Campaign": { key: "purchases", resultLabel: "PURCHASES", costLabel: "COST PER PURCHASE" },
    });
    expect(JSON.parse(merged)).toEqual({
      "new campaign": { key: "purchases", resultLabel: "PURCHASES", costLabel: "COST PER PURCHASE" },
    });
  });

  it("merges new confirmations into an existing cache without dropping untouched entries", () => {
    const existing = JSON.stringify({
      "old campaign": { key: "reach", resultLabel: "REACH", costLabel: "COST PER 1K REACH" },
    });
    const merged = mergeObjectiveCache(existing, {
      "New Campaign": { key: "purchases", resultLabel: "PURCHASES", costLabel: "COST PER PURCHASE" },
    });
    const parsed = JSON.parse(merged);
    expect(parsed["old campaign"]).toEqual({ key: "reach", resultLabel: "REACH", costLabel: "COST PER 1K REACH" });
    expect(parsed["new campaign"]).toEqual({ key: "purchases", resultLabel: "PURCHASES", costLabel: "COST PER PURCHASE" });
  });

  it("overwrites an existing entry when the same campaign is re-confirmed with a different objective", () => {
    const existing = JSON.stringify({
      "seasonal campaign": { key: "reach", resultLabel: "REACH", costLabel: "COST PER 1K REACH" },
    });
    const merged = mergeObjectiveCache(existing, {
      "Seasonal Campaign": { key: "purchases", resultLabel: "PURCHASES", costLabel: "COST PER PURCHASE" },
    });
    expect(JSON.parse(merged)).toEqual({
      "seasonal campaign": { key: "purchases", resultLabel: "PURCHASES", costLabel: "COST PER PURCHASE" },
    });
  });

  it("normalizes casing so re-confirming under different casing overwrites the same entry rather than duplicating it", () => {
    const existing = JSON.stringify({
      "brand campaign": { key: "reach", resultLabel: "REACH", costLabel: "COST PER 1K REACH" },
    });
    const merged = mergeObjectiveCache(existing, {
      "BRAND CAMPAIGN": { key: "purchases", resultLabel: "PURCHASES", costLabel: "COST PER PURCHASE" },
    });
    const parsed = JSON.parse(merged);
    expect(Object.keys(parsed)).toEqual(["brand campaign"]);
    expect(parsed["brand campaign"].key).toBe("purchases");
  });
});
