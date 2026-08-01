import { describe, expect, it } from "vitest";
import { fillCombinedTotalTable, insertCombinedTotalNote } from "../table-slide";
import { buildTableSlideXml } from "../fill-tags";
import type { TableHeaderLabels, TableRowData } from "../../nre/report-data";

const EXPECTED_ROWS = 3;
const NATIVE_COLS = 10;

function cellXml(placeholder: string, sizePt = 1400): string {
  return `<a:tc><a:txBody><a:bodyPr/><a:p><a:r><a:rPr sz="${sizePt}" b="0"/><a:t>${placeholder}</a:t></a:r></a:p></a:txBody></a:tc>`;
}

/** A minimal but structurally realistic 3x10 table, one placeholder cell per position. */
function buildFixtureTable(rows = EXPECTED_ROWS, cols = NATIVE_COLS, colWidth = 100000): string {
  const trs = Array.from({ length: rows }, (_, r) => {
    const tcs = Array.from({ length: cols }, (_, c) => cellXml(`R${r}C${c}`)).join("");
    return `<a:tr h="200000">${tcs}</a:tr>`;
  }).join("");
  const gridCols = Array.from({ length: cols }, () => `<a:gridCol w="${colWidth}"/>`).join("");
  return `<p:sp><a:tbl><a:tblGrid>${gridCols}</a:tblGrid>${trs}</a:tbl></p:sp>`;
}

function grid3xN(cols: number, fill: (r: number, c: number) => string): string[][] {
  return Array.from({ length: EXPECTED_ROWS }, (_, r) => Array.from({ length: cols }, (_, c) => fill(r, c)));
}

function grid3x10(fill: (r: number, c: number) => string): string[][] {
  return grid3xN(NATIVE_COLS, fill);
}

