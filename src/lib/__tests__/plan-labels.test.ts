import { describe, expect, it } from "vitest";
import { getPlanDisplayName, PLATFORM_LIST_SHORT } from "@/lib/plan-labels";

describe("plan-labels", () => {
  it("maps starter to Agency display name", () => {
    expect(getPlanDisplayName("starter")).toBe("Agency");
  });

  it("lists the currently available Meta reporting platform", () => {
    expect(PLATFORM_LIST_SHORT).toBe("Meta Ads reporting");
  });
});
