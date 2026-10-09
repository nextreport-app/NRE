import { describe, expect, it } from "vitest";
import {
  CLIENT_MONTHLY_BUDGET_HASH,
  clientMonthlyBudgetSettingsHref,
  sanitizeWizardReturnTo,
} from "../client-settings-navigation";

describe("client-settings-navigation", () => {
  it("builds budget settings href with returnTo wizard", () => {
    expect(clientMonthlyBudgetSettingsHref("c1", { returnToWizard: true })).toBe(
      `/clients/c1?returnTo=${encodeURIComponent("/clients/c1/reports/new")}#${CLIENT_MONTHLY_BUDGET_HASH}`,
    );
  });

  it("sanitizes wizard returnTo", () => {
    expect(sanitizeWizardReturnTo("/clients/c1/reports/new", "c1")).toBe("/clients/c1/reports/new");
    expect(sanitizeWizardReturnTo("https://evil.test/phish", "c1")).toBeNull();
    expect(sanitizeWizardReturnTo("/clients/other/reports/new", "c1")).toBeNull();
  });
});
