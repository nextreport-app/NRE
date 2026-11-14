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
 it("asks for a first association without claiming the names mismatch", () => {
  const html=renderToStaticMarkup(<MetaClientAccountNotice {...base} linkedId={null}/>);
  expect(html).toContain("No Meta ad account is linked yet");
  expect(html).not.toContain("differs from");
 });
 it("canonicalizes provider prefixes and restores the real picker ID", () => {
  expect(normalizeMetaAccountId(" act_222 ")).toBe("222");
  expect(metaClientAccountStatus("222","act_222")).toBe("matched");
  expect(resolveRememberedMetaAccount([{id:"act_222"}],"222")).toEqual({id:"act_222",unavailable:false});
 });
});
