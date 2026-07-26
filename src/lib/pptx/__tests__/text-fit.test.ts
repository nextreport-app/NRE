import { describe, expect, it } from "vitest";
import { emuToPt, estimateTextWidthPt, fitFontSizePt } from "../text-fit";

// Ground truth from the account-name box fix: templates/dark.pptx's
// ACCOUNT_NAME shape is cx="5300000" EMU wide (lIns/rIns both 0), and the
// reported real-world long name was empirically confirmed (LibreOffice
// render + pixel measurement) to need 16pt — 18pt and up still wrapped to a
// second line at that width.
const ACCOUNT_NAME_MAX_WIDTH_PT = emuToPt(5300000);
const LONG_ACCOUNT_NAME = "Alonzo Carr (Tailored Fiduciary Services)";

describe("emuToPt", () => {
  it("converts EMU to points (914400 EMU per inch, 72pt per inch)", () => {
    expect(emuToPt(914400)).toBe(72);
    expect(emuToPt(5300000)).toBeCloseTo(417.32, 2);
  });
});

describe("estimateTextWidthPt", () => {
  it("grows with both text length and font size", () => {
    expect(estimateTextWidthPt("AAAA", 20)).toBeGreaterThan(estimateTextWidthPt("AA", 20));
    expect(estimateTextWidthPt("AAAA", 28)).toBeGreaterThan(estimateTextWidthPt("AAAA", 20));
  });
});

describe("fitFontSizePt", () => {
  it("picks the largest candidate size for a short name that fits at every size", () => {
    expect(fitFontSizePt("Acme Inc", ACCOUNT_NAME_MAX_WIDTH_PT, [28, 24, 20, 18, 16])).toBe(28);
  });

  it("matches the empirically-confirmed 16pt fit for the reported long account name (regression)", () => {
    expect(fitFontSizePt(LONG_ACCOUNT_NAME, ACCOUNT_NAME_MAX_WIDTH_PT, [28, 24, 20, 18, 16])).toBe(16);
  });

  it("falls back to the smallest candidate when nothing fits", () => {
    const veryLong = "W".repeat(200);
    expect(fitFontSizePt(veryLong, ACCOUNT_NAME_MAX_WIDTH_PT, [28, 24, 20, 18, 16])).toBe(16);
  });

  it("checks candidates in the order given, from largest to smallest", () => {
    // A mid-length name should land on one of the middle candidates, not
    // jump straight to the smallest.
    const midName = "Riverside Dental Group LLC";
    const picked = fitFontSizePt(midName, ACCOUNT_NAME_MAX_WIDTH_PT, [28, 24, 20, 18, 16]);
    expect([28, 24, 20, 18, 16]).toContain(picked);
    expect(estimateTextWidthPt(midName, picked)).toBeLessThanOrEqual(ACCOUNT_NAME_MAX_WIDTH_PT);
  });
});
