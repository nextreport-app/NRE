import { describe, expect, it } from "vitest";
import { fillCombinedTotalTable } from "../table-slide";

const EXPECTED_ROWS = 3;
const EXPECTED_COLS = 10;

function cellXml(placeholder: string, sizePt = 1400): string {
  return `<a:tc><a:txBody><a:bodyPr/><a:p><a:r><a:rPr sz="${sizePt}" b="0"/><a:t>${placeholder}</a:t></a:r></a:p></a:txBody></a:tc>`;
}

/** A minimal but structurally realistic 3x10 table, one placeholder cell per position. */
function buildFixtureTable(rows = EXPECTED_ROWS, cols = EXPECTED_COLS, colWidth = 100000): string {
  const trs = Array.from({ length: rows }, (_, r) => {
    const tcs = Array.from({ length: cols }, (_, c) => cellXml(`R${r}C${c}`)).join("");
    return `<a:tr h="200000">${tcs}</a:tr>`;
  }).join("");
  const gridCols = Array.from({ length: cols }, () => `<a:gridCol w="${colWidth}"/>`).join("");
  return `<p:sp><a:tbl><a:tblGrid>${gridCols}</a:tblGrid>${trs}</a:tbl></p:sp>`;
}

function grid3x10(fill: (r: number, c: number) => string): string[][] {
  return Array.from({ length: EXPECTED_ROWS }, (_, r) => Array.from({ length: EXPECTED_COLS }, (_, c) => fill(r, c)));
}

describe("fillCombinedTotalTable", () => {
  it("fills every one of the 3x10 cells at its exact position", () => {
    const xml = buildFixtureTable();
    const grid = grid3x10((r, c) => `V${r}-${c}`);
    const out = fillCombinedTotalTable(xml, grid);

    for (let r = 0; r < EXPECTED_ROWS; r++) {
      for (let c = 0; c < EXPECTED_COLS; c++) {
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
    expect((out.match(/sz="1400"/g) || []).length).toBe(EXPECTED_ROWS * EXPECTED_COLS);
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

  it("throws when the grid isn't exactly 3x10 — a shape mismatch fails loudly, not silently", () => {
    const xml = buildFixtureTable();
    expect(() => fillCombinedTotalTable(xml, grid3x10(() => "x").slice(0, 2))).toThrow(/3x10/);
    expect(() =>
      fillCombinedTotalTable(
        xml,
        grid3x10(() => "x").map((row) => row.slice(0, 9)),
      ),
    ).toThrow(/3x10/);
  });

  it("throws when the template has no <a:tbl> at all", () => {
    const grid = grid3x10(() => "x");
    expect(() => fillCombinedTotalTable("<p:sp>no table here</p:sp>", grid)).toThrow(/<a:tbl>/);
  });

  it("throws when the template's table doesn't have exactly 3 rows", () => {
    const xml = buildFixtureTable(2, EXPECTED_COLS);
    const grid = grid3x10(() => "x");
    expect(() => fillCombinedTotalTable(xml, grid)).toThrow(/3 rows/);
  });

  it("throws when a template row doesn't have exactly 10 columns", () => {
    const xml = buildFixtureTable(EXPECTED_ROWS, 8);
    const grid = grid3x10(() => "x");
    expect(() => fillCombinedTotalTable(xml, grid)).toThrow(/10 columns/);
  });

  it("throws when a cell has no run to hold text, instead of silently leaving it blank", () => {
    const brokenCell = "<a:tc><a:txBody><a:bodyPr/><a:p/></a:txBody></a:tc>"; // no <a:r> at all
    const goodCells = Array.from({ length: EXPECTED_COLS - 1 }, (_, c) => cellXml(`C${c}`)).join("");
    const row0 = `<a:tr h="200000">${brokenCell}${goodCells}</a:tr>`;
    const otherRows = Array.from({ length: EXPECTED_ROWS - 1 }, (_, r) => {
      const tcs = Array.from({ length: EXPECTED_COLS }, (_, c) => cellXml(`R${r + 1}C${c}`)).join("");
      return `<a:tr h="200000">${tcs}</a:tr>`;
    }).join("");
    const xml = `<p:sp><a:tbl><a:tblGrid/>${row0}${otherRows}</a:tbl></p:sp>`;
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
      const grid = grid3x10((r, c) => `V${r}-${c}`);
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
      const xml = buildFixtureTable(EXPECTED_ROWS, EXPECTED_COLS, 100000); // 10 cols x 100000 = 1,000,000 total
      const grid = grid3x10(() => "x");
      const out = fillCombinedTotalTable(xml, grid, { hideColIndexes: [8, 9] });
      // 1,000,000 spread across the remaining 8 columns = 125,000 each.
      const widths = [...out.matchAll(/<a:gridCol w="(\d+)"\/>/g)].map((m) => Number(m[1]));
      expect(widths).toEqual(Array(8).fill(125000));
    });

    it("applies both row and column hiding together", () => {
      const xml = buildFixtureTable();
      const grid = grid3x10((r, c) => `V${r}-${c}`);
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
});
