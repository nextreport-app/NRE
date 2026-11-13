import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WeeklyPeriodControls } from "../ui/weekly-period-controls";
import { ComparisonPeriodControls } from "../ui/comparison-period-controls";
import { MonthlyPeriodControls } from "../ui/monthly-period-controls";
import { ClientDateInput } from "@/components/client-date-input";
const { state } = vi.hoisted(() => ({ state: { clientCurrency: "INR", clientTimezone: "Asia/Kolkata", dataSourceMode: "api", step: 1, reportType: "WEEKLY", dateMode: "custom", customStart: "2026-11-06", customEnd: "2026-11-12", comparisonPreset: "custom", comparisonPeriodA: { startIso: "2026-11-06", endIso: "2026-11-12" }, comparisonPeriodB: { startIso: "2026-10-30", endIso: "2026-11-05" } } }));
vi.mock("../wizard-context", () => ({ useWizardContext: () => state }));
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-13T12:00:00Z")); state.reportType = "WEEKLY"; state.clientCurrency = "INR"; });
afterEach(() => vi.useRealTimers());
describe("regional dates across report controls", () => {
  it.each([["INR", "06/11/2026", "12/11/2026"], ["USD", "11/06/2026", "11/12/2026"]])("shows %s dates in the weekly summary and date controls", (currency, start, end) => {
    state.clientCurrency = currency;
    const html = renderToStaticMarkup(<WeeklyPeriodControls />);
    const header = html.match(/<summary[^>]*>([\s\S]*?)<\/summary>/)?.[1];
    expect(header).toContain(start); expect(header).toContain(end);
    expect(html).not.toContain(">2026-11-06<");
  });
  it("uses the same regional dates for comparisons", () => {
    const html = renderToStaticMarkup(<ComparisonPeriodControls stage="generate" />);
    for (const date of ["06/11/2026", "12/11/2026", "30/10/2026", "05/11/2026"]) expect(html).toContain(date);
  });
  it("uses the same regional dates for the monthly review", () => {
    state.reportType = "MONTHLY";
    const html = renderToStaticMarkup(<MonthlyPeriodControls stage="generate" />);
    expect(html).toContain("01/11/2026 – 12/11/2026");
  });
  it("submits ISO values from report filters while displaying day-first dates", () => {
    const html = renderToStaticMarkup(<ClientDateInput name="from" label="From" defaultValue="2026-11-13" currency="INR" />);
    expect(html).toContain('name="from" value="2026-11-13"');
    expect(html).toContain(">13/11/2026<");
  });
});
