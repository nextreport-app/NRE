import Papa from "papaparse";
import { readRowsWithAutoMap, type ColumnMap, type NreRow } from "./columns";

export interface ParsedCsv {
  colMap: ColumnMap;
  rows: NreRow[];
  headers: string[];
}

/** Parses raw CSV text (as downloaded from Meta/Google Ads Manager) into auto-mapped rows. */
export function parseCsvText(csvText: string): ParsedCsv {
  const result = Papa.parse<string[]>(csvText, {
    skipEmptyLines: true,
  });

  const data = result.data;
  if (!data || data.length === 0) {
    return { colMap: {}, rows: [], headers: [] };
  }

  const headers = data[0];
  const dataRows = data.slice(1);
  const { colMap, rows } = readRowsWithAutoMap(headers, dataRows);
  return { colMap, rows, headers };
}
