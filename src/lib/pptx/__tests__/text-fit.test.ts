import { describe, expect, it } from "vitest";
import { emuToPt, estimateTextWidthPt, fitCardLabel, fitFontSizePt } from "../text-fit";

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

describe("fitCardLabel", () => {
  it("keeps the normal 12pt size and full text for a label of 18 characters or fewer", () => {
    const label = "A".repeat(18);
    const fit = fitCardLabel(label);
    expect(fit.sizePt).toBe(12);
    expect(fit.text).toBe(label);
  });

  it("reduces by 1.5pt for a 19-24 character label", () => {
    expect(fitCardLabel("A".repeat(19)).sizePt).toBe(10.5);
    expect(fitCardLabel("A".repeat(24)).sizePt).toBe(10.5);
  });

  it("reduces by 2.5pt for a 25-30 character label", () => {
    expect(fitCardLabel("A".repeat(25)).sizePt).toBe(9.5);
    expect(fitCardLabel("A".repeat(30)).sizePt).toBe(9.5);
  });

  it("reduces by 3.5pt for a 31+ character label", () => {
    expect(fitCardLabel("A".repeat(31)).sizePt).toBe(8.5);
    expect(fitCardLabel("A".repeat(35)).sizePt).toBe(8.5);
  });

  it("does not truncate a label at or under 35 characters, even in the largest-reduction band", () => {
    const label = "A".repeat(35);
    expect(fitCardLabel(label).text).toBe(label);
  });

  it("truncates a label over 35 characters to 35 chars + an ellipsis", () => {
    const label = "A".repeat(40);
    const fit = fitCardLabel(label);
    expect(fit.text).toBe("A".repeat(35) + "...");
    expect(fit.text.length).toBe(38);
    expect(fit.sizePt).toBe(8.5);
  });

  it("matches the reported real-world long label 'COST PER WEBSITE LEAD' (21 chars, 1.5pt reduction, no truncation)", () => {
    const fit = fitCardLabel("COST PER WEBSITE LEAD");
    expect(fit.sizePt).toBe(10.5);
    expect(fit.text).toBe("COST PER WEBSITE LEAD");
  });

  it("matches the reported real-world long label 'COST PER LANDING PAGE VIEW' (26 chars, 2.5pt reduction, no truncation)", () => {
    const fit = fitCardLabel("COST PER LANDING PAGE VIEW");
    expect(fit.sizePt).toBe(9.5);
    expect(fit.text).toBe("COST PER LANDING PAGE VIEW");
  });
});
