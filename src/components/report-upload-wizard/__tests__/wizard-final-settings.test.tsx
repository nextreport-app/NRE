import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WizardFinalSettings } from "../ui/wizard-final-settings";
describe("final optional settings", () => {
  it("starts collapsed with a short summary of the available settings", () => {
    const html = renderToStaticMarkup(<WizardFinalSettings hasComparisons previousMonthEnabled={false}><p>Settings controls</p></WizardFinalSettings>);
    expect(html).toContain("Optional settings");
    expect(html).toContain("Comparisons · Cover budget · Branding");
    expect(html).not.toContain('open=""');
    expect(html).not.toContain("Previous-month totals on");
  });
  it("keeps enabled comparison status visible in the summary", () => {
    const html = renderToStaticMarkup(<WizardFinalSettings hasComparisons previousMonthEnabled previousMonthReady><p>Settings</p></WizardFinalSettings>);
    expect(html.match(/<summary[\s\S]*?<\/summary>/)?.[0]).toContain("Previous-month totals on");
  });
  it("shows an enabled comparison still needing upload in the collapsed summary", () => {
    const html = renderToStaticMarkup(<WizardFinalSettings hasComparisons previousMonthEnabled previousMonthReady={false}><p>Settings</p></WizardFinalSettings>);
    expect(html.match(/<summary[\s\S]*?<\/summary>/)?.[0]).toContain("Previous-month upload needed");
    expect(html).not.toContain("Previous-month totals on");
  });
  it("opens and surfaces branding errors without requiring expansion", () => {
    const html = renderToStaticMarkup(<WizardFinalSettings hasComparisons={false} previousMonthEnabled={false} error="Choose valid branding"><p>Settings</p></WizardFinalSettings>);
    expect(html).toContain('open=""');
    expect(html).toContain('role="alert"');
    expect(html).toContain("Choose valid branding");
    expect(html).not.toContain("Comparisons");
  });
});
