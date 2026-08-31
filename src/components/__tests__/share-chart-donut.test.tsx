import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ShareChartDonut } from "@/components/share-chart-donut";
import { DONUT_HOLE_RATIO } from "@/lib/pptx/chart-slide-constants";

describe("ShareChartDonut", () => {
  it("uses the same hole ratio as the PPT chart slide", () => {
    const html = renderToStaticMarkup(
      <ShareChartDonut
        segments={[{ name: "A", spendLabel: "$100", percentage: 100, color: "f6ad55" }]}
        totalSpendLabel="$100"
        size={220}
      />,
    );
    expect(html).toContain(`r="${110 * DONUT_HOLE_RATIO}"`);
    expect(html).toContain("$100");
  });
});
