import { describe, expect, it } from "vitest";
import { comparisonTone, comparisonPercent } from "../comparison-presentation";

describe("comparison performance semantics", () => {
  it.each(["cpr", "cpc_all", "cpc_link_click", "cpm", "cost_per_lpv", "cost_per_website_lead"])("treats lower %s as favourable", key => {
    expect(comparisonTone(key, key, 120)).toBe("negative");
    expect(comparisonTone(key, key, -30)).toBe("positive");
  });
  it.each(["results", "reach", "ctr", "link_clicks", "landing_page_views", "roas"])("treats higher %s as favourable", key => {
    expect(comparisonTone(key, key, 10)).toBe("positive");
    expect(comparisonTone(key, key, -10)).toBe("negative");
  });
  it.each(["spend", "frequency", "unknown_metric"])("does not infer success from %s", key => {
    expect(comparisonTone(key, key, 10)).toBe("neutral");
    expect(comparisonTone(key, key, -10)).toBe("neutral");
  });
  it("keeps unavailable and unchanged comparisons neutral", () => {
    expect(comparisonTone("cpr", "Cost per lead", null)).toBe("neutral");
    expect(comparisonTone("results", "Results", 0)).toBe("neutral");
  });
  it("does not turn small nonzero changes into +0%", () => {
    expect(comparisonPercent(0)).toBe("0%");
    expect(comparisonPercent(0.3)).toBe("+0.3%");
    expect(comparisonPercent(-0.03)).toBe("-<0.1%");
    expect(comparisonPercent(120.4)).toBe("+120%");
    expect(comparisonPercent(null)).toBe("N/A");
  });
});
