/** Reserve a row for account totals and balance pages without shrinking type. */
export function comparisonSummaryPages<T>(campaigns: readonly T[]): { campaigns: T[]; includeTotal: boolean }[] {
  const rowCount = campaigns.length + 1;
  const count = Math.ceil(rowCount / 3);
  const size = Math.floor(rowCount / count);
  const remainder = rowCount % count;
  let start = 0;
  return Array.from({ length: count }, (_, index) => {
    const end = start + size + (index < remainder ? 1 : 0);
    const page = { campaigns: campaigns.slice(start, Math.min(end, campaigns.length)), includeTotal: end > campaigns.length };
    start = end;
    return page;
  });
}
