export { countryPresentation as searchCountry } from "../country-presentation";
export function searchDate(iso: string, year = false) {
  return new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(year ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
}
export function searchDateRange(period: { startIso: string; endIso: string }) {
  const crossesYear = period.startIso.slice(0, 4) !== period.endIso.slice(0, 4);
  return `${searchDate(period.startIso, crossesYear)} – ${searchDate(period.endIso, true)}`;
}
export function searchClickShare(clicks: number, total: number) {
  return total > 0
    ? `${new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format((clicks / total) * 100)}%`
    : "—";
}
