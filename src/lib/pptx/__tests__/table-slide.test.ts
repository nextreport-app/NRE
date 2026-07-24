import { describe, expect, it } from "vitest";
import { fillCombinedTotalTable } from "../table-slide";

const EXPECTED_ROWS = 3;
const EXPECTED_COLS = 10;

function cellXml(placeholder: string, sizePt = 1400): string {
  return `<a:tc><a:txBody><a:bodyPr/><a:p><a:r><a:rPr sz="${sizePt}" b="0"/><a:t>${placeholder}</a:t></a:r></a:p></a:txBody></a:tc>`;
}

/** A minimal but structurally realistic 3x10 table, one placeholder cell per position. */
function buildFixtureTable(rows = EXPECTED_ROWS, cols = EXPECTED_COLS): string {
  const trs = Array.from({ length: rows }, (_, r) => {
    const tcs = Array.from({ length: cols }, (_, c) => cellXml(`R${r}C${c}`)).join("");
    return `<a:tr h="200000">${tcs}</a:tr>`;
  }).join("");
  return `<p:sp><a:tbl><a:tblGrid/>${trs}</a:tbl></p:sp>`;
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
});
