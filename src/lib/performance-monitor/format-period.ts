/** Calendar dates are property-local labels, never converted to browser time. */
export function formatMetaPeriod(startIso: string, endIso: string) {
  const start = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(`${endIso}T00:00:00Z`);
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const format = (date: Date, year: boolean) =>
    new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      ...(year ? { year: "numeric" as const } : {}),
      timeZone: "UTC",
    }).format(date);
  return startIso === endIso
    ? format(start, true)
    : `${format(start, !sameYear)} – ${format(end, true)}`;
}
