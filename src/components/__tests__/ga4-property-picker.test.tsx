import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Ga4PropertyPicker } from "../ga4-property-picker";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("../toast", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
describe("Saved GA4 property", () => {
  it("shows the saved assignment without asking to save it again", () => {
    const html = renderToStaticMarkup(<Ga4PropertyPicker clientId="express" initialPropertyId="552954256" initialPropertyName="NRE Account" ga4Connected embedded />);
    expect(html).toContain("Your website property is saved");
    expect(html).toContain("552954256");
    expect(html).toContain("NRE Account");
    expect(html).toContain("Unlink");
    expect(html).not.toContain("Save property");
  });
  it("does not imply an unconfigured client already has a property", () => {
    const html = renderToStaticMarkup(<Ga4PropertyPicker clientId="new" initialPropertyId={null} initialPropertyName={null} ga4Connected embedded />);
    expect(html).not.toContain("Your website property is saved");
    expect(html).not.toContain("Save property");
    expect(html).toContain("Load GA4 properties");
  });
});
