/**
 * Combined Total ("Campaign Overview") slide table filler.
 *
 * Replaces the old approach of scanning the whole slide for named
 * {{PERIOD_REACH}}-style tags one at a time, which had a structural
 * weakness: if a single tag's name ever drifted from what the data layer
 * produced (a template edit, a typo, anything), replaceTagRun's "not found"
 * case is silently swallowed — the literal, unfilled "{{TAG}}" text just
 * stays in the slide with no error, and that column *looks* broken or
 * missing depending on the viewer.
 *
 * This fills the table positionally instead: locate the <a:tbl>, walk its
 * rows and cells by index, and write into exactly the row/column the data
 * layer's 3x10 grid (see report-data.ts's buildCombinedTotalTableGrid) says
 * to. If the template's table isn't exactly 3 rows by 10 columns, or any
 * cell has no run to hold text, this throws immediately — a shape mismatch
 * fails loudly at generation time instead of quietly dropping a column.
 */

import { escapeXmlText } from "./ooxml";

const EXPECTED_ROWS = 3;
const EXPECTED_COLS = 10;

interface Span {
  xml: string;
  start: number;
  end: number;
}

function findSpans(xml: string, tagRegex: RegExp): Span[] {
  const spans: Span[] = [];
  let match: RegExpExecArray | null;
  while ((match = tagRegex.exec(xml))) {
    spans.push({ xml: match[0], start: match.index, end: match.index + match[0].length });
  }
  return spans;
}

function setCellText(cellXml: string, value: string, rowIndex: number, colIndex: number): string {
  const runRegex = /<a:r>((?:(?!<\/a:r>)[\s\S])*?)<a:t>[^<]*<\/a:t><\/a:r>/;
  const match = runRegex.exec(cellXml);
  if (!match) {
    throw new Error(
      `Combined Total table cell [row ${rowIndex}, col ${colIndex}] has no text run to fill (tried to write "${value}") — the template's table structure has changed.`,
    );
  }
  const rPrBlock = match[1] ?? "";
  const lines = String(value).split("\n");
  const runs = lines.map((line) => `<a:r>${rPrBlock}<a:t>${escapeXmlText(line)}</a:t></a:r>`).join("<a:br/>");
  return cellXml.slice(0, match.index) + runs + cellXml.slice(match.index + match[0].length);
}

function fillRow(rowXml: string, values: string[], rowIndex: number): string {
  const cells = findSpans(rowXml, /<a:tc[\s\S]*?<\/a:tc>/g);
  if (cells.length !== EXPECTED_COLS) {
    throw new Error(
      `Combined Total table row ${rowIndex} must have ${EXPECTED_COLS} columns in the template, found ${cells.length}.`,
    );
  }

  let out = rowXml;
  // Right-to-left so each cell's stored [start, end) offset is still valid
  // for every earlier (lower-indexed) cell not yet processed.
  for (let c = EXPECTED_COLS - 1; c >= 0; c--) {
    const cell = cells[c];
    const filled = setCellText(cell.xml, values[c], rowIndex, c);
    out = out.slice(0, cell.start) + filled + out.slice(cell.end);
  }
  return out;
}

/**
 * Fills the Combined Total table's exactly-3-rows-by-10-columns grid by
 * position. `grid` must be produced by report-data.ts's
 * buildCombinedTotalTableGrid — this function only validates and applies it.
 */
export function fillCombinedTotalTable(xml: string, grid: string[][]): string {
  if (grid.length !== EXPECTED_ROWS || grid.some((row) => row.length !== EXPECTED_COLS)) {
    throw new Error(
      `Combined Total table grid must be ${EXPECTED_ROWS}x${EXPECTED_COLS} — got ${grid.length} row(s)` +
        (grid[0] ? `, ${grid[0].length} column(s) in the first row` : "") +
        ".",
    );
  }

  const tblMatch = /<a:tbl>[\s\S]*?<\/a:tbl>/.exec(xml);
  if (!tblMatch) throw new Error("Combined Total slide template has no <a:tbl> element to fill.");

  const rows = findSpans(tblMatch[0], /<a:tr[^>]*>[\s\S]*?<\/a:tr>/g);
  if (rows.length !== EXPECTED_ROWS) {
    throw new Error(
      `Combined Total table must have ${EXPECTED_ROWS} rows in the template, found ${rows.length}.`,
    );
  }

  let newTbl = tblMatch[0];
  for (let r = EXPECTED_ROWS - 1; r >= 0; r--) {
    const row = rows[r];
    const filled = fillRow(row.xml, grid[r], r);
    newTbl = newTbl.slice(0, row.start) + filled + newTbl.slice(row.end);
  }

  return xml.slice(0, tblMatch.index) + newTbl + xml.slice(tblMatch.index + tblMatch[0].length);
}
