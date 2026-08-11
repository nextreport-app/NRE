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
 * layer's grid (see report-data.ts's buildCombinedTotalTableGrid) says to.
 * The template's table must always be exactly 3 rows by NATIVE_COLS columns
 * and every cell must have a run to fill — that's validated (and enforced
 * with a thrown error) BEFORE any row/column is hidden or grown, so a shape
 * mismatch fails loudly at generation time instead of quietly dropping a
 * column.
 *
 * Column count is otherwise dynamic, not fixed at NATIVE_COLS: when the data
 * has fewer than 2 objectives, `hideColIndexes` removes the unused result
 * pair (same as always). When it has 3 or more (Fix 1 — no objective should
 * ever be dropped, however many are running simultaneously), the table
 * GROWS past its native width instead: the last result-column pair is
 * cloned as many extra times as needed, in both <a:tblGrid> and every row,
 * and every column's width is then rescaled so the table's total width is
 * unchanged — just spread across more, narrower columns — rather than
 * overflowing the slide.
 */

import { escapeXmlText } from "./ooxml";

const EXPECTED_ROWS = 3;
/** The template's own physical column count — the grid can ask for more (grown) or fewer (hidden), but this is what's actually baked into templates/dark.pptx. */
const NATIVE_COLS = 10;
const STATIC_COLS = 6;

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

/**
 * Overrides (or inserts) the sz="..." attribute — hundredths of a point,
 * e.g. 900 = 9pt — on an <a:rPr> block's opening tag. Handles both the
 * self-closing (<a:rPr .../>) and open/close (<a:rPr ...>...</a:rPr>) forms;
 * only the opening tag's attributes are touched, so any children (e.g. a
 * <a:solidFill> color override) survive untouched. A no-op when `rPrXml`
 * has no <a:rPr> at all (a run with fully inherited/default properties).
 */
function setRunFontSize(rPrXml: string, sizeHundredths: number): string {
  const openTagMatch = /<a:rPr\b[^>]*>/.exec(rPrXml);
  if (!openTagMatch) return rPrXml;
  const openTag = openTagMatch[0];
  const newOpenTag = /\bsz="\d+"/.test(openTag)
    ? openTag.replace(/\bsz="\d+"/, `sz="${sizeHundredths}"`)
    : openTag.replace(/^<a:rPr\b/, `<a:rPr sz="${sizeHundredths}"`);
  return rPrXml.slice(0, openTagMatch.index) + newOpenTag + rPrXml.slice(openTagMatch.index + openTag.length);
}

function setCellText(
  cellXml: string,
  value: string,
  rowIndex: number,
  colIndex: number,
  fontSizeHundredths?: number,
): string {
  const runRegex = /<a:r>((?:(?!<\/a:r>)[\s\S])*?)<a:t>[^<]*<\/a:t><\/a:r>/;
  const match = runRegex.exec(cellXml);
  if (!match) {
    throw new Error(
      `Combined Total table cell [row ${rowIndex}, col ${colIndex}] has no text run to fill (tried to write "${value}") — the template's table structure has changed.`,
    );
  }
  const rPrBlock = fontSizeHundredths ? setRunFontSize(match[1] ?? "", fontSizeHundredths) : (match[1] ?? "");
  const lines = String(value).split("\n");
  const runs = lines.map((line) => `<a:r>${rPrBlock}<a:t>${escapeXmlText(line)}</a:t></a:r>`).join("<a:br/>");
  return cellXml.slice(0, match.index) + runs + cellXml.slice(match.index + match[0].length);
}

/**
 * Fills only the first `values.length` cells of the row, left to right —
 * NOT necessarily every cell physically in the row. When the grid is
 * narrower than the row's current cell count (fewer than 2 objectives, no
 * growth happened), the untouched trailing cells are exactly the ones
 * `hideColIndexes` removes right afterward, so their stale placeholder
 * content never matters. When the grid matches or exceeds the row's native
 * width (2 objectives, or 3+ after growing), this fills every cell.
 *
 * `fontSizeHundredths`, when given, overrides every cell's font size in
 * this row (used only for the header row when 3+ objective pairs are
 * present — see fillCombinedTotalTable's column-overflow handling).
 */
