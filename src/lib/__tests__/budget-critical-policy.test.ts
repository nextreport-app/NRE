import { expect, it } from "vitest";
import {
  budgetFacts,
  budgetWindow,
  budgetAlertPresentation,
} from "../budget-monitor-facts";
import { budgetAlertKey } from "../budget-alert-key";
const window = budgetWindow("UTC", new Date("2026-11-25T12:00Z"));
const config = {
  monthlyBudget: 300,
  budgetMonitorTolerance: 3,
  currency: "USD",
  timezone: "UTC",
  metaAdAccountId: "123",
};
it("uses completed-day average for forecasts and keeps a late-month projection as Review", () => {
  const facts = budgetFacts(300, 290, 280, window, 3);
  expect(facts.projected).toBe(350);
  expect(budgetAlertPresentation(facts, 300, "USD", 6).tone).toBe("warning");
});
it("reserves Critical for actual overspend beyond tolerance", () => {
  const within = budgetFacts(300, 302, 280, window, 3),
    over = budgetFacts(300, 304, 280, window, 3);
  expect(budgetAlertPresentation(within, 300, "USD", 6).tone).toBe("warning");
  expect(budgetAlertPresentation(over, 300, "USD", 6).tone).toBe("critical");
  expect(
    budgetAlertKey("c", window.month, config, within.level, "warning"),
  ).not.toBe(budgetAlertKey("c", window.month, config, over.level, "critical"));
});
