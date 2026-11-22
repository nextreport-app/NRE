import {it,expect,vi,afterEach} from "vitest";
import {fetchMetaAccountSpend}from "../meta-api";
afterEach(()=>vi.unstubAllGlobals());
it("requests an exact account-level period with no filtering or token in URL",async()=>{
 const fetcher=vi.fn(async()=>Response.json({data:[{spend:"750.01",date_start:"2026-11-01",date_stop:"2026-11-22"}]}));vi.stubGlobal("fetch",fetcher);
 expect(await fetchMetaAccountSpend("secret","act_123","2026-11-01","2026-11-22")).toBe(750.01);
 const [url,init]=fetcher.mock.calls[0] as unknown as [string,RequestInit];const params=new URL(url).searchParams;
 expect(params.get("level")).toBe("account");expect(params.get("time_increment")).toBe("all_days");expect(params.has("filtering")).toBe(false);expect(params.has("access_token")).toBe(false);expect(init.headers).toMatchObject({Authorization:"Bearer secret"});
});
it.each([{data:[]}, {data:[{spend:"",date_start:"2026-11-01",date_stop:"2026-11-22"}]},{data:[{spend:"10",date_start:"2026-11-02",date_stop:"2026-11-22"}]},{error:{message:"token secret"}},{data:[{spend:"-1"}]}])("distinguishes successful no delivery from malformed or incomplete responses %#",async payload=>{
 vi.stubGlobal("fetch",vi.fn(async()=>Response.json(payload)));
 const result=fetchMetaAccountSpend("secret","123","2026-11-01","2026-11-22");if("data"in payload&&payload.data?.length===0)expect(await result).toBe(0);else await expect(result).rejects.toThrow(/Meta/);
});
