import {describe,expect,it} from "vitest";
import {directlyEvidencedResult} from "../meta-api-sync/direct-result-evidence";
import {dedupeInsightsByAdSetDay} from "../meta-api-sync/insight-engine";
import {labelMetaInsightIdentities} from "../meta-api-sync/insight-identities";
import {metaApiCsvTransport} from "@/lib/meta-api-csv-transport";
import {gunzipSync} from "node:zlib";
describe("Meta result evidence and source identity",()=>{
 it("trusts an explicit primary result instead of overlapping action totals or campaign naming",()=>{
  const result=directlyEvidencedResult({campaign_name:"Old Traffic Campaign",spend:"30",results:[{indicator:"actions:onsite_conversion.lead_grouped",values:[{value:"3"}]}],cost_per_result:[{indicator:"actions:onsite_conversion.lead_grouped",values:[{value:"10"}]}],actions:[{action_type:"lead",value:"99"},{action_type:"onsite_conversion.lead_grouped",value:"3"},{action_type:"link_click",value:"200"}]});
  expect(result).toMatchObject({value:"3",cpr:"10",action_type:"onsite_conversion.lead_grouped"});
 });
 it("does not create a result merely because Meta returned spend and CPA",()=>expect(directlyEvidencedResult({campaign_name:"Instant Form Leads",spend:"20",cost_per_action_type:[{action_type:"onsite_conversion.lead_grouped",value:"5"}]})).toBeNull());
 it("keeps distinct campaign IDs and ad-set IDs sharing a name",()=>{
  const rows=[{campaign_id:"1",campaign_name:"Same",adset_id:"a",adset_name:"Main",date_start:"2026-11-01"},{campaign_id:"2",campaign_name:"Same",adset_id:"b",adset_name:"Main",date_start:"2026-11-01"}];
  expect(dedupeInsightsByAdSetDay([...rows,rows[0]])).toHaveLength(2);expect(labelMetaInsightIdentities(rows).rows.map(row=>row.campaign_name)).toEqual(["Same [1]","Same [2]"]);
 });
 it("compresses large CSV responses without changing data",()=>{const csv="column\n"+"value,value,value\n".repeat(100000);const payload=metaApiCsvTransport(csv);expect("csvGzipBase64" in payload).toBe(true);if("csvGzipBase64" in payload)expect(gunzipSync(Buffer.from(payload.csvGzipBase64,"base64")).toString()).toBe(csv);});
});
