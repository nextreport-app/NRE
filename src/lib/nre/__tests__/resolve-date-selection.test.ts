import { describe, expect, it } from "vitest";
import { resolveDateSelection } from "../resolve-date-selection";
import type { NreRow } from "../columns";

function dailyRow(day: string): NreRow {
  return { _raw: { Day: day }, campaign_name: "Shoes" };
}

function daysInclusive(startIso: string, endIso: string): NreRow[] {
  const rows: NreRow[] = [];
  const start = new Date(startIso + "T00:00:00Z");
  const end = new Date(endIso + "T00:00:00Z");
  for (let ts = start.getTime(); ts <= end.getTime(); ts += 24 * 60 * 60 * 1000) {
    const d = new Date(ts);
    const day = `${String(d.getUTCDate()).padStart(2, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${d.getUTCFullYear()}`;
    rows.push(dailyRow(day));
  }
  return rows;
}

const rows = daysInclusive("2026-07-01", "2026-07-24");
const now = new Date("2026-07-25T12:00:00Z"); // yesterday = Jul 24

describe("resolveDateSelection", () => {
  it("returns no weeklyRange (default auto window) when there's no selection", () => {
    expect(resolveDateSelection(rows, undefined, now)).toEqual({ ok: true });
  });

  it("resolves 'last7' to the actual last-7-days-ending-yesterday dates", () => {
    const result = resolveDateSelection(rows, { mode: "last7" }, now);
    expect(result).toEqual({ ok: true, weeklyRange: { startIso: "2026-07-18", endIso: "2026-07-24" } });
  });

  it("resolves 'prev7' to the 7 days before that", () => {
    const result = resolveDateSelection(rows, { mode: "prev7" }, now);
    expect(result).toEqual({ ok: true, weeklyRange: { startIso: "2026-07-11", endIso: "2026-07-17" } });
  });

  it("resolves a valid 'custom' range as-is", () => {
    const result = resolveDateSelection(
      rows,
      { mode: "custom", customStart: "2026-07-05", customEnd: "2026-07-09" },
      now,
    );
    expect(result).toEqual({ ok: true, weeklyRange: { startIso: "2026-07-05", endIso: "2026-07-09" } });
  });

  it("rejects a 'custom' range outside the CSV's actual date bounds", () => {
    const result = resolveDateSelection(
      rows,
      { mode: "custom", customStart: "2026-06-01", customEnd: "2026-06-07" },
      now,
    );
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("rejects 'custom' with missing start/end", () => {
    const result = resolveDateSelection(rows, { mode: "custom" }, now);
    expect(result.ok).toBe(false);
  });

  it("still resolves last7 from the calendar when the CSV has no parseable dates", () => {
    const result = resolveDateSelection([{ _raw: {} }], { mode: "last7" }, now);
    expect(result.ok).toBe(true);
    expect(result.weeklyRange).toEqual({ startIso: "2026-07-18", endIso: "2026-07-24" });
  });
});
