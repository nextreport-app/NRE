import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readRecentImportMethod, rememberCompletedImportMethod } from "../client-wizard-preferences";
const flags = vi.hoisted(() => ({ visible: true }));
vi.mock("@/lib/ad-platform-api-sync", () => ({ isWizardApiSyncVisible: () => flags.visible }));

describe("recent successful import method across clients", () => {
  let storage: Map<string, string>;
  beforeEach(() => {
    flags.visible = true;
    storage = new Map();
    vi.stubGlobal("localStorage", { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) });
  });
  afterEach(() => vi.unstubAllGlobals());
  it("has no learned default for a new user", () => {
    expect(readRecentImportMethod("user", true)).toBeNull();
  });
  it("reuses the latest completed method across clients, in both directions", () => {
    rememberCompletedImportMethod("user", "api");
    expect(readRecentImportMethod("user", true)).toBe("api");
    rememberCompletedImportMethod("user", "csv");
    expect(readRecentImportMethod("user", true)).toBe("csv");
    rememberCompletedImportMethod("user", "api");
    expect(readRecentImportMethod("user", true)).toBe("api");
  });
  it("keeps different signed-in users separate", () => {
    rememberCompletedImportMethod("one", "api");
    rememberCompletedImportMethod("two", "csv");
    expect(readRecentImportMethod("one", true)).toBe("api");
    expect(readRecentImportMethod("two", true)).toBe("csv");
    expect(readRecentImportMethod("three", true)).toBeNull();
  });
  it("falls back when API is unavailable without erasing the learned choice", () => {
    rememberCompletedImportMethod("user", "api");
    expect(readRecentImportMethod("user", false)).toBe("csv");
    expect(readRecentImportMethod("user", true)).toBe("api");
  });
  it("falls back when API is hidden without erasing the learned choice", () => {
    rememberCompletedImportMethod("user", "api");
    flags.visible = false;
    expect(readRecentImportMethod("user", true)).toBe("csv");
    flags.visible = true;
    expect(readRecentImportMethod("user", true)).toBe("api");
  });
  it("ignores invalid values, missing identities and unavailable browser storage", () => {
    storage.set("nre.recentImportMethod.user", "invalid");
    expect(readRecentImportMethod("user", true)).toBeNull();
    rememberCompletedImportMethod(undefined, "api");
    expect(readRecentImportMethod(undefined, true)).toBeNull();
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } });
    expect(readRecentImportMethod("user", true)).toBeNull();
    expect(() => rememberCompletedImportMethod("user", "api")).not.toThrow();
  });
});
