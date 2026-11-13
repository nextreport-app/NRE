import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AdSetSlidePicker } from "../ui/ad-set-slide-picker";
import { adSetKey } from "@/lib/nre/ad-sets";
const props = { campaignName: "Reach", adSetNames: ["Visitors 30–90 days", "Visitors last 30 days"], selectedAdSets: new Set<string>(), onToggle: vi.fn(), onSelectAll: vi.fn(), onClear: vi.fn() };
describe("ad set slide choices", () => {
  it("explains the optional choice once and omits the redundant empty-state warning", () => {
    const html = renderToStaticMarkup(<AdSetSlidePicker {...props} />);
    expect(html).toContain("Ad set slides"); expect(html).toContain("Optional");
    expect(html).toContain("0 of 2 selected");
    expect(html).not.toContain("No ad set slides will be generated");
    expect(html).not.toContain("Include all ad-set slides");
    expect(html).toContain("Visitors 30–90 days");
    expect(html).toContain("break-words");
    expect(html).toMatch(/disabled=""[^>]*>Clear/);
  });
  it("shows the selected count and disables Select all when everything is selected", () => {
    const selectedAdSets = new Set(props.adSetNames.map(name => adSetKey(props.campaignName, name)));
    const html = renderToStaticMarkup(<AdSetSlidePicker {...props} selectedAdSets={selectedAdSets} />);
    expect(html).toContain("2 of 2 selected");
    expect(html).toMatch(/disabled=""[^>]*>Select all/);
    expect(html.match(/checked=""/g)).toHaveLength(2);
  });
  it("uses the same checkbox layout for one ad set without bulk controls", () => {
    const html = renderToStaticMarkup(<AdSetSlidePicker {...props} adSetNames={[props.adSetNames[0]]} />);
    expect(html).toContain("0 of 1 selected");
    expect(html).toContain("shares the campaign");
    expect(html).not.toContain(">Select all<"); expect(html).not.toContain(">Clear<");
  });
});
