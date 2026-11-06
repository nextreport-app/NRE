import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WeeklyPeriodControls } from "../ui/weekly-period-controls";
import { ReportPeriodControls } from "../ui/report-period-controls";
import { WizardReportSetupPanel } from "../ui/wizard-report-setup-panel";
vi.mock("@/components/site-theme-provider", () => ({ useSiteTheme: () => ({ locale: "en" }) }));
const { state } = vi.hoisted(() => ({ state: { reportType: "WEEKLY", step: 1, dataSourceMode: "api", clientTimezone: "UTC", dateMode: "last7", customStart: "2026-10-01", customEnd: "2026-10-31", dateBounds: { minIso: "2026-08-01", maxIso: "2026-08-31" } } }));
vi.mock("../wizard-context", () => ({ useWizardContext: () => state }));
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-05T12:00:00Z")); state.reportType = "WEEKLY"; state.dateMode = "last7"; state.dataSourceMode = "api"; });
afterEach(() => vi.useRealTimers());
describe("shared report controls for API imports", () => {
 it("shows the selected weekly preset and current account dates, ignoring stale CSV bounds", () => {
  const html = renderToStaticMarkup(<WeeklyPeriodControls />);
  expect(html).toContain('aria-pressed="true"');
  expect(html).toContain('bg-dash-accent');
  expect(html).toContain("2026-10-29"); expect(html).toContain("2026-11-04");
  expect(html).not.toContain("2026-08-31"); expect(html).not.toContain("Start date");
 });
 it("uses the same day-by-day controls without CSV download instructions", () => {
  state.reportType = "DAY_BREAKDOWN"; state.dateMode = "custom";
  const html = renderToStaticMarkup(<ReportPeriodControls />);
  expect(html).toContain("Last 30 days"); expect(html).toContain("Meta data needed:");
  expect(html).not.toContain("Your CSV must");
 });
 it.each(["csv", "api"])("shows only the requested weekly choices for %s", source => {
  state.dataSourceMode = source;
  const html = renderToStaticMarkup(<WeeklyPeriodControls />);
  expect(html).toContain("Last 7 days"); expect(html).toContain("Custom date range");
  expect(html).not.toContain("Previous 7 days"); expect(html).not.toContain("Last 14 days");
  expect(html).not.toContain("Choose the reporting period"); expect(html).not.toContain("through yesterday");
  expect(html).not.toContain(" · UTC");
 });
 it.each(["prev7", "last14"])("keeps legacy %s dates accessible through Custom", mode => {
  state.dateMode = mode;
  const html = renderToStaticMarkup(<WeeklyPeriodControls />);
  expect(html).toContain("Start date"); expect(html).toContain("End date");
  expect(html).toContain("2026-10-22");
 });
 it.each(["csv", "api"] as const)("uses the same collapsed report-type interface for %s", source => {
  const html = renderToStaticMarkup(<WizardReportSetupPanel source={source} reportType="WEEKLY" reportTypeLabel="Weekly overview" platform="META" clientTimezone="UTC" onReportTypeChange={() => {}} />);
  expect(html).toContain("Change report type"); expect(html).not.toContain("Close choices");
 });
});