function fillRow(rowXml: string, values: string[], rowIndex: number, fontSizeHundredths?: number): string {
  const cells = findSpans(rowXml, /<a:tc[\s\S]*?<\/a:tc>/g);
  if (values.length > cells.length) {
    throw new Error(
      `Combined Total table row ${rowIndex} needs ${values.length} columns but only has ${cells.length} at fill time.`,
    );
  }

  let out = rowXml;
  // Right-to-left so each cell's stored [start, end) offset is still valid
  // for every earlier (lower-indexed) cell not yet processed.
  for (let c = values.length - 1; c >= 0; c--) {
    const cell = cells[c];
    const filled = setCellText(cell.xml, values[c], rowIndex, c, fontSizeHundredths);
    out = out.slice(0, cell.start) + filled + out.slice(cell.end);
  }
  return out;
}

/**
 * Column-overflow fix: when the header row has to grow to fit 3+ objective
 * pairs (see the file header for the growth mechanism), plain full-length
 * labels/cost-labels start crowding and overflowing their narrower columns.
 * Abbreviated only for the specific labels product owner called out — every
 * other label (including all 6 static headers) passes through unchanged.
 * Applied ONLY to the header row's text, never the data rows' own numbers.
 */
const HEADER_ABBREVIATIONS: Record<string, string> = {
  "WEBSITE LEADS": "WEB LEADS",
  "META FORM LEADS": "FORM LEADS",
  "COST PER WEBSITE LEAD": "CPW LEAD",
  "COST PER LEAD": "CP LEAD",
  "COST PER 1K REACH": "CP 1K REACH",
  "LANDING PAGE VIEWS": "LP VIEWS",
  "COST PER LPV": "CP LPV",
};

