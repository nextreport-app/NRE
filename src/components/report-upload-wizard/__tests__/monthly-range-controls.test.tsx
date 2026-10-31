import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ReportPeriodControls } from "../ui/report-period-controls";
const state = vi.hoisted(() => ({ reportType: "HISTORICAL", historicalMonthCount: 2, dateMode: "custom", customStart: "2026-09-01", customEnd: "2026-10-30", clientTimezone: "Asia/Kolkata", dateBounds: null }));
vi.mock("../wizard-context", () => ({ useWizardContext: () => state }));
afterEach(() => vi.useRealTimers());
describe("monthly range presentation", () => {
  it("shows a read-only monthly summary on Generate instead of repeating the selection controls", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-31T10:00:00Z"));
    const html = renderToStaticMarkup(<ReportPeriodControls stage="generate" />);
    expect(html).toContain("Report period");
    expect(html).toContain("Change dates");
    expect(html).toContain("September 2026");
    expect(html).toContain("October 2026");
    expect(html).toContain("2 months, shown separately");
    expect(html).not.toContain("From month");
    expect(html).not.toContain("Which months would you like to report?");
    expect(html).not.toContain("Last 3 complete months");
    expect(html).not.toContain("CSV coverage needed");
  });
  it("makes a previous full month plus current MTD explicit without an ambiguous count selector", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-31T10:00:00Z"));
    const html = renderToStaticMarkup(<ReportPeriodControls />);
    expect(html).toContain("From month");
    expect(html).toContain("To month");
    expect(html).not.toContain("Previous month + MTD");
    expect(html).toContain("September 2026");
    expect(html).toContain("October 2026");
    expect(html).toContain("(full month)");
    expect(html).toContain("(MTD)");
    expect(html).toContain("2 months selected");
    expect(html).not.toContain("Number of months");
    expect(html).toContain("Day-wise breakdown for this entire date range");
    expect(html.match(/Through yesterday/g)).toHaveLength(1);
  });
});
