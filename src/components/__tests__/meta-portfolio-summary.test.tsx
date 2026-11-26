import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { OverviewRow } from "@/lib/agency-overview";
import { PortfolioBoard } from "../portfolio-board";

const account = {
  id: "express",
  name: "Express Text",
  currency: "USD",
  linked: true,
  performanceEnabled: true,
  performanceFresh: true,
  unavailable: false,
  budgetAttention: false,
  portfolio: {
    state: "critical",
    coverage: { total: 20 },
    lead: {
      name: "Campaign that should stay inside the dashboard",
      reason: "CPL is increasing",
      observation: { metric: "Cost per result", current: 17.48, previous: 13.1, unit: "money", change: 33.5, reference: "previous" },
    },
  },
} as OverviewRow;
const render = (row: OverviewRow) => renderToStaticMarkup(<PortfolioBoard rows={[row]} selected="" onOpen={() => {}} />);

describe("compact Meta portfolio summaries", () => {
  it("keeps campaign details inside the dashboard while preserving an account-level alert", () => {
    const html = render(account);
    expect(html).toContain("Performance needs attention.");
    expect(html).not.toContain(account.portfolio.lead!.name);
    expect(html).not.toContain("Cost per result");
    expect(html).toContain("View performance");
    expect(html).toContain("nre-performance-action-ready");
  });
  it("prioritizes one budget summary over other account notices", () => {
    const html = render({ ...account, unavailable: true, budgetAttention: true, budget: { facts: { spent: 391.37 }, config: { monthlyBudget: 300 } } as OverviewRow["budget"] });
    expect(html).toContain("Budget needs attention");
    expect(html).toContain("Spent $391.37 of");
    expect(html).toContain("$300.00");
    expect(html).not.toContain("Saved data needs");
    expect(html).not.toContain("Performance needs attention.");
  });
  it.each([
    { linked: false, performanceEnabled: false, label: "Choose ad account" },
    { linked: true, performanceEnabled: false, label: "Set up monitoring" },
  ])("keeps $label actions graphite", ({ linked, performanceEnabled, label }) => {
    const html = render({ ...account, linked, performanceEnabled });
    expect(html).toContain(label);
    expect(html).not.toContain("nre-performance-action-ready");
  });
});
