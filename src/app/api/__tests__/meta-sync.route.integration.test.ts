import {beforeEach,afterEach,describe,expect,it,vi} from "vitest";
vi.mock("@/lib/auth",()=>({auth:vi.fn()}));
vi.mock("@/lib/prisma",()=>({prisma:{client:{findUnique:vi.fn(),findUniqueOrThrow:vi.fn()},user:{findUnique:vi.fn(),update:vi.fn()}}}));
vi.mock("@/lib/subscription-guard",()=>({requireActiveSubscription:vi.fn().mockResolvedValue(null)}));
vi.mock("@/lib/usage-rate-limit",()=>({enforceWizardLimits:vi.fn().mockResolvedValue(null)}));
vi.mock("@/lib/meta-token-storage",()=>({decryptMetaToken:()=>"fake-token",encryptMetaToken:()=>"protected-token",isEncryptedMetaToken:()=>true}));
vi.mock("@/lib/meta-api",async original=>({...await original<typeof import("@/lib/meta-api")>(),ensureFreshMetaAccessToken:vi.fn(),fetchMetaAdAccountMetadata:vi.fn()}));
vi.mock("@/lib/nre/meta-api-sync",()=>({fetchMetaReportCsv:vi.fn()}));
vi.mock("@/lib/nre/sync-previous-month-from-api",()=>({maybeSyncPreviousMonthDataFromMetaApi:vi.fn(),maybeSyncPreviousMonthDataFromGoogleApi:vi.fn(),maybeSyncPreviousMonthDataFromTikTokApi:vi.fn()}));
vi.mock("@/lib/nre/previous-month-data",()=>({loadPreviousMonthDataCampaigns:vi.fn().mockResolvedValue(["Example"]),parsePreviousMonthSelectedCampaigns:()=>null}));
import {auth} from "@/lib/auth";
import {prisma} from "@/lib/prisma";
import {ensureFreshMetaAccessToken,fetchMetaAdAccountMetadata} from "@/lib/meta-api";
import {fetchMetaReportCsv} from "@/lib/nre/meta-api-sync";
import {maybeSyncPreviousMonthDataFromMetaApi} from "@/lib/nre/sync-previous-month-from-api";
import {POST} from "../clients/[id]/reports/sync-api/route";
const params={params:Promise.resolve({id:"client_1"})};
const body={platform:"META",metaAdAccountId:"act_123",reportType:"MONTHLY",dateSelection:{mode:"custom",customStart:"2026-10-01",customEnd:"2026-10-31"}};
const request=(value:unknown=body)=>new Request("http://localhost/sync",{method:"POST",body:JSON.stringify(value)});
beforeEach(()=>{
 vi.clearAllMocks();vi.useFakeTimers();vi.setSystemTime(new Date("2026-11-05T12:00:00Z"));vi.stubEnv("AD_PLATFORM_API_SYNC_ENABLED","true");
 vi.mocked(auth).mockResolvedValue({user:{id:"owner"}} as never);
 vi.mocked(prisma.client.findUnique).mockResolvedValue({id:"client_1",userId:"owner",timezone:"UTC",currency:"INR",previousMonthDataUrl:null,previousMonthDataUpdatedAt:null,previousMonthSelectedCampaigns:null} as never);
 vi.mocked(prisma.user.findUnique).mockResolvedValue({metaAdsEnabled:true,metaAccessToken:"protected"} as never);
 vi.mocked(ensureFreshMetaAccessToken).mockResolvedValue({accessToken:"fake-token",tokenExpiresAt:new Date("2027-01-01"),refreshed:false});
 vi.mocked(fetchMetaAdAccountMetadata).mockResolvedValue({id:"act_123",currency:"AUD",timezone_name:"UTC"});
 vi.mocked(fetchMetaReportCsv).mockResolvedValue({csvText:"Campaign name,Day,Amount spent (AUD)\nExample,2026-10-31,10",rowCount:1,sinceIso:"2026-10-01",untilIso:"2026-10-31",diagnostics:{},campaignPeriodReachByName:{},campaignPeriodReachMaps:{byRangeKey:{}}} as never);
 vi.mocked(maybeSyncPreviousMonthDataFromMetaApi).mockResolvedValue({synced:false});
});
afterEach(()=>{vi.useRealTimers();vi.unstubAllEnvs();});
describe("Meta wizard import route",()=>{
 it("requires authentication",async()=>{vi.mocked(auth).mockResolvedValue(null as never);expect((await POST(request(),params)).status).toBe(401);});
 it("does not import into another user's client",async()=>{vi.mocked(prisma.client.findUnique).mockResolvedValue({userId:"other"} as never);expect((await POST(request(),params)).status).toBe(404);expect(fetchMetaReportCsv).not.toHaveBeenCalled();});
 it("uses Meta currency and selected monthly dates with strict result evidence",async()=>{
  const response=await POST(request(),params);expect(response.status).toBe(200);
  expect(fetchMetaReportCsv).toHaveBeenCalledWith(expect.objectContaining({currency:"AUD",timezone:"UTC",sinceIso:"2026-10-01",untilIso:"2026-10-31",requireDirectResultEvidence:true}));
  expect(await response.json()).toMatchObject({accountCurrency:"AUD",accountTimezone:"UTC",rowCount:1});expect(maybeSyncPreviousMonthDataFromMetaApi).not.toHaveBeenCalled();
 });
 it("ignores a stale independent source window and fetches only the report dates", async () => {
  const response = await POST(request({ ...body, importRange: { startIso: "2026-08-07", endIso: "2026-11-04" } }), params);
  expect(response.status).toBe(200);
  expect(fetchMetaReportCsv).toHaveBeenCalledWith(expect.objectContaining({ sinceIso: "2026-10-01", untilIso: "2026-10-31" }));
 });
 it("rejects a timezone mismatch instead of reporting the wrong yesterday",async()=>{vi.mocked(fetchMetaAdAccountMetadata).mockResolvedValue({id:"act_123",currency:"AUD",timezone_name:"Australia/Sydney"});const response=await POST(request(),params);expect(response.status).toBe(409);expect((await response.json()).code).toBe("meta_timezone_mismatch");expect(fetchMetaReportCsv).not.toHaveBeenCalled();});
 it("does not hide API mapping problems behind a manual reference CSV",async()=>{expect((await POST(request({...body,referenceManualCsvText:"CSV reference"}),params)).status).toBe(400);expect(fetchMetaReportCsv).not.toHaveBeenCalled();});
 it("honors the explicit server kill switch",async()=>{vi.stubEnv("AD_PLATFORM_API_SYNC_ENABLED","false");expect((await POST(request(),params)).status).toBe(410);});
});
