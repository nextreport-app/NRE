import { describe, expect, it } from "vitest";
import { getPlanDisplayName, PLATFORM_LIST_SHORT } from "@/lib/plan-labels";

describe("plan-labels", () => {
  it("maps starter to Agency display name", () => {
    expect(getPlanDisplayName("starter")).toBe("Agency");
  });

  it("lists all four platforms in marketing copy", () => {
    expect(PLATFORM_LIST_SHORT).toContain("TikTok");
    expect(PLATFORM_LIST_SHORT).toContain("GA4");
  });
});
