/** Escapes a CSV cell value (quotes when needed). */
function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Serializes a header row + data rows into UTF-8 CSV text. */
export function rowsToCsv(headers: string[], dataRows: string[][]): string {
  const lines = [
    headers.map(escapeCsvCell).join(","),
    ...dataRows.map((row) => headers.map((_, i) => escapeCsvCell(row[i] ?? "")).join(",")),
  ];
  return lines.join("\n");
}

/** Formats a calendar date as DD-MM-YYYY (matches common Meta/Google CSV exports). */
export function formatDayForCsv(year: number, month: number, day: number): string {
  return `${String(day).padStart(2, "0")}-${String(month).padStart(2, "0")}-${year}`;
}

/** Parses YYYY-MM-DD into DD-MM-YYYY for CSV output. */
export function isoToCsvDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return formatDayForCsv(y, m, d);
}
