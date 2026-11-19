import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("@/components/help/help-doc-shell", () => ({
  helpDocMetadata: () => ({}),
  HelpDocShell: ({ children }: { children: React.ReactNode }) => (
    <main>{children}</main>
  ),
}));
import HelpMetricsPage from "@/app/help/metrics/page";
describe("metric guide destination", () => {
  it("provides the definitions promised by the PPTX overflow link, including Frequency", () => {
    const html = renderToStaticMarkup(<HelpMetricsPage />);
    expect(html).toContain('id="definitions"');
    expect(html).toContain("FREQUENCY");
    expect(html).toContain("Impressions divided by reach");
    expect(html).toContain("CPC (ALL)");
    expect(html).toContain("Spend divided by all ad clicks");
    expect(html).toContain("CPLC");
    expect(html).toContain("Spend divided by link clicks");
    expect(html).toContain("Choosing metric chips");
  });
});
