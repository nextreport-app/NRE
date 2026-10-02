import { parseCsvText } from "../parse-csv";

/** Sum of the Results column in a Meta API sync CSV (after mapper, before or after manual merge). */
export function sumResultsInMetaSyncCsv(csvText: string): number {
  const { rows } = parseCsvText(csvText);
  let sum = 0;
  for (const row of rows) {
    sum += Number(row.results) || 0;
  }
  return sum;
}
