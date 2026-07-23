/**
 * NRE v1 — date auto-detection.
 * Direct port of parseDate_/formatDateUS_/getMonthLabel_/getDateRangeShortLabel_
 * from meta_ads_report_v4.js.
 *
 * parseDate_ auto-distinguishes Indian DD-MM-YY from US MM-DD-YY by checking
 * which of the first two numbers is > 12; if ambiguous it assumes Indian
 * DD-MM-YY (this is intentional — do not "fix" to default US format).
 *
 * Extension beyond the source: also detects ISO 8601 (YYYY-MM-DD), which the
 * Apps Script version never had to handle but current Meta/Google exports'
 * "Day"/"Reporting starts"/"Reporting ends" columns increasingly use. Without
 * this, a 4-digit year in the first position gets misread as a day-of-month
 * (e.g. "2026-07-01" → day 2026, month 07, year "01"+2000), which silently
 * produces wildly wrong, far-future-or-past dates — exactly the "date range
 * spans thousands of days" symptom this fixes. Detection is unambiguous: a
 * day-of-month or month is never written with 4 digits, so a 4-digit first
 * group can only be a year.
 */

export interface ParsedDate {
  day: number;
  month: number; // 1-12
  year: number;
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function parseDate(rawValue: unknown): ParsedDate | null {
  if (rawValue === null || rawValue === undefined || rawValue === "") return null;

  if (rawValue instanceof Date) {
    const ist = new Date(rawValue.getTime() + IST_OFFSET_MS);
    return { day: ist.getUTCDate(), month: ist.getUTCMonth() + 1, year: ist.getUTCFullYear() };
  }

  if (typeof rawValue === "number") {
    // Excel/Sheets serial date (days since 1899-12-30)
    const d = new Date(Math.round((rawValue - 25569) * 86400 * 1000));
    const ist = new Date(d.getTime() + IST_OFFSET_MS);
    return { day: ist.getUTCDate(), month: ist.getUTCMonth() + 1, year: ist.getUTCFullYear() };
  }

  const nums = String(rawValue).match(/\d+/g);
  if (!nums || nums.length < 3) return null;
  const n0 = parseInt(nums[0], 10);
  const n1 = parseInt(nums[1], 10);
  let n2 = parseInt(nums[2], 10);

  // ISO 8601 (YYYY-MM-DD, YYYY/MM/DD, ...) — year-first, unambiguous.
  if (nums[0].length === 4) {
    return { day: n2, month: n1, year: n0 };
  }

  if (n2 < 100) n2 += 2000;
  if (n0 > 12) return { day: n0, month: n1, year: n2 };
  if (n1 > 12) return { day: n1, month: n0, year: n2 };
  return { day: n0, month: n1, year: n2 }; // assume Indian DD-MM-YY
}

export function formatDateUS(rawValue: unknown): string {
  const d = parseDate(rawValue);
  if (!d) return String(rawValue);
  return String(d.month).padStart(2, "0") + "/" + String(d.day).padStart(2, "0") + "/" + d.year;
}

export function getMonthLabel(rawValue: unknown, timezone: string): string {
  const d = parseDate(rawValue);
  if (!d) return "This Period";
  const dt = new Date(Date.UTC(d.year, d.month - 1, d.day, 12, 0, 0));
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    month: "long",
    year: "numeric",
  }).format(dt);
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

/**
 * "June 1-30" / "July 1-9" (same month) or "June 28 - July 4" (cross-month).
 * Always shows the full range, even within the same day.
 */
export function getDateRangeShortLabel(rawStart: unknown, rawEnd: unknown): string {
  const s = parseDate(rawStart);
  const e = parseDate(rawEnd);
  if (!s) return "N/A";
  const sm = MONTHS[s.month - 1];
  if (!e) return sm + " " + s.day;
  const em = MONTHS[e.month - 1];
  if (s.day === e.day && s.month === e.month && s.year === e.year) return sm + " " + s.day;
  return sm + " " + s.day + " - " + em + " " + e.day;
}
