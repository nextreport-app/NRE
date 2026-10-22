import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsvText } from "../parse-csv";
import { computeWizardUploadDateContext } from "../wizard-upload-date-context";

const FIXTURE = resolve(__dirname, "fixtures/dc-weekly-credit-firm-oct11-17-2026.csv");

describe("computeWizardUploadDateContext", () => {
  it("caps last7 and MTD to CSV max when export is stale vs today", () => {
    const rows = parseCsvText(readFileSync(FIXTURE, "utf8")).rows;
    const now = new Date("2026-10-19T16:00:00Z");
    const ctx = computeWizardUploadDateContext(rows, "America/New_York", now);

    expect(ctx.weeklyOptions.last7).toEqual({ startIso: "2026-10-11", endIso: "2026-10-17" });
    expect(ctx.mtdRange).toEqual({ startIso: "2026-10-01", endIso: "2026-10-17" });
    expect(ctx.dateBounds?.maxIso).toBe("2026-10-17");
  });
});
