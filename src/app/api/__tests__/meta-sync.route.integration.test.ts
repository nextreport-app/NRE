import {beforeEach,afterEach,describe,expect,it,vi} from "vitest";
vi.mock("@/lib/auth",()=>({auth:vi.fn()}));
vi.mock("@/lib/prisma",()=>({prisma:{client:{findUnique:vi.fn(),findUniqueOrThrow:vi.fn(),update:vi.fn(),updateMany:vi.fn()},user:{findUnique:vi.fn(),update:vi.fn()}}}));
vi.mock("@/lib/subscription-guard",()=>({requireActiveSubscription:vi.fn().mockResolvedValue(null)}));
vi.mock("@/lib/usage-rate-limit",()=>({enforceWizardLimits:vi.fn().mockResolvedValue(null)}));
vi.mock("@/lib/meta-token-storage",()=>({decryptMetaToken:()=>"fake-token",encryptMetaToken:()=>"protected-token",isEncryptedMetaToken:()=>true}));
vi.mock("@/lib/meta-api",async original=>({...await original<typeof import("@/lib/meta-api")>(),ensureFreshMetaAccessToken:vi.fn(),fetchMetaAdAccountMetadata:vi.fn()}));
vi.mock("@/lib/nre/meta-api-sync",()=>({fetchMetaReportCsv:vi.fn()}));
vi.mock("@/lib/nre/sync-previous-month-from-api",()=>({maybeSyncPreviousMonthDataFromMetaApi:vi.fn(),maybeSyncPreviousMonthDataFromGoogleApi:vi.fn(),maybeSyncPreviousMonthDataFromTikTokApi:vi.fn()}));
vi.mock("@/lib/nre/previous-month-data",()=>({loadPreviousMonthDataCampaigns:vi.fn().mockResolvedValue(["Example"]),parsePreviousMonthSelectedCampaigns:()=>null}));
import {auth} from "@/lib/auth";
import {prisma} from "@/lib/prisma";
import {ensureFreshMetaAccessToken,fetchMetaAdAccountMetadata,fetchMetaAdSetReportingConfigs} from "@/lib/meta-api";
import {fetchMetaReportCsv} from "@/lib/nre/meta-api-sync";
import {maybeSyncPreviousMonthDataFromMetaApi} from "@/lib/nre/sync-previous-month-from-api";
import {POST} from "../clients/[id]/reports/sync-api/route";
const params={params:Promise.resolve({id:"client_1"})};
const body={platform:"META",metaAdAccountId:"act_123",reportType:"MONTHLY",dateSelection:{mode:"custom",customStart:"2026-10-01",customEnd:"2026-10-31"}};
const request=(value:unknown=body)=>new Request("http://localhost/sync",{method:"POST",body:JSON.stringify(value)});
beforeEach(()=>{
 vi.clearAllMocks();vi.useFakeTimers();vi.setSystemTime(new Date("2026-11-05T12:00:00Z"));vi.stubEnv("AD_PLATFORM_API_SYNC_ENABLED","true");
 vi.mocked(prisma.client.updateMany).mockResolvedValue({count:1});
 vi.mocked(auth).mockResolvedValue({user:{id:"owner"}} as never);
 vi.mocked(prisma.client.findUnique).mockResolvedValue({id:"client_1",userId:"owner",metaAdAccountId:"123",timezone:"UTC",currency:"INR",previousMonthDataUrl:null,previousMonthDataUpdatedAt:null,previousMonthSelectedCampaigns:null} as never);
 vi.mocked(prisma.user.findUnique).mockResolvedValue({metaAdsEnabled:true,metaAccessToken:"protected"} as never);
 vi.mocked(ensureFreshMetaAccessToken).mockResolvedValue({accessToken:"fake-token",tokenExpiresAt:new Date("2027-01-01"),refreshed:false});
 vi.mocked(fetchMetaAdAccountMetadata).mockResolvedValue({id:"act_123",currency:"AUD",timezone_name:"UTC"});
 vi.mocked(fetchMetaReportCsv).mockResolvedValue({csvText:"Campaign name,Day,Amount spent (AUD)\nExample,2026-10-31,10",rowCount:1,sinceIso:"2026-10-01",untilIso:"2026-10-31",diagnostics:{},campaignPeriodReachByName:{},campaignPeriodReachMaps:{byRangeKey:{}}} as never);
 vi.mocked(maybeSyncPreviousMonthDataFromMetaApi).mockResolvedValue({synced:false});
});
afterEach(()=>{vi.useRealTimers();vi.unstubAllEnvs();vi.unstubAllGlobals();});
describe("Meta wizard import route",()=>{
 it("requires authentication",async()=>{vi.mocked(auth).mockResolvedValue(null as never);expect((await POST(request(),params)).status).toBe(401);});
 it("does not import into another user's client",async()=>{vi.mocked(prisma.client.findUnique).mockResolvedValue({userId:"other"} as never);expect((await POST(request(),params)).status).toBe(404);expect(fetchMetaReportCsv).not.toHaveBeenCalled();});
 it("uses Meta currency and selected monthly dates with strict result evidence",async()=>{
  const response=await POST(request(),params);expect(response.status).toBe(200);
  expect(fetchMetaReportCsv).toHaveBeenCalledWith(expect.objectContaining({currency:"AUD",timezone:"UTC",sinceIso:"2026-10-01",untilIso:"2026-10-31",requireDirectResultEvidence:true}));
  expect(await response.json()).toMatchObject({accountCurrency:"AUD",accountTimezone:"UTC",rowCount:1});expect(maybeSyncPreviousMonthDataFromMetaApi).not.toHaveBeenCalled();
 });
 it("does not fetch or expose saved previous-month data for weekly API reports", async () => {
  vi.mocked(prisma.client.findUnique).mockResolvedValue({ id: "client_1", userId: "owner", metaAdAccountId: "123", timezone: "UTC", currency: "AUD", previousMonthDataUrl: "https://example.invalid/manual-only.csv", previousMonthDataUpdatedAt: new Date("2026-11-01"), previousMonthSelectedCampaigns: '["Example"]' } as never);
  const response = await POST(request({ ...body, reportType: "WEEKLY", dateSelection: { mode: "last7" } }), params);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ hasPreviousMonthData: false, previousMonthSynced: false });
  expect(maybeSyncPreviousMonthDataFromMetaApi).not.toHaveBeenCalled();
  expect(prisma.client.findUniqueOrThrow).not.toHaveBeenCalled();
 });
 it("ignores a stale independent source window and fetches only the report dates", async () => {
  const response = await POST(request({ ...body, importRange: { startIso: "2026-08-07", endIso: "2026-11-04" } }), params);
  expect(response.status).toBe(200);
  expect(fetchMetaReportCsv).toHaveBeenCalledWith(expect.objectContaining({ sinceIso: "2026-10-01", untilIso: "2026-10-31" }));
 });
 it("continues sync using real per-object configuration parsing", async () => {
  const importer = vi.mocked(fetchMetaReportCsv).getMockImplementation()!;
  vi.mocked(fetchMetaReportCsv).mockImplementation(async input => {
   await fetchMetaAdSetReportingConfigs(input.accessToken, ["1"]);
   return importer(input);
  });
  const provider = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "1", optimization_goal: "OFFSITE_CONVERSIONS", promoted_object: { pixel_id: "10", custom_event_type: "LEAD" } })));
  vi.stubGlobal("fetch", provider);
  expect((await POST(request(), params)).status).toBe(200);
  expect(new URL(provider.mock.calls[0][0]).pathname).toMatch(/\/1$/);
 });
 it("returns a request/access error without falsely telling the user to reconnect", async () => {
  vi.mocked(fetchMetaReportCsv).mockImplementation(async input => {
   await fetchMetaAdSetReportingConfigs(input.accessToken, ["1"]);
   throw new Error("Should not continue with unresolved conversion settings");
  });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 100, message: "access_token=secret" } }), { status: 400 })));
  const response = await POST(request(), params);
  expect(response.status).toBe(422);
  const payload = await response.json();
  expect(payload.error).toContain("Meta code 100"); expect(payload.error).not.toContain("Reconnect"); expect(payload.error).not.toContain("secret");
 });
 it.each([
  ["Australia/Sydney", "2026-10-07", "2026-11-05"],
  ["America/Los_Angeles", "2026-10-06", "2026-11-04"],
 ])("automatically uses %s for relative dates and subsequent generation", async (timezone, sinceIso, untilIso) => {
  vi.setSystemTime(new Date("2026-11-05T23:30:00Z"));
  vi.mocked(fetchMetaAdAccountMetadata).mockResolvedValue({id:"act_123",currency:"AUD",timezone_name:timezone});
  const response=await POST(request({...body,reportType:"WEEKLY",dateSelection:{mode:"last7"}}),params);
  expect(response.status).toBe(200);
  expect(fetchMetaReportCsv).toHaveBeenCalledWith(expect.objectContaining({timezone,sinceIso,untilIso}));
  expect(prisma.client.update).toHaveBeenCalledWith({where:{id:"client_1"},data:{timezone}});
  expect(await response.json()).toMatchObject({accountTimezone:timezone});
 });
 it("preserves explicit calendar dates when the account timezone differs", async () => {
  vi.mocked(fetchMetaAdAccountMetadata).mockResolvedValue({id:"act_123",currency:"AUD",timezone_name:"Australia/Sydney"});
  expect((await POST(request(),params)).status).toBe(200);
  expect(fetchMetaReportCsv).toHaveBeenCalledWith(expect.objectContaining({timezone:"Australia/Sydney",sinceIso:"2026-10-01",untilIso:"2026-10-31"}));
 });
 it("does not hide API mapping problems behind a manual reference CSV",async()=>{expect((await POST(request({...body,referenceManualCsvText:"CSV reference"}),params)).status).toBe(400);expect(fetchMetaReportCsv).not.toHaveBeenCalled();});
 it("honors the explicit server kill switch",async()=>{vi.stubEnv("AD_PLATFORM_API_SYNC_ENABLED","false");expect((await POST(request(),params)).status).toBe(410);});
});