describe("fillCombinedTotalTable", () => {
  it("fills every one of the 3x10 cells at its exact position", () => {
    const xml = buildFixtureTable();
    const grid = grid3x10((r, c) => `V${r}-${c}`);
    const out = fillCombinedTotalTable(xml, grid);

    for (let r = 0; r < EXPECTED_ROWS; r++) {
      for (let c = 0; c < NATIVE_COLS; c++) {
        expect(out).toContain(`<a:t>V${r}-${c}</a:t>`);
      }
    }
    // No leftover placeholder text anywhere.
    expect(out).not.toMatch(/R\d+C\d+/);
  });

  it("preserves each cell's existing run style (rPr) while swapping its text", () => {
    const xml = buildFixtureTable();
    const grid = grid3x10(() => "X");
    const out = fillCombinedTotalTable(xml, grid);
    // Every cell in the fixture was built with sz="1400" — confirm it survived the fill.
    expect((out.match(/sz="1400"/g) || []).length).toBe(EXPECTED_ROWS * NATIVE_COLS);
  });

  it("column 2 (Reach) never disappears: header text and both row values land exactly there", () => {
    const xml = buildFixtureTable();
    const grid = grid3x10((r, c) => (c === 2 ? ["Reach", "46,266", "—"][r] : `V${r}-${c}`));
    const out = fillCombinedTotalTable(xml, grid);
    expect(out).toContain("<a:t>Reach</a:t>");
    expect(out).toContain("<a:t>46,266</a:t>");
    // Column 2 in the MTD row (row 2) is literally the em dash, not absent.
    const mtdRowXml = out.split("<a:tr").slice(-1)[0];
    expect(mtdRowXml).toContain("<a:t>—</a:t>");
  });

  it("throws when the grid doesn't have exactly 3 rows", () => {
    const xml = buildFixtureTable();
    expect(() => fillCombinedTotalTable(xml, grid3x10(() => "x").slice(0, 2))).toThrow(/3 rows/);
  });

  it("throws when the grid's rows aren't all the same width", () => {
    const xml = buildFixtureTable();
    const full = grid3x10(() => "x");
    expect(() => fillCombinedTotalTable(xml, [full[0].slice(0, 9), full[1], full[2]])).toThrow(/even number/);
  });

  it("throws when the result-column count would be odd (not 6 + an even number)", () => {
    const xml = buildFixtureTable();
    expect(() => fillCombinedTotalTable(xml, grid3xN(9, () => "x"))).toThrow(/even number/);
  });

  it("throws when the template has no <a:tbl> at all", () => {
    const grid = grid3x10(() => "x");
    expect(() => fillCombinedTotalTable("<p:sp>no table here</p:sp>", grid)).toThrow(/<a:tbl>/);
  });

  it("throws when the template's table doesn't have exactly 3 rows", () => {
    const xml = buildFixtureTable(2, NATIVE_COLS);
    const grid = grid3x10(() => "x");
    expect(() => fillCombinedTotalTable(xml, grid)).toThrow(/3 rows/);
  });

  it("throws when a template row doesn't have exactly 10 native columns", () => {
    const xml = buildFixtureTable(EXPECTED_ROWS, 8);
    const grid = grid3xN(8, () => "x");
    expect(() => fillCombinedTotalTable(xml, grid)).toThrow(/10 columns/);
  });

  it("throws when a cell has no run to hold text, instead of silently leaving it blank", () => {
    const brokenCell = "<a:tc><a:txBody><a:bodyPr/><a:p/></a:txBody></a:tc>"; // no <a:r> at all
    const goodCells = Array.from({ length: NATIVE_COLS - 1 }, (_, c) => cellXml(`C${c}`)).join("");
    const row0 = `<a:tr h="200000">${brokenCell}${goodCells}</a:tr>`;
    const otherRows = Array.from({ length: EXPECTED_ROWS - 1 }, (_, r) => {
      const tcs = Array.from({ length: NATIVE_COLS }, (_, c) => cellXml(`R${r + 1}C${c}`)).join("");
      return `<a:tr h="200000">${tcs}</a:tr>`;
    }).join("");
    const gridCols = Array.from({ length: NATIVE_COLS }, () => `<a:gridCol w="100000"/>`).join("");
    const xml = `<p:sp><a:tbl><a:tblGrid>${gridCols}</a:tblGrid>${row0}${otherRows}</a:tbl></p:sp>`;
    const grid = grid3x10(() => "x");
    expect(() => fillCombinedTotalTable(xml, grid)).toThrow(/no text run/);
  });

  it("only rewrites the table, leaving surrounding slide XML untouched", () => {
    const xml = `<p:sldBefore/>${buildFixtureTable()}<p:sldAfter/>`;
    const out = fillCombinedTotalTable(xml, grid3x10(() => "x"));
    expect(out).toContain("<p:sldBefore/>");
    expect(out).toContain("<p:sldAfter/>");
  });

  describe("hideRowIndexes / hideColIndexes", () => {
    it("removes the requested row entirely (e.g. the Period row) while keeping the others filled", () => {
      const xml = buildFixtureTable();
      const grid = grid3x10((r, c) => `V${r}-${c}`);
      const out = fillCombinedTotalTable(xml, grid, { hideRowIndexes: [1] });

      const rowCount = (out.match(/<a:tr /g) || []).length;
      expect(rowCount).toBe(2);
      // Row 1 (Period) is gone; rows 0 (header) and 2 (MTD) survive.
      expect(out).not.toContain("<a:t>V1-0</a:t>");
      expect(out).toContain("<a:t>V0-0</a:t>");
      expect(out).toContain("<a:t>V2-0</a:t>");
    });

    it("removes the requested columns from every row and from <a:tblGrid>", () => {
      const xml = buildFixtureTable();
      const grid = grid3xN(8, (r, c) => `V${r}-${c}`);
      const out = fillCombinedTotalTable(xml, grid, { hideColIndexes: [8, 9] });

      // Every row now has 8 cells, not 10.
      const rows = out.split("<a:tr ");
      for (const row of rows.slice(1)) {
        expect((row.match(/<a:tc>/g) || []).length).toBe(8);
      }
      // Columns 8-9's content is gone from every row.
      for (let r = 0; r < EXPECTED_ROWS; r++) {
        expect(out).not.toContain(`<a:t>V${r}-8</a:t>`);
        expect(out).not.toContain(`<a:t>V${r}-9</a:t>`);
      }
      // Only 8 <a:gridCol> entries remain.
      expect((out.match(/<a:gridCol /g) || []).length).toBe(8);
    });

    it("redistributes the removed columns' width evenly across the remaining columns", () => {
      const xml = buildFixtureTable(EXPECTED_ROWS, NATIVE_COLS, 100000); // 10 cols x 100000 = 1,000,000 total
      const grid = grid3xN(8, () => "x");
      const out = fillCombinedTotalTable(xml, grid, { hideColIndexes: [8, 9] });
      // 1,000,000 spread across the remaining 8 columns = 125,000 each.
      const widths = [...out.matchAll(/<a:gridCol w="(\d+)"\/>/g)].map((m) => Number(m[1]));
      expect(widths).toEqual(Array(8).fill(125000));
    });

    it("applies both row and column hiding together", () => {
      const xml = buildFixtureTable();
      const grid = grid3xN(8, (r, c) => `V${r}-${c}`);
      const out = fillCombinedTotalTable(xml, grid, { hideRowIndexes: [1], hideColIndexes: [8, 9] });

      expect((out.match(/<a:tr /g) || []).length).toBe(2);
      const rows = out.split("<a:tr ");
      for (const row of rows.slice(1)) {
        expect((row.match(/<a:tc>/g) || []).length).toBe(8);
      }
      expect(out).toContain("<a:t>V0-0</a:t>"); // header survives
      expect(out).toContain("<a:t>V2-0</a:t>"); // MTD survives
      expect(out).not.toContain("<a:t>V1-0</a:t>"); // Period row gone
    });

    it("leaves the table fully intact (3x10) when no hiding is requested", () => {
      const xml = buildFixtureTable();
      const grid = grid3x10(() => "x");
      const out = fillCombinedTotalTable(xml, grid);
      expect((out.match(/<a:tr /g) || []).length).toBe(3);
      expect((out.match(/<a:gridCol /g) || []).length).toBe(10);
    });
  });

  describe("growing past the native 10 columns (Fix 1 — 3+ objectives)", () => {
    it("grows to 12 columns for a 3-objective grid, filling every cell including the new pair", () => {
      const xml = buildFixtureTable();
      const grid = grid3xN(12, (r, c) => `V${r}-${c}`);
      const out = fillCombinedTotalTable(xml, grid);

      expect((out.match(/<a:gridCol /g) || []).length).toBe(12);
      const rows = out.split("<a:tr ");
      for (const row of rows.slice(1)) {
        expect((row.match(/<a:tc>/g) || []).length).toBe(12);
      }
      // Every cell, including the two brand-new ones, got filled.
      for (let r = 0; r < EXPECTED_ROWS; r++) {
        for (let c = 0; c < 12; c++) {
          expect(out).toContain(`<a:t>V${r}-${c}</a:t>`);
        }
      }
    });

    it("grows to 14 columns for a 4-objective grid", () => {
      const xml = buildFixtureTable();
      const grid = grid3xN(14, (r, c) => `V${r}-${c}`);
      const out = fillCombinedTotalTable(xml, grid);

      expect((out.match(/<a:gridCol /g) || []).length).toBe(14);
      expect(out).toContain("<a:t>V0-12</a:t>");
      expect(out).toContain("<a:t>V0-13</a:t>");
    });

    it("rescales every column's width so the table's total width is unchanged after growing", () => {
      // 10 x 120,000 = 1,200,000 total — chosen to divide evenly by 12 too,
      // so growth-then-rescale lands on an exact, not just approximate, split.
      const xml = buildFixtureTable(EXPECTED_ROWS, NATIVE_COLS, 120000);
      const grid = grid3xN(12, () => "x");
      const out = fillCombinedTotalTable(xml, grid);

      const widths = [...out.matchAll(/<a:gridCol w="(\d+)"\/>/g)].map((m) => Number(m[1]));
      expect(widths).toHaveLength(12);
      const total = widths.reduce((a, b) => a + b, 0);
      expect(total).toBe(1200000);
      expect(new Set(widths).size).toBe(1); // all equal
    });

    it("clones the grown row cells with each row's own existing run style, not a generic one", () => {
      const xml = buildFixtureTable(EXPECTED_ROWS, NATIVE_COLS, 100000);
      const grid = grid3xN(12, () => "x");
      const out = fillCombinedTotalTable(xml, grid);
      // Every cell (grown ones included) keeps the fixture's sz="1400" rPr.
      expect((out.match(/sz="1400"/g) || []).length).toBe(EXPECTED_ROWS * 12);
    });
  });
});

