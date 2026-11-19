import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SiteThemeProvider } from "@/components/site-theme-provider";
import { WizardReportSetupPanel } from "../ui/wizard-report-setup-panel";
import type { MetaReportSelection } from "@/lib/nre/meta-report-content/selection";
function render(
  selection: MetaReportSelection | null = null,
  source: "api" | "csv" = "csv",
) {
  return renderToStaticMarkup(
    <SiteThemeProvider>
      <WizardReportSetupPanel
        reportType="WEEKLY"
        reportTypeLabel="Weekly"
        platform="META"
        source={source}
        clientTimezone="UTC"
        onReportTypeChange={() => {}}
        reportSelection={selection}
        onReportSelectionChange={() => {}}
      />
    </SiteThemeProvider>,
  );
}
describe("first-class report choices on Import", () => {
  it("shows six choices without the discarded information wall", () => {
    const html = render();
    expect(html.match(/type="radio"/g)).toHaveLength(6);
    expect(html).toContain('value="BREAKDOWN"');
    expect(html).toContain('value="CREATIVE"');
    expect(html).not.toContain("Audience &amp; creative reporting");
    expect(html).not.toContain("Which CSVs do I need?");
    expect(html).not.toContain("Breakdown by");
  });
  it.each(["age", "location", "placement", "platform"] as const)(
    "shows only the selected %s requirement and its four subchoices",
    (dimension) => {
      const html = render({ kind: "BREAKDOWN", dimension });
      expect(html).toContain("Breakdown by");
      expect(html.match(/type="radio"/g)).toHaveLength(10);
      expect(html).toContain(`Campaign performance by ${dimension}.`);
      expect(html).not.toContain("Last 7 days’ performance");
      expect(html).not.toContain("Add audience views");
    },
  );
  it("keeps CSV creative requirements distinct from automatic API fetching", () => {
    const csv = render({ kind: "CREATIVE" });
    expect(csv).toContain("Ad ID + Ad name");
    expect(csv).toContain("CSV reports work without images");
    expect(csv).not.toContain("Breakdown by");
    const api = render({ kind: "CREATIVE" }, "api");
    expect(api).toContain("Fetched automatically");
    expect(api).toContain("videos use poster images");
    expect(api).not.toContain("Ad ID + Ad name");
  });
});
