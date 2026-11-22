export const SCHEDULE_CADENCES = [
  "DAILY",
  "WEEKLY",
  "FORTNIGHTLY",
  "MONTHLY",
] as const;
export type ScheduleCadence = (typeof SCHEDULE_CADENCES)[number];
export function cadenceLabel(cadence: string | null) {
  return (
    (
      {
        DAILY: "Daily",
        WEEKLY: "Weekly",
        FORTNIGHTLY: "Fortnightly",
        MONTHLY: "Monthly",
      } as Record<string, string>
    )[cadence ?? ""] ?? "Scheduled"
  );
}
export function scheduledReportType(cadence: ScheduleCadence) {
  return cadence === "WEEKLY" || cadence === "MONTHLY"
    ? cadence
    : "DAY_BREAKDOWN";
}