function abbreviateHeaderRow(headerRow: string[]): string[] {
  return headerRow.map((cell) => HEADER_ABBREVIATIONS[cell] ?? cell);
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

/** Sum of every <a:gridCol>'s width in `tblGridXml`. */
function totalGridWidth(tblGridXml: string): number {
  const cols = findSpans(tblGridXml, /<a:gridCol[^/]*\/>/g);
  return cols.reduce((sum, c) => {
    const m = /w="(\d+)"/.exec(c.xml);
    return sum + (m ? parseInt(m[1], 10) : 0);
  }, 0);
}

/** Appends `extraPairs` clones of the LAST TWO <a:gridCol> entries (the last result-column pair) to `tblGridXml`. */
function cloneLastGridColumnPair(tblGridXml: string, extraPairs: number): string {
  const cols = findSpans(tblGridXml, /<a:gridCol[^/]*\/>/g);
  const lastPairXml = cols[cols.length - 2].xml + cols[cols.length - 1].xml;
  const insertAt = cols[cols.length - 1].end;
  return tblGridXml.slice(0, insertAt) + lastPairXml.repeat(extraPairs) + tblGridXml.slice(insertAt);
}

/** Appends `extraPairs` clones of the LAST TWO <a:tc> cells (the last result-column pair) to one row, reusing that row's own styling. */
function cloneLastColumnPairInRow(rowXml: string, extraPairs: number): string {
  const cells = findSpans(rowXml, /<a:tc[\s\S]*?<\/a:tc>/g);
  const lastPairXml = cells[cells.length - 2].xml + cells[cells.length - 1].xml;
  const insertAt = cells[cells.length - 1].end;
  return rowXml.slice(0, insertAt) + lastPairXml.repeat(extraPairs) + rowXml.slice(insertAt);
}

/** Rescales every <a:gridCol> width proportionally so the columns' total width equals `targetTotalWidth` — used after growing the table so it doesn't overflow the slide. */
function rescaleGridColumnsToWidth(tblGridXml: string, targetTotalWidth: number): string {
  const cols = findSpans(tblGridXml, /<a:gridCol[^/]*\/>/g);
  const currentTotal = cols.reduce((sum, c) => {
    const m = /w="(\d+)"/.exec(c.xml);
    return sum + (m ? parseInt(m[1], 10) : 0);
  }, 0);
  if (currentTotal === 0) return tblGridXml;
  const scale = targetTotalWidth / currentTotal;

  let out = tblGridXml;
  for (let i = cols.length - 1; i >= 0; i--) {
    const m = /w="(\d+)"/.exec(cols[i].xml);
    const w = m ? parseInt(m[1], 10) : 0;
    const newWidth = Math.max(1, Math.round(w * scale));
    const replacement = cols[i].xml.replace(/w="\d+"/, `w="${newWidth}"`);
    out = out.slice(0, cols[i].start) + replacement + out.slice(cols[i].end);
  }
  return out;
}

export interface TableVisibilityOptions {
  /** 0-indexed row(s) to remove entirely after filling — e.g. the Period row when there's no Previous Month Data. */
  hideRowIndexes?: number[];
  /** 0-indexed column(s) to remove entirely after filling, with freed width redistributed across what remains — e.g. the second result-type columns when there's only one objective. Mutually exclusive with growing (see the file header) — only meaningful when the grid is narrower than NATIVE_COLS. */
  hideColIndexes?: number[];
  /** Selects the Previous Month row's highlight fill (see PERIOD_ROW_FILL_HEX below) — the dark-theme shade reads as a near-invisible near-black smudge against the light template's own light card background, so the light template needs its own, lighter shade. Defaults to false (the original dark-template shade), matching every existing caller. */
  isLightTemplate?: boolean;
}

/**
 * Fills the Combined Total table's 3-row grid by position, then optionally
 * hides specific rows/columns, or grows the table when `grid` is wider than
 * the template's native column count. `grid` must be produced by
 * report-data.ts's buildCombinedTotalTableGrid.
 */
export function fillCombinedTotalTable(
  xml: string,
  grid: string[][],
  options: TableVisibilityOptions = {},
): string {
  const targetCols = grid[0]?.length ?? 0;
  // Column-overflow fix: 3 objective pairs (12 total columns, already past
  // the template's native 10) shrinks the header font to keep labels
  // readable; 4+ (never produced by report-data.ts's own 3-pair cap, but
  // this function accepts any grid shape) shrinks it further still.
  const objectivePairCount = (targetCols - STATIC_COLS) / 2;
  const headerFontSizeHundredths = objectivePairCount >= 4 ? 800 : objectivePairCount === 3 ? 900 : undefined;
  const validShape =
    grid.length === EXPECTED_ROWS &&
    grid.every((row) => row.length === targetCols) &&
    targetCols >= STATIC_COLS + 2 &&
    (targetCols - STATIC_COLS) % 2 === 0;
  if (!validShape) {
    throw new Error(
      `Combined Total table grid must be ${EXPECTED_ROWS} rows, each with ${STATIC_COLS} + an even number ` +
        `(2 or more) of result columns — got ${grid.length} row(s)` +
        (grid[0] ? `, ${grid[0].length} column(s) in the first row` : "") +
        ".",
    );
  }

  const tblMatch = /<a:tbl>[\s\S]*?<\/a:tbl>/.exec(xml);
  if (!tblMatch) throw new Error("Combined Total slide template has no <a:tbl> element to fill.");

  const nativeRows = findSpans(tblMatch[0], /<a:tr[^>]*>[\s\S]*?<\/a:tr>/g);
  if (nativeRows.length !== EXPECTED_ROWS) {
    throw new Error(
      `Combined Total table must have ${EXPECTED_ROWS} rows in the template, found ${nativeRows.length}.`,
    );
  }
  const nativeCells = findSpans(nativeRows[0].xml, /<a:tc[\s\S]*?<\/a:tc>/g);
  if (nativeCells.length !== NATIVE_COLS) {
    throw new Error(
      `Combined Total table must have ${NATIVE_COLS} columns in the template, found ${nativeCells.length}.`,
    );
  }

  let newTbl = tblMatch[0];

  // Grow beyond the template's native column count when 3+ objectives exist
  // (targetCols > NATIVE_COLS) — clone the last result-column pair as many
  // extra times as needed, in <a:tblGrid> and every row, then rescale every
  // column's width so the table's total width is unchanged (Fix 1: no
  // objective should ever be dropped, however many are running at once).
  if (targetCols > NATIVE_COLS) {
    const extraPairs = (targetCols - NATIVE_COLS) / 2;
    const gridMatch = /<a:tblGrid>[\s\S]*?<\/a:tblGrid>/.exec(newTbl);
    if (!gridMatch) throw new Error("Combined Total table template has no <a:tblGrid> to grow.");
    const originalTotalWidth = totalGridWidth(gridMatch[0]);
    let newGrid = cloneLastGridColumnPair(gridMatch[0], extraPairs);
    newGrid = rescaleGridColumnsToWidth(newGrid, originalTotalWidth);
    newTbl = newTbl.slice(0, gridMatch.index) + newGrid + newTbl.slice(gridMatch.index + gridMatch[0].length);

    // Re-locate rows: string offsets shifted after editing <a:tblGrid> above.
    const rowsToGrow = findSpans(newTbl, /<a:tr[^>]*>[\s\S]*?<\/a:tr>/g);
    let grown = newTbl;
    for (let r = rowsToGrow.length - 1; r >= 0; r--) {
      const row = rowsToGrow[r];
      const grownRow = cloneLastColumnPairInRow(row.xml, extraPairs);
      grown = grown.slice(0, row.start) + grownRow + grown.slice(row.end);
    }
    newTbl = grown;
  }

  // Fill exactly grid[r].length cells of each row — its full native width
  // when the grid is 8-10 columns wide (nothing left over), or the grown
  // width when it's wider. When the grid is narrower than 10 (1 objective),
  // the untouched trailing native cells are removed next by hideColIndexes.
  // Row 0 (the header) gets abbreviated labels + a smaller font once space
  // is genuinely tight (3+ objective pairs) — rows 1-2 (Period/MTD data)
  // keep their plain numbers/currency at the template's own font size.
  const rowsToFill = findSpans(newTbl, /<a:tr[^>]*>[\s\S]*?<\/a:tr>/g);
  for (let r = EXPECTED_ROWS - 1; r >= 0; r--) {
    const row = rowsToFill[r];
    const isHeaderRow = r === 0;
    const rowValues = isHeaderRow && objectivePairCount >= 3 ? abbreviateHeaderRow(grid[r]) : grid[r];
    const filled = fillRow(row.xml, rowValues, r, isHeaderRow ? headerFontSizeHundredths : undefined);
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

  // Fix 4: give the Previous Month row (index 1) a slightly lighter
  // background than the MTD row below it, so the two are visually
  // distinguishable even before reading the labels — applied after
  // growing/hiding columns above so it covers whatever cells the row
  // actually ends up with, not just its native 10.
  const rowsForFill = findSpans(newTbl, /<a:tr[^>]*>[\s\S]*?<\/a:tr>/g);
  if (rowsForFill[1]) {
    const fillHex = options.isLightTemplate ? PERIOD_ROW_FILL_HEX_LIGHT : PERIOD_ROW_FILL_HEX;
    const filledRow = setRowCellFill(rowsForFill[1].xml, fillHex);
    newTbl = newTbl.slice(0, rowsForFill[1].start) + filledRow + newTbl.slice(rowsForFill[1].end);
  }

  const hideRows = options.hideRowIndexes ?? [];
  if (hideRows.length > 0) {
    const rowsToRemove = findSpans(newTbl, /<a:tr[^>]*>[\s\S]*?<\/a:tr>/g);
    newTbl = removeSpans(newTbl, rowsToRemove, hideRows);
  }

  return xml.slice(0, tblMatch.index) + newTbl + xml.slice(tblMatch.index + tblMatch[0].length);
}

/** Previous Month row background (Fix 4) — one shade lighter than the template's own #0d1b2e dark navy, matching the app's own --color-navy-panel token. */
const PERIOD_ROW_FILL_HEX = "111F35";
/** Light-template equivalent — reuses the light template's own spec'd card-border color (#f0d9b5) rather than inventing an unspec'd new shade, giving the row a warm tint that's still readable against the white card background. */
const PERIOD_ROW_FILL_HEX_LIGHT = "F0D9B5";

/**
 * Overrides the background fill of every cell in a row. A cell's <a:tcPr>
 * has one <a:solidFill> per border line (lnL/lnR/lnT/lnB) plus exactly one
 * more for the cell's own background — always the LAST direct child of
 * <a:tcPr>, appearing right before its closing tag — so replacing the last
 * <a:solidFill> match reliably targets the background without disturbing
 * any border styling.
 */
function setRowCellFill(rowXml: string, hexColor: string): string {
  const cells = findSpans(rowXml, /<a:tc[\s\S]*?<\/a:tc>/g);
  let out = rowXml;
  for (let i = cells.length - 1; i >= 0; i--) {
    const cell = cells[i];
    const tcPrMatch = /<a:tcPr[^>]*>[\s\S]*?<\/a:tcPr>/.exec(cell.xml);
    if (!tcPrMatch) continue;
    const fills = [...tcPrMatch[0].matchAll(/<a:solidFill>[\s\S]*?<\/a:solidFill>/g)];
    if (fills.length === 0) continue;
    const lastFill = fills[fills.length - 1];
    const fillStart = lastFill.index as number;
    const newTcPr =
      tcPrMatch[0].slice(0, fillStart) +
      `<a:solidFill><a:srgbClr val="${hexColor}"/></a:solidFill>` +
      tcPrMatch[0].slice(fillStart + lastFill[0].length);
    const newCellXml = cell.xml.slice(0, tcPrMatch.index) + newTcPr + cell.xml.slice(tcPrMatch.index + tcPrMatch[0].length);
    out = out.slice(0, cell.start) + newCellXml + out.slice(cell.end);
  }
  return out;
}

