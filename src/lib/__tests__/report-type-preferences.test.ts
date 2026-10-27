import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readClientWizardPreferences } from "@/components/report-upload-wizard/client-wizard-preferences";

describe("saved report choices during the tested-report rollout", () => {
  let saved: string | null;
  beforeEach(() => { saved = null; vi.stubGlobal("localStorage", { getItem: () => saved }); });
  afterEach(() => vi.unstubAllGlobals());
  it("does not reuse hidden report dates or baselines in a new Weekly report", () => {
    saved = JSON.stringify({ reportType: "QUARTER", dateMode: "custom", customStart: "2026-09-01", customEnd: "2026-09-30", generateBaseline: { reportType: "QUARTER" } });
    const prefs = readClientWizardPreferences("client");
    expect(prefs?.reportType).toBe("WEEKLY");
    expect(prefs?.dateMode).toBe("last7");
    expect(prefs?.customStart).toBeUndefined();
    expect(prefs?.generateBaseline).toBeUndefined();
    expect(JSON.parse(saved).reportType).toBe("QUARTER"); // Reading does not erase the saved source.
  });
  it("preserves an available Comparison report and its custom dates", () => {
    saved = JSON.stringify({ reportType: "COMPARISON", dateMode: "custom", customStart: "2026-09-01", customEnd: "2026-09-30" });
    expect(readClientWizardPreferences("client")).toMatchObject({ reportType: "COMPARISON", dateMode: "custom", customStart: "2026-09-01", customEnd: "2026-09-30" });
  });
});
