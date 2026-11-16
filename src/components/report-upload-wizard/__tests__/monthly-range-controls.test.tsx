import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ReportPeriodControls } from "../ui/report-period-controls";
const state = vi.hoisted(() => ({ reportType: "HISTORICAL", historicalMonthCount: 2, dateMode: "custom", customStart: "2026-09-01", customEnd: "2026-10-30", clientTimezone: "Asia/Kolkata", clientCurrency: "USD", dateBounds: null as { minIso: string; maxIso: string } | null, dataSourceMode: "api", step: 1 }));
vi.mock("../wizard-context", () => ({ useWizardContext: () => state }));
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-31T10:00:00Z"));
  Object.assign(state, { reportType: "HISTORICAL", historicalMonthCount: 2, dateMode: "custom", customStart: "2026-09-01", customEnd: "2026-10-30", clientTimezone: "Asia/Kolkata", clientCurrency: "USD", dateBounds: null, dataSourceMode: "api", step: 1 });
});
afterEach(() => vi.useRealTimers());
describe("monthly range presentation", () => {
  it("shows a compact read-only summary on Generate with optional date editing", () => {
    const html = renderToStaticMarkup(<ReportPeriodControls stage="generate" />);
    expect(html).toContain("Report period"); expect(html).toContain("Change dates");
    expect(html).toContain("Includes month to date");
    expect(html).not.toContain("View monthly breakdown"); expect(html).not.toContain("<details open");
    expect(html).not.toContain("From month"); expect(html).not.toContain("Last 3 complete months");
  });
  it("makes complete months plus MTD explicit before opening the breakdown", () => {
    const html = renderToStaticMarkup(<ReportPeriodControls />);
    expect(html).toContain("Reporting months"); expect(html).toContain("From month"); expect(html).toContain("To month");
    expect(html).toContain("Includes month to date"); expect(html).toContain("Through yesterday");
    expect(html).toContain("(full month)"); expect(html).toContain("10/01/2026 – 10/30/2026");
    expect(html).not.toContain("Select up to 12 consecutive months.");
    expect(html).not.toContain("Meta data needed"); expect(html).not.toContain("Number of months");
  });
  it.each(["api", "csv"])("hides calendars for the previous-month preset in %s", source => {
    state.dataSourceMode = source; state.reportType = "MONTHLY"; state.customStart = "2026-09-01"; state.customEnd = "2026-09-30";
    const html = renderToStaticMarkup(<ReportPeriodControls />);
    expect(html).toMatch(/aria-pressed="true"[^>]*>Previous month/);
    expect(html).toContain("September 2026"); expect(html).not.toContain("1 complete month");
    expect(html).not.toContain("From month"); expect(html).not.toContain("To month");
    expect(html).toContain("Custom range"); expect(html).not.toContain("Last 6 complete months");
    expect(html.includes("Your CSV must")).toBe(source === "csv");
  });
  it("restores a former three-month preset as a custom range without resetting it", () => {
    state.historicalMonthCount = 3; state.customStart = "2026-07-01"; state.customEnd = "2026-09-30";
    const html = renderToStaticMarkup(<ReportPeriodControls />);
    expect(html).not.toContain("Last 3 complete months"); expect(html).toMatch(/aria-pressed="true"[^>]*>Custom range/);
    expect(html).not.toContain("3 complete months"); expect(html).toContain("From month");
    expect(html).toContain("07/01/2026 – 07/31/2026 (full month)"); expect(html).toContain("09/01/2026 – 09/30/2026 (full month)");
    expect(html).not.toMatch(/<details[^>]*\sopen/);
  });
  it("shows custom calendars for a restored non-preset range without resetting dates", () => {
    state.historicalMonthCount = 2; state.customStart = "2026-07-01"; state.customEnd = "2026-08-31";
    const html = renderToStaticMarkup(<ReportPeriodControls />);
    expect(html).toMatch(/aria-pressed="true"[^>]*>Custom range/);
    expect(html).toContain("From month"); expect(html).toContain("To month"); expect(html).not.toContain("2 complete months");
  });
  it("uses the account timezone across a month boundary", () => {
    vi.setSystemTime(new Date("2026-11-01T00:30:00Z"));
    state.clientTimezone = "America/Los_Angeles"; state.reportType = "MONTHLY"; state.customStart = "2026-10-01"; state.customEnd = "2026-10-30";
    const html = renderToStaticMarkup(<ReportPeriodControls />);
    expect(html).toContain("This month so far"); expect(html).toContain("October 2026"); expect(html).toContain("Month to date"); expect(html).toContain("10/01/2026 – 10/30/2026");
    expect(html).not.toContain("From month");
  });
  it("does not offer an empty current month on the account's first day", () => {
    vi.setSystemTime(new Date("2026-11-01T12:00:00Z"));
    state.reportType = "MONTHLY"; state.customStart = "2026-10-01"; state.customEnd = "2026-10-31";
    const html = renderToStaticMarkup(<ReportPeriodControls />);
    expect(html).not.toContain("This month so far"); expect(html).not.toContain("1 complete month");
    expect(html).toMatch(/aria-pressed="true"[^>]*>Previous month/);
  });
  it("labels an older CSV's partial month by its actual coverage", () => {
    vi.setSystemTime(new Date("2026-11-09T12:00:00Z"));
    state.dataSourceMode = "csv"; state.reportType = "MONTHLY"; state.dateBounds = { minIso: "2026-10-01", maxIso: "2026-10-27" };
    state.customStart = "2026-10-01"; state.customEnd = "2026-10-27";
    const html = renderToStaticMarkup(<ReportPeriodControls />);
    expect(html).toContain("Latest CSV month"); expect(html).toContain("Through latest CSV day");
    expect(html).not.toContain("Through yesterday"); expect(html).toContain("October 2026");
  });
});

describe("requested single-month summary format", () => {
  it.each(["api", "csv"])("shows the complete October range directly in %s", source => {
    vi.setSystemTime(new Date("2026-11-15T12:00:00Z"));
    Object.assign(state, { dataSourceMode: source, reportType: "MONTHLY", historicalMonthCount: 1, customStart: "2026-10-01", customEnd: "2026-10-31" });
    const html = renderToStaticMarkup(<ReportPeriodControls />);
    expect(html).toContain(">October 2026</p>");
    expect(html).toContain("10/01/2026 – 10/31/2026 (full month)");
    expect(html).not.toMatch(/View monthly breakdown|Last 3 complete months|1 complete month/);
  });
  it("shows month-to-date and Through yesterday once without a breakdown toggle", () => {
    vi.setSystemTime(new Date("2026-11-15T12:00:00Z"));
    Object.assign(state, { reportType: "MONTHLY", historicalMonthCount: 1, customStart: "2026-11-01", customEnd: "2026-11-14" });
    const html = renderToStaticMarkup(<ReportPeriodControls />);
    expect(html).toContain("November 2026 · Month to date");
    expect(html).toContain("11/01/2026 – 11/14/2026 · Through yesterday");
    expect(html).not.toContain("View monthly breakdown");
  });
});
