import { parseCsvText } from "../parse-csv";

/** Sum of numeric Results cells — matches Ads Manager export "Results" column. */
export function sumResultsColumnInCsv(csvText: string): number {
  const { rows } = parseCsvText(csvText);
  let total = 0;
  for (const row of rows) {
    const n = Number(row.results);
    if (Number.isFinite(n) && n > 0) total += n;
  }
  return total;
}
