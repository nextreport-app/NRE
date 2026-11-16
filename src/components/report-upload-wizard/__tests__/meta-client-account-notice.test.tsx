import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MetaClientAccountNotice } from "@/components/meta-client-account-notice";
import { metaClientAccountStatus, normalizeMetaAccountId } from "@/lib/meta-client-account";
import { resolveRememberedMetaAccount } from "@/lib/meta-account-selection";
const base = {clientName:"Southaven RV & Marine",selectedId:"act_222",selectedName:"Express Text",linkedId:"111",linkedName:"Southaven Ads",confirmed:false,onConfirm:()=>{}};
describe("client account warnings", () => {
 it("shows both account IDs and the report client for a mismatch", () => {
  const html=renderToStaticMarkup(<MetaClientAccountNotice {...base}/>);
  for(const text of ["Southaven RV &amp; Marine","Express Text","111","222","role=\"alert\"","Use Express Text for this report"]) expect(html).toContain(text);
 });
 it("does not warn for the same ID even when account names differ", () => {
  expect(renderToStaticMarkup(<MetaClientAccountNotice {...base} linkedId="222"/>)).toBe("");
 });
 it("warns for different names before the first association", () => {
  const html=renderToStaticMarkup(<MetaClientAccountNotice {...base} linkedId={null}/>);
  expect(html).toContain("names do not clearly match");
  expect(html).toContain('role="alert"');
  expect(html).toContain("This ad account belongs to Southaven RV &amp; Marine.");
 });
 it.each([
  ["Sherwood Tractor", "Sherwood Tractor Inc"],
  ["Sherwood Tractor", " SHERWOOD TRACTOR, INC. "],
  ["Express Text", "Express Text Ad Account"],
  ["Southaven RV & Marine", "Southaven RV and Marine LLC"],
  ["Acme", "Acme Pvt. Ltd. Ad Account"],
  ["Café Studio", "CAFÉ STUDIO LTD"],
 ])("does not warn on a first sync for %s / %s", (clientName, selectedName) => {
  expect(renderToStaticMarkup(<MetaClientAccountNotice {...base} linkedId={null} clientName={clientName} selectedName={selectedName}/>)).toBe("");
  expect(metaClientAccountStatus(null,"222",{clientName,selectedName})).toBe("matched");
 });
 it("still warns for different IDs even when the names match", () => {
  expect(renderToStaticMarkup(<MetaClientAccountNotice {...base} clientName="Sherwood Tractor" selectedName="Sherwood Tractor Inc"/>)).toContain('role="alert"');
 });
 it.each([
  ["Sherwood Tractor", "Sherwood Tractor East"],
  ["Sherwood Tractor East", "Sherwood Tractor West"],
  ["Sherwood Tractor", "Sherwood Tractor 2"],
  ["Express Text", "Southaven RV & Marine"],
  ["", ""],
  ["Acme", ""],
 ])("does not treat different or empty names as a match: %s / %s", (clientName, selectedName) => {
  expect(metaClientAccountStatus(null,"222",{clientName,selectedName})).toBe("unlinked");
 });
 it("does not warn without a selected account", () => {
  expect(renderToStaticMarkup(<MetaClientAccountNotice {...base} selectedId=""/>)).toBe("");
 });
 it("canonicalizes provider prefixes and restores the real picker ID", () => {
  expect(normalizeMetaAccountId(" act_222 ")).toBe("222");
  expect(metaClientAccountStatus("222","act_222")).toBe("matched");
  expect(resolveRememberedMetaAccount([{id:"act_222"}],"222")).toEqual({id:"act_222",unavailable:false});
 });
});
