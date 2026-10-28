import { parseCellNum } from "./format";

/** Combine one semantic rate using exported components or exported weighted observations. */
export function aggregateSourceRatio(
  rows: { _raw: Record<string, string> }[],
  numeratorHeader: string | undefined,
  denominatorHeader: string | undefined,
  rateHeader: string | undefined,
  scale = 1,
  additiveDenominator = true,
): number {
  const observed = (row: typeof rows[number], header: string | undefined) => header && String(row._raw[header] ?? "").trim() !== "";
  const sum = (header: string) => rows.reduce((total, row) => total + parseCellNum(row._raw[header]), 0);
  if (!additiveDenominator && rows.length > 1) return NaN;
  if (numeratorHeader && denominatorHeader) {
    const denominator = sum(denominatorHeader);
    return denominator > 0 ? sum(numeratorHeader) / denominator * scale : NaN;
  }
  if (denominatorHeader && !(sum(denominatorHeader) > 0)) return NaN;
  if (numeratorHeader && !denominatorHeader && sum(numeratorHeader) > 0 && rows.some(row => parseCellNum(row._raw[numeratorHeader]) > 0 && !(parseCellNum(row._raw[rateHeader ?? ""]) > 0))) return NaN;
  // A single exported observation does not need another column to be valid.
  if (rows.length === 1 && observed(rows[0], rateHeader)) return parseCellNum(rows[0]._raw[rateHeader!]);
  if (!rateHeader || !additiveDenominator) return NaN;
  let numerator = 0, denominator = 0;
  for (const row of rows) {
    if (denominatorHeader) {
      const weight = parseCellNum(row._raw[denominatorHeader]);
      if (weight > 0 && !observed(row, rateHeader)) return NaN;
      denominator += weight;
      numerator += weight * parseCellNum(row._raw[rateHeader]) / scale;
    } else if (numeratorHeader) {
      const value = parseCellNum(row._raw[numeratorHeader]);
      if (value > 0) {
        const rate = parseCellNum(row._raw[rateHeader]);
        if (!observed(row, rateHeader) || !(rate > 0)) return NaN;
        numerator += value;
        denominator += value / rate * scale;
      }
    } else return NaN;
  }
  return denominator > 0 ? numerator / denominator * scale : NaN;
}
