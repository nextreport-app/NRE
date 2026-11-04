import { describe, expect, it } from "vitest";
import { getPlanDisplayName, PLATFORM_LIST_SHORT } from "@/lib/plan-labels";

describe("plan-labels", () => {
  it("maps starter to Freelancer display name", () => {
    expect(getPlanDisplayName("starter")).toBe("Freelancer");
  });

  it("maps the new three-tier catalogue without changing old internal IDs", () => {
    expect(getPlanDisplayName("professional")).toBe("Agency");
    expect(getPlanDisplayName("agency_plus")).toBe("Agency Plus");
  });
  it("lists the currently available Meta reporting platform", () => {
    expect(PLATFORM_LIST_SHORT).toBe("Meta Ads reporting");
  });
});
