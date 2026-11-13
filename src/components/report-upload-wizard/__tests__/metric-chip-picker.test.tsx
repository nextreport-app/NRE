import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MetricChipPicker } from "../ui/metric-chip-picker";
const spend = { key: "spend", label: "AD SPEND" };
const reach = { key: "reach", label: "REACH" };
const props = { selected: [spend], available: [spend, reach], onAdd: vi.fn(), onRemove: vi.fn() };
describe("compact metric selection", () => {
  it("omits the repeated selected heading and combines the available copy", () => {
    const html = renderToStaticMarkup(<MetricChipPicker {...props} />);
    expect(html).not.toContain("Included metrics");
    expect(html).toContain("Available metrics detected from your CSV.");
    expect(html).not.toContain("Metrics in your imported data");
    expect(html).toContain('aria-label="Remove AD SPEND"');
    expect(html).toContain('aria-label="Add REACH"');
    expect(html).not.toContain('aria-label="Add AD SPEND"');
  });
  it("uses API wording for API imports", () => {
    const html = renderToStaticMarkup(<MetricChipPicker {...props} source="Meta API" />);
    expect(html).toContain("Available metrics detected from Meta API.");
    expect(html).not.toContain("your CSV");
  });
  it("preserves required metrics and the selection limit", () => {
    const html = renderToStaticMarkup(<MetricChipPicker {...props} lockedKeys={["spend"]} limit={1} />);
    expect(html).not.toContain('aria-label="Remove AD SPEND"');
    expect(html).toContain("1-metric limit reached");
    expect(html).toMatch(/aria-label="Add REACH" disabled=""/);
  });
});