describe("buildTableSlideXml — Fix 8: Monthly reports show only the MTD row", () => {
  const headers: TableHeaderLabels = { resultColumns: [{ label: "RESULTS", costLabel: "COST PER RESULT" }] };
  const periodRow: TableRowData = {
    hasData: true,
    monthLabel: "Jun 2026 PERIOD-LABEL",
    monthName: "June",
    spend: "₹500",
    reach: "10,000",
    impressions: "20,000",
    ctr: "1.00%",
    cpc: "₹2.00",
    resultColumns: [{ label: "RESULTS", costLabel: "COST PER RESULT", value: "5", cprValue: "₹100.00" }],
  };
  const mtdRow: TableRowData = {
    hasData: true,
    monthLabel: "Jul 1 - Jul 19 MTD-LABEL",
    monthName: "July",
    spend: "₹900",
    reach: "18,000",
    impressions: "36,000",
    ctr: "1.20%",
    cpc: "₹2.50",
    resultColumns: [{ label: "RESULTS", costLabel: "COST PER RESULT", value: "9", cprValue: "₹100.00" }],
  };

  it("shows both the Period and MTD rows for a Weekly report when Period has data", () => {
    const xml = buildFixtureTable();
    const out = buildTableSlideXml({ xml, rels: "" }, periodRow, mtdRow, headers, "WEEKLY");
    expect(out).toContain("PERIOD-LABEL");
    expect(out).toContain("MTD-LABEL");
  });

  it("hides the Period row for a Monthly report, even though Period has real data", () => {
    const xml = buildFixtureTable();
    const out = buildTableSlideXml({ xml, rels: "" }, periodRow, mtdRow, headers, "MONTHLY");
    expect(out).not.toContain("PERIOD-LABEL");
    expect(out).toContain("MTD-LABEL");
  });

  it("defaults to WEEKLY (both rows shown) when reportType is omitted", () => {
    const xml = buildFixtureTable();
    const out = buildTableSlideXml({ xml, rels: "" }, periodRow, mtdRow, headers);
    expect(out).toContain("PERIOD-LABEL");
    expect(out).toContain("MTD-LABEL");
  });

  it("still hides the Period row for a Weekly report when Period genuinely has no data — unaffected by reportType", () => {
    const xml = buildFixtureTable();
    const emptyPeriodRow: TableRowData = { ...periodRow, hasData: false, monthLabel: "—" };
    const out = buildTableSlideXml({ xml, rels: "" }, emptyPeriodRow, mtdRow, headers, "WEEKLY");
    expect(out).not.toContain("PERIOD-LABEL");
    expect(out).toContain("MTD-LABEL");
  });

  it("adds the same-month note (Fix 3) when a combinedTotalNote is passed", () => {
    // Needs a real <p:graphicFrame>-wrapped table (unlike buildFixtureTable's
    // simplified <p:sp> wrapper) since insertCombinedTotalNote anchors the
    // note off the table's actual graphicFrame position.
    const xml = buildSlideWithGraphicFrameFixture();
    const out = buildTableSlideXml(
      { xml, rels: "" },
      periodRow,
      mtdRow,
      headers,
      "WEEKLY",
      "* Previous month shows complete July data. MTD shows July data through last campaign activity.",
    );
    expect(out).toContain("Previous month shows complete July data");
  });

  it("adds no note when combinedTotalNote is null (different months, Monthly report, or no Previous Month Data)", () => {
    const xml = buildFixtureTable();
    const out = buildTableSlideXml({ xml, rels: "" }, periodRow, mtdRow, headers, "WEEKLY", null);
    expect(out).not.toContain("Combined Total Note");
  });
});

