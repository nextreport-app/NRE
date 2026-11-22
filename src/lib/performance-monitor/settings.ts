import { z } from "zod";
import { reportCalendarYesterday } from "../nre/report-period-selection";
export const targetRuleSchema = z
  .object({
    objective: z.string().min(1).max(100),
    maxCpr: z.number().finite().positive().max(1e12).optional(),
    minRoas: z.number().finite().positive().max(10000).optional(),
  })
  .refine(
    (r) => !r.minRoas || /purchase/i.test(r.objective),
    "ROAS targets require a purchase objective.",
  );
export const targetRulesSchema = z
  .record(z.string().regex(/^\d+$/), targetRuleSchema)
  .refine(
    (r) => Object.keys(r).length <= 100,
    "Up to 100 campaign targets are supported.",
  );
export type CampaignTarget = z.infer<typeof targetRuleSchema>;
export interface DecisionSettings {
  performanceWindowDays?: number;
  performanceCustomStart?: string | null;
  performanceCustomEnd?: string | null;
  performanceTargetRules?: string | null;
}
export function decisionPeriods(
  timezone: string,
  settings: DecisionSettings = {},
  now = new Date(),
) {
  const yesterday = reportCalendarYesterday(now, timezone),
    shift = (iso: string, n: number) =>
      new Date(Date.parse(iso + "T12:00:00Z") + n * 86400000)
        .toISOString()
        .slice(0, 10);
  const valid = (iso: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(iso) &&
    Number.isFinite(Date.parse(iso + "T12:00Z")) &&
    new Date(iso + "T12:00Z").toISOString().slice(0, 10) === iso;
  let days = settings.performanceWindowDays ?? 7,
    end = yesterday;
  if (settings.performanceCustomStart || settings.performanceCustomEnd) {
    const start = settings.performanceCustomStart ?? "",
      customEnd = settings.performanceCustomEnd ?? "";
    if (
      !valid(start) ||
      !valid(customEnd) ||
      start > customEnd ||
      customEnd > yesterday
    )
      throw Error("Choose valid completed dates ending yesterday or earlier.");
    days = (Date.parse(customEnd) - Date.parse(start)) / 86400000 + 1;
    if (days > 31) throw Error("Choose a custom period of up to 31 days.");
    end = customEnd;
  } else if (![7, 15, 30].includes(days))
    throw Error("Choose last 7, 15 or 30 days.");
  return {
    periodA: { startIso: shift(end, 1 - days), endIso: end },
    periodB: { startIso: shift(end, 1 - days * 2), endIso: shift(end, -days) },
    days,
    custom: !!settings.performanceCustomStart,
  };
}
export function settingsEqual(a: DecisionSettings, b: DecisionSettings) {
  return (
    (a.performanceWindowDays ?? 7) === (b.performanceWindowDays ?? 7) &&
    (a.performanceCustomStart ?? null) === (b.performanceCustomStart ?? null) &&
    (a.performanceCustomEnd ?? null) === (b.performanceCustomEnd ?? null) &&
    (a.performanceTargetRules ?? null) === (b.performanceTargetRules ?? null)
  );
}
export function readCampaignTargets(
  raw: string | null | undefined,
  accountId: string | null,
  currency: string,
): Record<string, CampaignTarget> {
  try {
    if (!raw) return {};
    const input = JSON.parse(raw);
    if (
      String(input.accountId).replace(/^act_/, "") !==
        accountId?.replace(/^act_/, "") ||
      input.currency !== currency
    )
      return {};
    const parsed = targetRulesSchema.safeParse(input.rules);
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}
