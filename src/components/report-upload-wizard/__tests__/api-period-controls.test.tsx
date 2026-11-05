import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WeeklyPeriodControls } from "../ui/weekly-period-controls";
import { ReportPeriodControls } from "../ui/report-period-controls";
import { WizardReportSetupPanel } from "../ui/wizard-report-setup-panel";
vi.mock("@/components/site-theme-provider", () => ({ useSiteTheme: () => ({ locale: "en" }) }));
const { state } = vi.hoisted(() => ({ state: { reportType: "WEEKLY", step: 1, dataSourceMode: "api", clientTimezone: "UTC", dateMode: "last7", customStart: "2026-10-01", customEnd: "2026-10-31", dateBounds: { minIso: "2026-08-01", maxIso: "2026-08-31" } } }));
vi.mock("../wizard-context", () => ({ useWizardContext: () => state }));
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-05T12:00:00Z")); state.reportType = "WEEKLY"; state.dateMode = "last7"; });
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
 it("shows the four report choices immediately in API mode", () => {
  const html = renderToStaticMarkup(<WizardReportSetupPanel source="api" reportType="WEEKLY" reportTypeLabel="Weekly overview" platform="META" clientTimezone="UTC" onReportTypeChange={() => {}} />);
  for (const label of ["Weekly overview", "Monthly report", "Compare two periods", "Daily report"]) expect(html).toContain(label);
  expect(html).toContain('aria-label="Choose report type"');
  expect(html).not.toContain("Match report dates");
 });
});
