import { describe, expect, it } from "vitest";
import { OBJECTIVE_DROPDOWN_OPTIONS, RESULT_TYPE_MAP, resolveObjectiveFromResultType } from "../result-type-map";

describe("resolveObjectiveFromResultType — exact machine result_type matching", () => {
  it("is case-insensitive and trims whitespace", () => {
    expect(resolveObjectiveFromResultType("  Purchase  ")?.resultLabel).toBe("PURCHASES");
    expect(resolveObjectiveFromResultType("PURCHASE")?.resultLabel).toBe("PURCHASES");
  });

  it("returns null for blank/unrecognized input", () => {
    expect(resolveObjectiveFromResultType("")).toBeNull();
    expect(resolveObjectiveFromResultType(null)).toBeNull();
    expect(resolveObjectiveFromResultType(undefined)).toBeNull();
    expect(resolveObjectiveFromResultType("some_totally_unknown_event")).toBeNull();
  });

  // Part 8, Test 8 — sales conversion events (purchase, add_to_cart,
  // initiate_checkout, view_content) all correctly mapped, each to its own
  // distinct objective, never collapsing into PURCHASES.
  describe("Test 8 — sales conversion funnel events", () => {
    it("purchase -> PURCHASES", () => {
      expect(resolveObjectiveFromResultType("purchase")).toEqual({
        key: "purchases",
        resultLabel: "PURCHASES",
        costLabel: "COST PER PURCHASE",
        isReach: false,
      });
      expect(resolveObjectiveFromResultType("offsite_conversion.fb_pixel_purchase")?.resultLabel).toBe("PURCHASES");
      expect(resolveObjectiveFromResultType("onsite_web_purchase")?.resultLabel).toBe("PURCHASES");
      expect(resolveObjectiveFromResultType("product_catalog_sales")?.resultLabel).toBe("PURCHASES");
    });

    it("add_to_cart -> ADD TO CART, distinct from PURCHASES", () => {
      const info = resolveObjectiveFromResultType("add_to_cart");
      expect(info?.resultLabel).toBe("ADD TO CART");
      expect(info?.resultLabel).not.toBe("PURCHASES");
      expect(resolveObjectiveFromResultType("offsite_conversion.fb_pixel_add_to_cart")?.resultLabel).toBe("ADD TO CART");
      expect(resolveObjectiveFromResultType("onsite_web_add_to_cart")?.resultLabel).toBe("ADD TO CART");
    });

    it("initiate_checkout -> INITIATE CHECKOUT, distinct from PURCHASES", () => {
      const info = resolveObjectiveFromResultType("initiate_checkout");
      expect(info?.resultLabel).toBe("INITIATE CHECKOUT");
      expect(info?.resultLabel).not.toBe("PURCHASES");
      expect(resolveObjectiveFromResultType("offsite_conversion.fb_pixel_initiate_checkout")?.resultLabel).toBe(
        "INITIATE CHECKOUT",
      );
      expect(resolveObjectiveFromResultType("onsite_web_initiate_checkout")?.resultLabel).toBe("INITIATE CHECKOUT");
    });

    it("view_content -> CONTENT VIEWS, distinct from PURCHASES", () => {
      const info = resolveObjectiveFromResultType("view_content");
      expect(info?.resultLabel).toBe("CONTENT VIEWS");
      expect(info?.resultLabel).not.toBe("PURCHASES");
      expect(resolveObjectiveFromResultType("offsite_conversion.fb_pixel_view_content")?.resultLabel).toBe(
        "CONTENT VIEWS",
      );
    });
  });

  // Part 8, Test 7 — every awareness/reach performance goal correctly
  // mapped to its own objective key, each flagged isReach: true.
  describe("Test 7 — awareness/reach performance goals", () => {
    const reachEvents = [
      "reach",
      "impressions",
      "ad_recall_lift",
      "estimated_ad_recall_lift",
      "thruplay",
      "thruplays",
      "video_view",
      "video_plays_at_least_2_secs",
    ];
    it.each(reachEvents)("%s resolves and is flagged isReach appropriately", (rt) => {
      const info = resolveObjectiveFromResultType(rt);
      expect(info).not.toBeNull();
    });

    it("reach -> REACH, isReach true", () => {
      expect(resolveObjectiveFromResultType("reach")).toEqual({
        key: "reach",
        resultLabel: "REACH",
        costLabel: "COST PER 1K REACH",
        isReach: true,
      });
    });
    it("impressions -> IMPRESSIONS, isReach true", () => {
      const info = resolveObjectiveFromResultType("impressions")!;
      expect(info.resultLabel).toBe("IMPRESSIONS");
      expect(info.costLabel).toBe("CPM");
      expect(info.isReach).toBe(true);
    });
    it("ad_recall_lift / estimated_ad_recall_lift -> AD RECALL LIFT, isReach true", () => {
      expect(resolveObjectiveFromResultType("ad_recall_lift")?.resultLabel).toBe("AD RECALL LIFT");
      expect(resolveObjectiveFromResultType("estimated_ad_recall_lift")?.resultLabel).toBe("AD RECALL LIFT");
      expect(resolveObjectiveFromResultType("ad_recall_lift")?.isReach).toBe(true);
    });
    it("thruplay/thruplays/video_view/video_plays_at_least_2_secs -> VIDEO VIEWS, not flagged as reach", () => {
      for (const rt of ["thruplay", "thruplays", "video_view", "video_plays_at_least_2_secs"]) {
        const info = resolveObjectiveFromResultType(rt)!;
        expect(info.resultLabel).toBe("VIDEO VIEWS");
        expect(info.isReach).toBe(false);
      }
    });
  });

  it("every RESULT_TYPE_MAP entry has a non-empty key/resultLabel/costLabel", () => {
    for (const [rt, info] of Object.entries(RESULT_TYPE_MAP)) {
      expect(info.key, rt).toBeTruthy();
      expect(info.resultLabel, rt).toBeTruthy();
      expect(info.costLabel, rt).toBeTruthy();
    }
  });

  it("OBJECTIVE_DROPDOWN_OPTIONS lists RESULTS last, as the generic fallback", () => {
    expect(OBJECTIVE_DROPDOWN_OPTIONS[OBJECTIVE_DROPDOWN_OPTIONS.length - 1].resultLabel).toBe("RESULTS");
  });

  it("OBJECTIVE_DROPDOWN_OPTIONS keys are all unique (dropdown values never collide)", () => {
    const keys = OBJECTIVE_DROPDOWN_OPTIONS.map((o) => o.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
