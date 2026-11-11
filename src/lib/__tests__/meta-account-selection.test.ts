import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveRememberedMetaAccount } from "../meta-account-selection";
import { readClientWizardPreferences, saveClientWizardPreferences } from "@/components/report-upload-wizard/client-wizard-preferences";
const accounts = [{ id: "act_123" }, { id: "act_456" }];
describe("remembered Meta account safety", () => {
  it("restores a saved account only when it is still in the authorized list", () => {
    expect(resolveRememberedMetaAccount(accounts, "act_456")).toEqual({ id: "act_456", unavailable: false });
  });
  it("requires a choice when several accounts exist and no preference is saved", () => {
    expect(resolveRememberedMetaAccount(accounts, undefined)).toEqual({ id: "", unavailable: false });
  });
  it("auto-selects a sole account for a first-time client", () => {
    expect(resolveRememberedMetaAccount(accounts.slice(0, 1), undefined)).toEqual({ id: "act_123", unavailable: false });
  });
  it("never silently substitutes another account after access to the saved one is lost", () => {
    expect(resolveRememberedMetaAccount(accounts.slice(0, 1), "act_456")).toEqual({ id: "", unavailable: true });
    expect(resolveRememberedMetaAccount([], "act_456")).toEqual({ id: "", unavailable: true });
  });
  it.each([null, {}, 123, "not-an-account"])("ignores malformed saved IDs: %j", value => {
    expect(resolveRememberedMetaAccount(accounts, value)).toEqual({ id: "", unavailable: false });
  });
});
describe("account preference scoping", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
  });
  afterEach(() => vi.unstubAllGlobals());
  it("keeps client choices separate and preserves other reporting preferences", () => {
    saveClientWizardPreferences("a", { reportType: "MONTHLY", dataSourceMode: "api" });
    saveClientWizardPreferences("a", { metaAdAccountId: "act_123" });
    saveClientWizardPreferences("b", { metaAdAccountId: "act_456" });
    expect(readClientWizardPreferences("a")).toMatchObject({ metaAdAccountId: "act_123", reportType: "MONTHLY", dataSourceMode: "api" });
    expect(readClientWizardPreferences("b")?.metaAdAccountId).toBe("act_456");
    expect(readClientWizardPreferences("new-client")).toBeNull();
  });
});
