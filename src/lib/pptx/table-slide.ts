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
 * to. The template's table must always be exactly 3 rows by 10 columns and
 * every cell must have a run to fill — that's validated (and enforced with
 * a thrown error) BEFORE any row/column is hidden, so a shape mismatch
 * fails loudly at generation time instead of quietly dropping a column.
 * Hiding a row/column (see `TableVisibilityOptions`) is a deliberate,
 * data-driven choice applied only after every cell has been correctly
 * filled against the full fixed shape.
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

/** Removes the spans at the given indexes, right-to-left so earlier offsets stay valid. */
function removeSpans(xml: string, spans: Span[], indexesToRemove: number[]): string {
  const toRemove = new Set(indexesToRemove);
  let out = xml;
  for (let i = spans.length - 1; i >= 0; i--) {
    if (toRemove.has(i)) out = out.slice(0, spans[i].start) + out.slice(spans[i].end);
  }
  return out;
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

/** Removes the given 0-indexed columns from one row's cells. */
function removeColumnsFromRow(rowXml: string, colIndexes: number[]): string {
  const cells = findSpans(rowXml, /<a:tc[\s\S]*?<\/a:tc>/g);
  return removeSpans(rowXml, cells, colIndexes);
}

/**
 * Removes the given 0-indexed columns from <a:tblGrid> and redistributes
 * their freed width evenly across whatever columns remain, so the table
 * still fills its original total width instead of leaving a blank gap.
 */
function removeGridColumns(tblGridXml: string, colIndexes: number[]): string {
  const cols = findSpans(tblGridXml, /<a:gridCol[^/]*\/>/g);
  const totalWidth = cols.reduce((sum, c) => {
    const m = /w="(\d+)"/.exec(c.xml);
    return sum + (m ? parseInt(m[1], 10) : 0);
  }, 0);
  const remainingCount = cols.length - colIndexes.length;
  const newWidth = remainingCount > 0 ? Math.round(totalWidth / remainingCount) : 0;
  const removeSet = new Set(colIndexes);

  let out = tblGridXml;
  for (let i = cols.length - 1; i >= 0; i--) {
    const replacement = removeSet.has(i) ? "" : `<a:gridCol w="${newWidth}"/>`;
    out = out.slice(0, cols[i].start) + replacement + out.slice(cols[i].end);
  }
  return out;
}

export interface TableVisibilityOptions {
  /** 0-indexed row(s) to remove entirely after filling — e.g. the Period row when there's no Period CSV data. */
  hideRowIndexes?: number[];
  /** 0-indexed column(s) to remove entirely after filling, with freed width redistributed across what remains — e.g. the second result-type columns when there's only one objective. */
  hideColIndexes?: number[];
}

/**
 * Fills the Combined Total table's exactly-3-rows-by-10-columns grid by
 * position, then optionally hides specific rows/columns. `grid` must be
 * produced by report-data.ts's buildCombinedTotalTableGrid.
 */
export function fillCombinedTotalTable(
  xml: string,
  grid: string[][],
  options: TableVisibilityOptions = {},
): string {
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

  // Fill every cell first, always against the full fixed 3x10 template shape
  // — hiding happens only afterward, as a presentation-layer decision.
  let newTbl = tblMatch[0];
  for (let r = EXPECTED_ROWS - 1; r >= 0; r--) {
    const row = rows[r];
    const filled = fillRow(row.xml, grid[r], r);
    newTbl = newTbl.slice(0, row.start) + filled + newTbl.slice(row.end);
  }

  const hideCols = options.hideColIndexes ?? [];
  if (hideCols.length > 0) {
    const gridMatch = /<a:tblGrid>[\s\S]*?<\/a:tblGrid>/.exec(newTbl);
    if (gridMatch) {
      const newGrid = removeGridColumns(gridMatch[0], hideCols);
      newTbl = newTbl.slice(0, gridMatch.index) + newGrid + newTbl.slice(gridMatch.index + gridMatch[0].length);
    }
    // Re-locate rows: string offsets shifted after editing <a:tblGrid> above.
    const rowsAfterGridEdit = findSpans(newTbl, /<a:tr[^>]*>[\s\S]*?<\/a:tr>/g);
    let out = newTbl;
    for (let r = rowsAfterGridEdit.length - 1; r >= 0; r--) {
      const row = rowsAfterGridEdit[r];
      const newRowXml = removeColumnsFromRow(row.xml, hideCols);
      out = out.slice(0, row.start) + newRowXml + out.slice(row.end);
    }
    newTbl = out;
  }

  const hideRows = options.hideRowIndexes ?? [];
  if (hideRows.length > 0) {
    const rowsToRemove = findSpans(newTbl, /<a:tr[^>]*>[\s\S]*?<\/a:tr>/g);
    newTbl = removeSpans(newTbl, rowsToRemove, hideRows);
  }

  return xml.slice(0, tblMatch.index) + newTbl + xml.slice(tblMatch.index + tblMatch[0].length);
}
