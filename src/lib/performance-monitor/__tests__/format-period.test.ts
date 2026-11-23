import { expect, it } from "vitest";
import { formatMetaPeriod } from "../format-period";
it("formats comparison ranges with month names and an unambiguous year", () => {
  expect(formatMetaPeriod("2026-10-24", "2026-11-22")).toBe(
    "Oct 24 – Nov 22, 2026",
  );
  expect(formatMetaPeriod("2025-12-24", "2026-01-22")).toBe(
    "Dec 24, 2025 – Jan 22, 2026",
  );
  expect(formatMetaPeriod("2026-11-22", "2026-11-22")).toBe("Nov 22, 2026");
});
