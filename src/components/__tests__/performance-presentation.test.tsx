import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ComparisonPeriod,
  CountryLabel,
  DeviceLabel,
  sumReported,
} from "../performance-presentation";
describe("shared performance presentation", () => {
  it("labels actual preset and custom date ranges without shifting calendar days", () => {
    const current = { startIso: "2026-10-25", endIso: "2026-11-23" },
      previous = { startIso: "2026-09-25", endIso: "2026-10-24" };
    const preset = renderToStaticMarkup(
      <ComparisonPeriod current={current} previous={previous} />,
    );
    expect(preset).toContain("Last 30 days vs previous 30 days");
    expect(preset).toContain("Oct 25 – Nov 23, 2026");
    expect(preset).toContain("Sep 25 – Oct 24, 2026");
    const custom = renderToStaticMarkup(
      <ComparisonPeriod
        current={{ startIso: "2026-01-01", endIso: "2026-01-01" }}
        previous={{ startIso: "2025-12-31", endIso: "2025-12-31" }}
        custom
      />,
    );
    expect(custom).toContain("1 day vs previous 1 day");
    expect(custom).not.toContain("Last");
    expect(custom).toContain("Dec 31 – Dec 31, 2025");
  });
  it("resolves GA4 country names and Search Console codes to the same local flags", () => {
    for (const country of ["India", "IND", "IN"]) {
      const html = renderToStaticMarkup(<CountryLabel country={country} />);
      expect(html).toContain("/country-flags.svg#IN");
      expect(html).toContain("India");
    }
    const unknown = renderToStaticMarkup(<CountryLabel country="(not set)" />);
    expect(unknown).toContain("(not set)");
    expect(unknown).not.toContain("<svg");
    expect(renderToStaticMarkup(<DeviceLabel device="mobile" />)).toContain(
      'stroke="currentColor"',
    );
  });
  it("does not silently turn unavailable additive metrics into zero", () => {
    expect(sumReported([3, 0, 4])).toBe(7);
    expect(sumReported([3, null])).toBeNull();
    expect(sumReported([3, undefined])).toBeNull();
    expect(sumReported([])).toBeNull();
  });
});
