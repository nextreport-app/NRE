import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MetaClientAccountNotice } from "@/components/meta-client-account-notice";
import { metaClientAccountStatus, normalizeMetaAccountId } from "@/lib/meta-client-account";
import { resolveRememberedMetaAccount } from "@/lib/meta-account-selection";
const base = {clientName:"Southaven RV & Marine",selectedId:"act_222",selectedName:"Express Text",linkedId:"111",linkedName:"Southaven Ads",confirmed:false,onConfirm:()=>{}};
describe("ID-only client account warnings", () => {
 it("shows both IDs and the report client for a mismatch", () => {
  const html=renderToStaticMarkup(<MetaClientAccountNotice {...base}/>);
  for(const text of ["Southaven RV &amp; Marine","Express Text","111","222","role=\"alert\"","Use Express Text for this report"]) expect(html).toContain(text);
 });
 it("does not warn for the same ID even when account names differ", () => {
  expect(renderToStaticMarkup(<MetaClientAccountNotice {...base} linkedId="222"/>)).toBe("");
 });
 it.each([
  ["FULL GORILLA APPAREL", "222"],
  ["FULL GORILLA APPAREL", "Ad account"],
  ["Sherwood Tractor", "Sherwood Tractor Inc"],
  ["Southaven RV & Marine", "Express Text"],
 ])("does not warn without a saved ID: %s / %s", (clientName, selectedName) => {
  expect(renderToStaticMarkup(<MetaClientAccountNotice {...base} linkedId={null} clientName={clientName} selectedName={selectedName}/>)).toBe("");
  expect(metaClientAccountStatus(null,"222")).toBe("unlinked");
 });
 it("still warns for different IDs even when names match", () => {
  expect(renderToStaticMarkup(<MetaClientAccountNotice {...base} clientName="Sherwood Tractor" selectedName="Sherwood Tractor"/>)).toContain('role="alert"');
 });
 it("does not warn without a selected account", () => {
  expect(renderToStaticMarkup(<MetaClientAccountNotice {...base} selectedId=""/>)).toBe("");
 });
 it("canonicalizes prefixes and restores the picker ID", () => {
  expect(normalizeMetaAccountId(" act_222 ")).toBe("222");
  expect(metaClientAccountStatus("222","act_222")).toBe("matched");
  expect(resolveRememberedMetaAccount([{id:"act_222"}],"222")).toEqual({id:"act_222",unavailable:false});
 });
});
