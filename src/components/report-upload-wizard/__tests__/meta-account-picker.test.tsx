import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MetaAdAccountPicker, matchingAdAccounts } from "@/components/meta-ad-account-picker";
const accounts = [
  { id: "act_1001", accountId: "1001", name: "BumperTech", currency: "AUD", timezone: "Australia/Sydney" },
  { id: "act_1002", accountId: "1002", name: "The Belle", currency: "USD", timezone: "America/New_York" },
];
describe("Meta account picker", () => {
  it("searches names and account IDs, case-insensitively, without changing the original list", () => {
    expect(matchingAdAccounts(accounts, "  BUMPER  ")).toEqual([accounts[0]]);
    expect(matchingAdAccounts(accounts, "1002")).toEqual([accounts[1]]);
    expect(matchingAdAccounts(accounts, "act_1001")).toEqual([accounts[0]]);
    expect(matchingAdAccounts(accounts, "Belle 1002")).toEqual([accounts[1]]);
    expect(matchingAdAccounts(accounts, "not found")).toEqual([]);
    expect(matchingAdAccounts(accounts, "   ")).toEqual(accounts);
    expect(accounts).toHaveLength(2);
  });
  it("shows the selected name and ID without currency or timezone", () => {
    const html = renderToStaticMarkup(<MetaAdAccountPicker accounts={accounts} value="act_1001" onChange={() => {}} />);
    expect(html).toContain("BumperTech"); expect(html).toContain("1001");
    expect(html).not.toContain("AUD"); expect(html).not.toContain("Australia/Sydney");
    expect(html).toContain('aria-haspopup="dialog"');
    expect(matchingAdAccounts(accounts, "AUD")).toEqual([]);
  });
  it("does not repeat IDs as an account name when Meta only supplied a numeric name", () => {
    const html = renderToStaticMarkup(<MetaAdAccountPicker accounts={[{ id: "act_1001", name: "1001" }]} value="act_1001" onChange={() => {}} />);
    expect(html).toContain(">Ad account</span>");
    expect(html).not.toContain(">1001</span>");
  });
});