/** A single cell with a realistic <a:tcPr>: a border-line fill (lnB) followed by the cell's own trailing background fill — the same shape as templates/dark.pptx's real cells, needed to test that only the background (not the border) gets overridden. */
function cellXmlWithFill(placeholder: string, bgColor = "0D1B2E"): string {
  return (
    `<a:tc><a:tcPr><a:lnB><a:solidFill><a:srgbClr val="000000"/></a:solidFill></a:lnB>` +
    `<a:solidFill><a:srgbClr val="${bgColor}"/></a:solidFill></a:tcPr>` +
    `<a:txBody><a:bodyPr/><a:p><a:r><a:rPr sz="1400" b="0"/><a:t>${placeholder}</a:t></a:r></a:p></a:txBody></a:tc>`
  );
}

function buildFixtureTableWithFills(): string {
  const trs = Array.from({ length: EXPECTED_ROWS }, (_, r) => {
    const tcs = Array.from({ length: NATIVE_COLS }, (_, c) => cellXmlWithFill(`R${r}C${c}`)).join("");
    return `<a:tr h="200000">${tcs}</a:tr>`;
  }).join("");
  const gridCols = Array.from({ length: NATIVE_COLS }, () => `<a:gridCol w="100000"/>`).join("");
  return `<p:sp><a:tbl><a:tblGrid>${gridCols}</a:tblGrid>${trs}</a:tbl></p:sp>`;
}

