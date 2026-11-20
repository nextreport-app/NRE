import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ContentReportPeriodControls } from "../ui/content-report-period-controls";
const { state } = vi.hoisted(() => ({ state: { dataSourceMode: "csv", clientTimezone: "UTC", customStart: "2026-10-21", customEnd: "2026-11-19", dateBounds: { minIso: "2026-10-01", maxIso: "2026-11-19" } } }));
vi.mock("../wizard-context", () => ({ useWizardContext: () => state }));
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-21T12:00:00Z")); });
afterEach(() => vi.useRealTimers());
describe("Breakdown and creative period controls", () => {
  it.each(["csv", "api"])("highlights each selected period and offers custom dates for %s", mode => {
    state.dataSourceMode = mode;
    const end = mode === "csv" ? "2026-11-19" : "2026-11-20";
    for (const [start, label] of [[mode === "csv" ? "2026-11-13" : "2026-11-14", "Last 7 days"], [mode === "csv" ? "2026-10-21" : "2026-10-22", "Last 30 days"], ["2026-11-01", "Custom date range"]]) {
      state.customStart = start; state.customEnd = end;
      const html = renderToStaticMarkup(<ContentReportPeriodControls/>);
      const buttons = html.match(/<button[^>]*>[\s\S]*?<\/button>/g)!;
      expect(buttons).toHaveLength(3);
      const active = buttons.filter(button => button.includes('aria-pressed="true"'));
      expect(active).toHaveLength(1); expect(active[0]).toContain(label); expect(active[0]).toContain("bg-dash-accent");
      expect(html.includes('type="date"')).toBe(label === "Custom date range");
      expect(html).toContain(end);
    }
  });
});
