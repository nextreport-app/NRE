import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WizardOptionalComparisons } from "../ui/wizard-optional-comparisons";
const { state } = vi.hoisted(() => ({ state: {
  reportType: "WEEKLY", dataSourceMode: "csv", clientId: "client", clientTimezone: "UTC",
  currencySymbol: "$", previousMonthHasFile: false, previousMonthUpdatedAt: null as string | null,
  previousMonthCampaigns: [] as string[], previousMonthSelectedCampaigns: null,
  previousMonthCampaignSpend: {}, includePreviousMonthComparison: false,
} }));
vi.mock("../wizard-context", () => ({ useWizardContext: () => state }));
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-13T12:00:00Z"));
  Object.assign(state, { reportType: "WEEKLY", dataSourceMode: "csv", includePreviousMonthComparison: false, previousMonthHasFile: false, previousMonthUpdatedAt: null });
});
afterEach(() => vi.useRealTimers());
describe("optional weekly comparisons", () => {
  it("keeps missing or stale data quiet until the user opts in", () => {
    state.previousMonthHasFile = true;
    state.previousMonthUpdatedAt = "2026-09-01T12:00:00Z";
    const html = renderToStaticMarkup(<WizardOptionalComparisons />);
    expect(html).toContain("Optional comparisons");
    expect(html).not.toMatch(/<details[^>]*\sopen/);
    expect(html).toContain('aria-checked="false"');
    expect(html).not.toContain('type="file"');
    expect(html).not.toContain("Update needed");
    expect(html).not.toContain("Upload previous month CSV");
  });
  it("reveals the full-month upload only after enabling the row", () => {
    state.includePreviousMonthComparison = true;
    const html = renderToStaticMarkup(<WizardOptionalComparisons />);
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain('type="file"');
    expect(html).toContain("full previous month");
    expect(html).toContain("No percentage change");
  });
  it.each(["api", "MONTHLY", "DAILY", "COMPARISON"])("omits the option for %s", mode => {
    if (mode === "api") state.dataSourceMode = mode; else state.reportType = mode;
    expect(renderToStaticMarkup(<WizardOptionalComparisons />)).toBe("");
  });
});
