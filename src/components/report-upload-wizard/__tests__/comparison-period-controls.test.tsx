import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ComparisonPeriodControls } from "../ui/comparison-period-controls";
vi.mock("../wizard-context", () => ({ useWizardContext: () => ({ clientTimezone: "UTC", comparisonPreset: "thisWeek", comparisonPeriodA: { startIso: "2026-09-08", endIso: "2026-09-14" }, comparisonPeriodB: { startIso: "2026-09-01", endIso: "2026-09-07" } }) }));
describe("comparison date journey", () => {
  it("offers presets and CSV coverage before uploading without depending on file bounds", () => {
    const html = renderToStaticMarkup(<ComparisonPeriodControls stage="import" />);
    expect(html).toContain("Last 7 days vs previous 7 days");
    expect(html).toContain("Last two complete months");
    expect(html).toContain("Custom dates");
    expect(html).toContain("CSV coverage needed");
    expect(html).toContain("Day-wise breakdown covering both periods");
  });
  it("shows only a summary and change-dates link on Generate", () => {
    const html = renderToStaticMarkup(<ComparisonPeriodControls stage="generate" />);
    expect(html).toContain("Period A");
    expect(html).toContain("Period B");
    expect(html).toContain("Change dates");
    expect(html).not.toContain("Custom dates");
    expect(html).not.toContain("CSV coverage needed");
  });
});