describe("fillCombinedTotalTable — Fix 4: Previous Month row background", () => {
  it("overrides only row 1's (Previous Month) cell background, leaving the header and MTD rows untouched", () => {
    const xml = buildFixtureTableWithFills();
    const grid = grid3x10((r, c) => `V${r}-${c}`);
    const out = fillCombinedTotalTable(xml, grid);

    const rows = out.split(/(?=<a:tr)/).filter((s) => s.startsWith("<a:tr"));
    expect(rows).toHaveLength(3);
    expect((rows[1].match(/<a:srgbClr val="111F35"\/>/g) || []).length).toBe(NATIVE_COLS);
    expect(rows[0]).not.toContain("111F35");
    expect(rows[2]).not.toContain("111F35");
    expect((rows[0].match(/<a:srgbClr val="0D1B2E"\/>/g) || []).length).toBe(NATIVE_COLS);
    expect((rows[2].match(/<a:srgbClr val="0D1B2E"\/>/g) || []).length).toBe(NATIVE_COLS);
  });

  it("leaves each cell's border-line fill (lnB) untouched — only the trailing background solidFill is replaced", () => {
    const xml = buildFixtureTableWithFills();
    const grid = grid3x10((r, c) => `V${r}-${c}`);
    const out = fillCombinedTotalTable(xml, grid);
    const rows = out.split(/(?=<a:tr)/).filter((s) => s.startsWith("<a:tr"));
    expect((rows[1].match(/<a:srgbClr val="000000"\/>/g) || []).length).toBe(NATIVE_COLS);
  });
});

