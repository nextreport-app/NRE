import { describe, expect, it } from "vitest";
import { websiteMetricsToDynamicSlots } from "@/lib/nre/website-metrics-to-slots";

describe("websiteMetricsToDynamicSlots", () => {
  it("maps cards to eight slots with null padding", () => {
    const slots = websiteMetricsToDynamicSlots([
      { key: "sessions", label: "Sessions", value: "1,234" },
      { key: "engagementRate", label: "Engagement Rate", value: "68.5%" },
    ]);
    expect(slots).toHaveLength(8);
    expect(slots[0]?.label).toBe("SESSIONS");
    expect(slots[0]?.value).toBe("1,234");
    expect(slots[1]?.format).toBe("percentage");
    expect(slots[2]).toBeNull();
  });
});
