import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  clearWizardGenerateSnapshot,
  loadWizardGenerateSnapshot,
  saveWizardGenerateSnapshot,
  type WizardGenerateSnapshot,
} from "../wizard-generate-snapshot";

const clientId = "client-test";
const snapshot: WizardGenerateSnapshot = {
  version: 1,
  reportId: "report-1",
  downloadUrl: "/api/reports/report-1/download",
  shareToken: "tok",
  platform: "META",
  reportType: "WEEKLY",
  dateMode: "last7",
  customStart: "",
  customEnd: "",
  dateBounds: { minIso: "2026-08-01", maxIso: "2026-08-26" },
  weeklyOptions: {
    last7: { startIso: "2026-08-20", endIso: "2026-08-26" },
    prev7: { startIso: "2026-08-13", endIso: "2026-08-19" },
  },
  mtdRange: { startIso: "2026-08-01", endIso: "2026-08-26" },
  monthComparisonOptions: null,
  comparisonPreset: "thisWeek",
  comparisonPeriodA: null,
  comparisonPeriodB: null,
  previewKind: "normal",
  previewStatus: "idle",
  data: null,
  comparisonData: null,
  reportTitle: "Weekly Performance Report",
  reportTitleTouched: false,
  customTitleExpanded: false,
  selectedCampaigns: ["Campaign A"],
  driveView: "collapsed",
  driveSaveUrl: null,
  rememberedFolder: null,
};

describe("wizard-generate-snapshot", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    });
    clearWizardGenerateSnapshot(clientId);
  });

  it("round-trips a snapshot for the same report id", () => {
    saveWizardGenerateSnapshot(clientId, snapshot);
    expect(loadWizardGenerateSnapshot(clientId, "report-1")).toEqual(snapshot);
    expect(loadWizardGenerateSnapshot(clientId, "other")).toBeNull();
  });

  it("clear removes stored snapshot", () => {
    saveWizardGenerateSnapshot(clientId, snapshot);
    clearWizardGenerateSnapshot(clientId);
    expect(loadWizardGenerateSnapshot(clientId, "report-1")).toBeNull();
  });
});
