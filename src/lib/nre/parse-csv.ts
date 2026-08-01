import Papa from "papaparse";
import { readRowsWithAutoMap, type ColumnMap, type NreRow } from "./columns";

export interface ParsedCsv {
  colMap: ColumnMap;
  rows: NreRow[];
  headers: string[];
}

const CANDIDATE_DELIMITERS = [",", "\t", ";"] as const;

/**
 * Counts fields in a single line for a given delimiter, ignoring delimiters
 * inside double-quoted spans. This is a lightweight heuristic for DELIMITER
 * DETECTION only (not real parsing — Papa.parse does the actual, fully
 * correct parse once a delimiter is chosen), so it doesn't need to handle
 * escaped `""` inside quoted fields.
 */
function countFields(line: string, delimiter: string): number {
  let count = 1;
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === delimiter && !inQuotes) count++;
  }
  return count;
}

/**
 * Detects the delimiter that produces the most CONSISTENT column count
 * across sample lines (comma, tab, semicolon — the three real-world
 * delimiters Meta/Google exports use). "Consistent" beats "most columns":
 * a delimiter that never appears in the file trivially yields a perfectly
 * consistent count of 1, so single-column results are only accepted when no
 * multi-column delimiter is consistent at all.
 */
export function detectDelimiter(text: string): string {
  const sampleLines = text
    .split(/\r\n|\r|\n/)
    .map((l) => l.trim())
    .filter((l) => l !== "")
    .slice(0, 25);
  if (sampleLines.length === 0) return ",";

  let best = ",";
  let bestScore = -1;
  for (const delimiter of CANDIDATE_DELIMITERS) {
    const counts = sampleLines.map((line) => countFields(line, delimiter));
    const frequency = new Map<number, number>();
    counts.forEach((c) => frequency.set(c, (frequency.get(c) ?? 0) + 1));

    let modeCount = 0;
    let modeColumns = 0;
    for (const [columns, freq] of frequency) {
      if (freq > modeCount || (freq === modeCount && columns > modeColumns)) {
        modeCount = freq;
        modeColumns = columns;
      }
    }
    if (modeColumns <= 1) continue; // this delimiter never actually splits anything

    const consistency = modeCount / counts.length; // 0..1, fraction of lines matching the mode
    const score = consistency * 1000 + modeColumns; // consistency dominates; column count only tie-breaks
    if (score > bestScore) {
      bestScore = score;
      best = delimiter;
    }
  }
  return best;
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Delimiter-detection + raw split into headers/data rows, shared by
 * parseCsvText (Meta's column mapping) and google-columns.ts callers
 * (Google's own mapping) — column-dictionary mapping is deliberately NOT
 * done here, since platform detection (google-columns.ts's detectPlatform)
 * needs the raw headers FIRST, before either dictionary is picked.
 */
export function parseCsvHeadersAndRows(csvText: string): { headers: string[]; dataRows: string[][] } {
  const cleaned = stripBom(csvText);
  const delimiter = detectDelimiter(cleaned);

  const result = Papa.parse<string[]>(cleaned, {
    delimiter,
    skipEmptyLines: true,
  });

  const data = result.data;
  if (!data || data.length === 0) return { headers: [], dataRows: [] };
  return { headers: data[0], dataRows: data.slice(1) };
}

/** Parses raw CSV/TSV text (as downloaded from Meta/Google Ads Manager) into auto-mapped rows. */
export function parseCsvText(csvText: string): ParsedCsv {
  const { headers, dataRows } = parseCsvHeadersAndRows(csvText);
  if (headers.length === 0) return { colMap: {}, rows: [], headers: [] };
  const { colMap, rows } = readRowsWithAutoMap(headers, dataRows);
  return { colMap, rows, headers };
}