/** A minimal but structurally realistic slide: the table wrapped in a real <p:graphicFrame> (with an <a:off>, unlike buildFixtureTable's simplified <p:sp> wrapper), itself inside <p:spTree> — what insertCombinedTotalNote actually needs to anchor the note below the table. */
function buildSlideWithGraphicFrameFixture(offX = 480029, offY = 1488365, rowH = 648000): string {
  const trs = Array.from({ length: EXPECTED_ROWS }, (_, r) => {
    const tcs = Array.from({ length: NATIVE_COLS }, (_, c) => cellXml(`R${r}C${c}`)).join("");
    return `<a:tr h="${rowH}">${tcs}</a:tr>`;
  }).join("");
  const gridCols = Array.from({ length: NATIVE_COLS }, () => `<a:gridCol w="100000"/>`).join("");
  const tbl = `<a:tbl><a:tblGrid>${gridCols}</a:tblGrid>${trs}</a:tbl>`;
  const graphicFrame =
    `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="1" name="Table"/></p:nvGraphicFramePr>` +
    `<p:xfrm><a:off x="${offX}" y="${offY}"/><a:ext cx="3000000" cy="3000000"/></p:xfrm>` +
    `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">${tbl}</a:graphicData></a:graphic></p:graphicFrame>`;
  return `<p:spTree><p:nvGrpSpPr/>${graphicFrame}</p:spTree>`;
}

describe("insertCombinedTotalNote (Fix 3)", () => {
  const noteText = "* Previous month shows complete July data. MTD shows July data through last campaign activity.";

  it("inserts a note textbox containing the given text", () => {
    const xml = buildSlideWithGraphicFrameFixture();
    const out = insertCombinedTotalNote(xml, noteText);
    expect(out).toContain("Previous month shows complete July data");
  });

  it("positions the note near the bottom of the slide, aligned with the table's left edge — not immediately below the table's nominal height", () => {
    // Anchoring off the table's declared row heights (h="...") was tried
    // first and rejected: PowerPoint/LibreOffice both auto-expand a row
    // taller than its nominal height when text wraps to multiple lines,
    // which the longer Fix 1/2 labels do — confirmed by actually rendering
    // a .pptx through LibreOffice, where that approach put the note
    // overlapping the table. Anchoring near the slide's bottom edge avoids
    // depending on the table's exact rendered height at all.
    const offX = 480029;
    const offY = 1488365;
    const rowH = 648000;
    const xml = buildSlideWithGraphicFrameFixture(offX, offY, rowH);
    const out = insertCombinedTotalNote(xml, noteText);
    const offMatch = /Combined Total Note"\/><p:cNvSpPr[\s\S]*?<a:off x="(\d+)" y="(\d+)"/.exec(out);
    expect(offMatch).not.toBeNull();
    const [, noteX, noteY] = offMatch!;
    expect(parseInt(noteX, 10)).toBe(offX);
    // Well past even a generously-expanded table, and short of the
    // template's known 6858000 EMU slide height.
    expect(parseInt(noteY, 10)).toBeGreaterThan(offY + rowH * EXPECTED_ROWS);
    expect(parseInt(noteY, 10)).toBeLessThan(6858000);
  });

  it("inserts the note as the last shape before </p:spTree>", () => {
    const xml = buildSlideWithGraphicFrameFixture();
    const out = insertCombinedTotalNote(xml, noteText);
    const noteIndex = out.indexOf("Combined Total Note");
    const closeIndex = out.indexOf("</p:spTree>");
    expect(noteIndex).toBeGreaterThan(-1);
    expect(noteIndex).toBeLessThan(closeIndex);
  });

  it("escapes special XML characters in the note text", () => {
    const xml = buildSlideWithGraphicFrameFixture();
    const out = insertCombinedTotalNote(xml, "A & B < C");
    expect(out).toContain("A &amp; B &lt; C");
  });

  it("throws when there's no <a:tbl> to anchor the note below", () => {
    expect(() => insertCombinedTotalNote("<p:spTree></p:spTree>", noteText)).toThrow(/<a:tbl>/);
  });

  it("throws when the table has no enclosing <p:graphicFrame>", () => {
    const bareTable = `<p:spTree>${buildFixtureTable()}</p:spTree>`;
    expect(() => insertCombinedTotalNote(bareTable, noteText)).toThrow(/graphicFrame/);
  });
});