describe("client and Meta account association", () => {
 const linkedClient = {id:"client_1",userId:"owner",accountName:"Client A",metaAdAccountId:"456",metaAdAccountName:"Client A Ads",timezone:"UTC"};
 it("rejects a different account before any provider fetch", async () => {
  vi.mocked(prisma.client.findUnique).mockResolvedValue(linkedClient as never);
  const response = await POST(request(),params);
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({accountConfirmationRequired:true,linkedMetaAdAccountId:"456"});
  expect(fetchMetaAdAccountMetadata).not.toHaveBeenCalled();
  expect(fetchMetaReportCsv).not.toHaveBeenCalled();
 });
 it("acknowledges only the selected ID, not an old confirmation", async () => {
  vi.mocked(prisma.client.findUnique).mockResolvedValue(linkedClient as never);
  expect((await POST(request({...body,confirmedMetaAdAccountId:"act_456"}),params)).status).toBe(409);
 });
 it("allows an explicit one-report override without relinking the client", async () => {
  vi.mocked(prisma.client.findUnique).mockResolvedValue(linkedClient as never);
  const response = await POST(request({...body,confirmedMetaAdAccountId:"123"}),params);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({linkedMetaAdAccountId:"456"});
  expect(prisma.client.updateMany).not.toHaveBeenCalled();
 });
 it("requires confirmation before the first link, then stores only a successful import", async () => {
  vi.mocked(prisma.client.findUnique).mockResolvedValue({...linkedClient,metaAdAccountId:null,metaAdAccountName:null} as never);
  expect((await POST(request(),params)).status).toBe(409);
  expect(prisma.client.updateMany).not.toHaveBeenCalled();
  const response = await POST(request({...body,confirmedMetaAdAccountId:"act_123"}),params);
  expect(response.status).toBe(200);
  expect(prisma.client.updateMany).toHaveBeenCalledWith({where:{id:"client_1",userId:"owner",metaAdAccountId:null},data:{metaAdAccountId:"123",metaAdAccountName:null}});
 });
 it("does not link an account when the provider import fails", async () => {
  vi.mocked(prisma.client.findUnique).mockResolvedValue({...linkedClient,metaAdAccountId:null} as never);
  vi.mocked(fetchMetaReportCsv).mockRejectedValue(new Error("Provider unavailable"));
  expect((await POST(request({...body,confirmedMetaAdAccountId:"123"}),params)).status).toBeGreaterThanOrEqual(400);
  expect(prisma.client.updateMany).not.toHaveBeenCalled();
 });
 it("does not overwrite a first link created concurrently", async () => {
  vi.mocked(prisma.client.findUnique).mockResolvedValue({...linkedClient,metaAdAccountId:null} as never);
  vi.mocked(prisma.client.updateMany).mockResolvedValue({count:0});
  expect((await POST(request({...body,confirmedMetaAdAccountId:"123"}),params)).status).toBe(409);
 });
});


it("does not require acknowledgment for matching IDs with different names", async () => {
 vi.mocked(prisma.client.findUnique).mockResolvedValue({id:"client_1",userId:"owner",accountName:"Legal company name",metaAdAccountId:"123",metaAdAccountName:"Old account label",timezone:"UTC"} as never);
 vi.mocked(fetchMetaAdAccountMetadata).mockResolvedValue({id:"act_123",name:"New account label",currency:"AUD",timezone_name:"UTC"});
 expect((await POST(request(),params)).status).toBe(200);
});
it("does not bind an empty API import", async () => {
 vi.mocked(prisma.client.findUnique).mockResolvedValue({id:"client_1",userId:"owner",metaAdAccountId:null,timezone:"UTC"} as never);
 vi.mocked(fetchMetaReportCsv).mockResolvedValue({csvText:"",rowCount:0,sinceIso:"2026-10-01",untilIso:"2026-10-31"} as never);
 expect((await POST(request({...body,confirmedMetaAdAccountId:"123"}),params)).status).toBe(200);
 expect(prisma.client.updateMany).not.toHaveBeenCalled();
});
