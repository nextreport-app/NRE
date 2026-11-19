import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SiteThemeProvider } from "@/components/site-theme-provider";
import { WizardReportSetupPanel } from "../ui/wizard-report-setup-panel";
function render(
  reportType:
    "WEEKLY" | "MONTHLY" | "HISTORICAL" | "COMPARISON" | "DAY_BREAKDOWN",
  source: "api" | "csv",
  platform: "META" | "GOOGLE" = "META",
) {
  return renderToStaticMarkup(
    <SiteThemeProvider>
      <WizardReportSetupPanel
        reportType={reportType}
        reportTypeLabel={reportType}
        platform={platform}
        source={source}
        clientTimezone="UTC"
        onReportTypeChange={() => {}}
      />
    </SiteThemeProvider>,
  );
}
describe("audience and creative discovery on Import", () => {
  it.each(["WEEKLY", "MONTHLY", "HISTORICAL"] as const)(
    "explains the actual setup location for %s without hiding the introduction",
    (type) => {
      const html = render(type, "api");
      const [visible, help] = html.split("<details");
      expect(visible).toContain("Audience &amp; creative reporting");
      expect(visible).toContain(
        "Review &amp; generate → Audience &amp; creative sections",
      );
      expect(visible).toContain("Age · Location · Platform · Placement");
      expect(visible).toContain("No extra CSV is needed");
      expect(help).toContain("Which CSVs do I need?");
    },
  );
  it("distinguishes CSV metrics from automatic API media and explains each supported source", () => {
    const html = render("WEEKLY", "csv");
    expect(html).toContain("CSV provides ad metrics");
    expect(html).toContain("Add images separately");
    expect(html).not.toContain("No extra CSV is needed");
    expect(html).toContain("A separate CSV with the Age breakdown");
    expect(html).toContain("either Region/state or Country");
    expect(html).toContain("Platform + Placement");
    expect(html).toContain("Day breakdown");
    expect(html).toContain("Ad ID, Ad name");
    expect(html).toContain("an audience CSV can be your first upload");
  });
  it.each(["COMPARISON", "DAY_BREAKDOWN"] as const)(
    "does not promise audience/creative sections for %s",
    (type) =>
      expect(render(type, "api")).not.toContain(
        "Audience &amp; creative reporting",
      ),
  );
  it("does not advertise Meta sections for other platforms", () =>
    expect(render("WEEKLY", "csv", "GOOGLE")).not.toContain(
      "Audience &amp; creative reporting",
    ));
});
