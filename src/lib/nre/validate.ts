/**
 * NRE v1 — Pillar 5: pre-generation validation.
 * "Before creating a single slide, validate the uploaded CSV... show clear
 * error messages if validation fails — never generate a broken report
 * silently." (claude_code_webapp_prompt.md)
 *
 * This has no direct Apps Script equivalent (the original just let a broken
 * upload throw mid-generation) — it's new, spec-driven guardrail logic that
 * runs before buildReportData() is ever called.
 */

import type { ColumnMap, NreRow } from "./columns";
import { getRowDate } from "./columns";
import { parseDate } from "./dates";

export interface ValidationIssue {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

const MAX_RANGE_DAYS = 90;
const FUTURE_GRACE_DAYS = 1; // small allowance for timezone edge effects at the CSV's export boundary

/**
 * `headers` is the raw, as-parsed header row (from parseCsvText). It isn't
 * used for any pass/fail decision — only to build a diagnostic message when
 * column detection fails, since "no Campaign name column found" is useless
 * for self-diagnosis if the actual parsed headers never surface anywhere.
 * A single garbled/glued-together header (wrong delimiter, a title row
 * mistaken for the header row, an encoding issue) fails EVERY structural
 * check at once — this makes that failure mode visible immediately instead
 * of requiring a round trip to ask "what did the server actually see?".
 */
export function validateMtdDailyCsv(
  colMap: ColumnMap,
  rows: NreRow[],
  now: Date = new Date(),
  headers: string[] = [],
): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  if (!colMap.campaign_name) {
    errors.push({
      field: "campaign_name",
      message: 'No "Campaign name" column found in the CSV.',
    });
  }
  if (!colMap.spend) {
    errors.push({
      field: "spend",
      message: 'No "Amount spent" column found in the CSV.',
    });
  }
  const hasDateColumn =
    !!colMap.date_start ||
    !!colMap.date_end ||
    rows.some((r) => !!getRowDate(r));
  if (!hasDateColumn) {
    errors.push({
      field: "date",
      message: 'No date column found (expected a "Day", "Date", or "Reporting starts/ends" column).',
    });
  }
  if (!colMap.results) {
    errors.push({
      field: "results",
      message: "No result/conversion metric column found — cannot determine campaign performance.",
    });
  }

  // All four structural checks failing together almost always means the
  // header row itself wasn't split into columns correctly (wrong delimiter
  // auto-detected, a title/summary line above the real header row, a stray
  // encoding artifact) rather than genuinely missing columns — surface what
  // was actually parsed so that's diagnosable without guessing.
  if (errors.length === 4) {
    const preview = headers.length
      ? headers.map((h) => JSON.stringify(h)).join(", ")
      : "(none — the header row did not parse into any columns)";
    errors.push({
      field: "diagnostic",
      message: `Detected ${headers.length} column header(s): ${preview}. If this doesn't match your file's actual columns, the CSV likely isn't being split into columns correctly (check the delimiter, or whether a title/summary row precedes the real header row).`,
    });
  }

  if (rows.length === 0) {
    errors.push({ field: "rows", message: "No data rows found in the uploaded CSV." });
    return { valid: false, errors, warnings };
  }

  const nonEmptyCampaignRows = rows.filter((r) => (r.campaign_name || "").trim() !== "");
  if (nonEmptyCampaignRows.length === 0) {
    errors.push({ field: "campaign_name", message: "Every row has an empty campaign name." });
  }

  // Date range sanity — skip if we already know there's no usable date column.
  if (hasDateColumn) {
    let minTs: number | null = null;
    let maxTs: number | null = null;
    rows.forEach((row) => {
      const d = parseDate(getRowDate(row));
      if (!d) return;
      const ts = Date.UTC(d.year, d.month - 1, d.day);
      if (minTs === null || ts < minTs) minTs = ts;
      if (maxTs === null || ts > maxTs) maxTs = ts;
    });

    if (minTs === null || maxTs === null) {
      errors.push({ field: "date", message: "Could not parse any dates in the date column." });
    } else {
      const todayTs = new Date(now.toISOString().split("T")[0] + "T00:00:00Z").getTime();
      const futureLimitTs = todayTs + FUTURE_GRACE_DAYS * 24 * 60 * 60 * 1000;
      if (maxTs > futureLimitTs) {
        errors.push({
          field: "date",
          message: "The CSV contains dates in the future. Re-export the report for the correct date range.",
        });
      }
      const spanDays = (maxTs - minTs) / (24 * 60 * 60 * 1000);
      if (spanDays > MAX_RANGE_DAYS) {
        errors.push({
          field: "date",
          message: `The date range spans ${Math.round(spanDays)} days — upload a single month's daily export (max ${MAX_RANGE_DAYS} days).`,
        });
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
