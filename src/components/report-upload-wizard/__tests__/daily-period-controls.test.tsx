import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ReportPeriodControls } from "../ui/report-period-controls";
vi.mock("../wizard-context", () => ({ useWizardContext: () => ({ reportType: "DAY_BREAKDOWN", clientTimezone: "UTC", dateMode: "custom", customStart: "2026-10-25", customEnd: "2026-10-31" }) }));
describe("daily date journey", () => {
  it("offers every preset and coverage guidance before upload", () => {
    const html = renderToStaticMarkup(<ReportPeriodControls />);
    for (const label of ["Yesterday", "Last 7 days", "Last 14 days", "Last 30 days", "Custom date range", "CSV coverage needed"]) expect(html).toContain(label);
    expect(html).toContain('aria-pressed=');
    expect(html).toContain("missing days are not treated as zero delivery");
  });
  it("keeps Generate read only with a route back to dates", () => {
    const html = renderToStaticMarkup(<ReportPeriodControls stage="generate" />);
    expect(html).toContain("Change dates");
    expect(html).toContain("2026");
    expect(html).not.toContain("aria-pressed");
    expect(html).not.toContain("Start date");
  });
});
