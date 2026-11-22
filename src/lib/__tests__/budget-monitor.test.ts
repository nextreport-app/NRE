import { beforeEach,afterEach,describe,it,expect,vi } from "vitest";
import { budgetWindow,budgetFacts,readBudgetSnapshot,effectiveBudgetTolerance } from "../budget-monitor-facts";
import { budgetAlertKey } from "../budget-alert-key";
const mocks=vi.hoisted(()=>({find:vi.fn(),update:vi.fn(),current:vi.fn(),spend:vi.fn(),metadata:vi.fn(),queue:vi.fn(),deliver:vi.fn()}));
vi.mock("../prisma",()=>({prisma:{client:{findUnique:mocks.find,updateMany:mocks.update,findFirst:mocks.current},user:{update:vi.fn()}}}));
vi.mock("../meta-api",()=>({fetchMetaAccountSpend:mocks.spend,fetchMetaAdAccountMetadata:mocks.metadata,ensureFreshMetaAccessToken:vi.fn(async()=>({accessToken:"test-token",refreshed:false}))}));
vi.mock("../meta-token-storage",()=>({decryptMetaToken:()=>"test-token",encryptMetaToken:()=>"encrypted"}));
vi.mock("../subscription",()=>({getSubscriptionStatus:()=>({isBlocked:false})}));
vi.mock("../email-delivery",()=>({queueEmail:mocks.queue,deliverQueuedEmail:mocks.deliver}));
import {checkClientBudget}from "../budget-monitor";
const now=new Date("2026-11-22T12:00:00Z");
const config={monthlyBudget:750,currency:"USD",timezone:"UTC",metaAdAccountId:"123"};
const client={id:"c",userId:"owner",accountName:"A <agency>",...config,budgetMonitorEnabled:true,budgetMonitorEmailEnabled:true,budgetMonitorSnapshot:null,user:{email:"owner@test.example",metaAccessToken:"encrypted",metaTokenExpiresAt:null}};
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(now);vi.clearAllMocks();mocks.find.mockResolvedValue({...client});mocks.current.mockResolvedValue(client);mocks.update.mockResolvedValue({count:1});mocks.metadata.mockResolvedValue({currency:"USD",timezone_name:"UTC"});mocks.spend.mockImplementation(async(_token,_account,_start,end)=>end==="2026-11-22"?500:490);mocks.deliver.mockResolvedValue({accepted:true});});
afterEach(()=>vi.useRealTimers());
describe("approved whole-account budget facts",()=>{
 it("alerts on a material underspend after a full week, excluding early learning days",()=>{
  const early=budgetFacts(750,150,140,budgetWindow("UTC",new Date("2026-11-07T12:00Z")));
  expect(early.level).not.toBe("underspend");
  const week=budgetFacts(750,150,140,budgetWindow("UTC",new Date("2026-11-08T12:00Z")));
  expect(week).toMatchObject({level:"underspend",projected:600,projectedShortfall:150,alertable:true});
 });
 it("tightens the late-month underspend rule without confusing normal remaining budget with a shortfall",()=>{
  // Same $50 projected shortfall is below the early-month 10% noise threshold but material in the final week.
  const early=budgetFacts(750,350,700/30*14,budgetWindow("UTC",new Date("2026-11-15T12:00Z")),10);
  expect(early.level).toBe("within");
  const late=budgetFacts(750,600,560,budgetWindow("UTC",new Date("2026-11-25T12:00Z")),10);
  expect(late).toMatchObject({level:"underspend",projected:700,projectedShortfall:50});
  const close=budgetFacts(750,730,592,budgetWindow("UTC",new Date("2026-11-25T12:00Z")),10);
  expect(close.projectedShortfall).toBe(10);expect(close.level).not.toBe("underspend");
 });
 it("tolerates small final overages while warning when the continuing forecast is materially higher",()=>{
  const end=budgetWindow("UTC",new Date("2026-11-30T12:00Z"));
  expect(budgetFacts(750,755,730,end,10)).toMatchObject({over:5,level:"reached",alertable:false});
  expect(budgetFacts(750,760,730,end,10).alertable).toBe(false);
  expect(budgetFacts(750,760.01,730,end,10).alertable).toBe(true);
  expect(budgetFacts(750,755,750,budgetWindow("UTC",now),10).alertable).toBe(true);
 });
 it("uses an editable currency-denominated allowance and invalidates old rules or changed allowances",()=>{
  expect(effectiveBudgetTolerance(config)).toBe(7.5);
  expect(effectiveBudgetTolerance({...config,budgetMonitorTolerance:10})).toBe(10);
  expect(effectiveBudgetTolerance({...config,monthlyBudget:100,budgetMonitorTolerance:500})).toBe(1);
  const raw=JSON.stringify({version:2,config,month:"2026-11",checkedAt:now.toISOString()});
  expect(readBudgetSnapshot(raw,{...config,budgetMonitorTolerance:10},now)).toBeNull();
  expect(readBudgetSnapshot(raw.replace('"version":2','"version":1'),config,now)).toBeNull();
  expect(budgetAlertKey("c","2026-11",config,"underspend")).not.toBe(budgetAlertKey("c","2026-11",{...config,budgetMonitorTolerance:10},"underspend"));
 });

 it("uses the local month at a UTC month boundary, including leap years",()=>{
  expect(budgetWindow("America/Los_Angeles",new Date("2026-12-01T01:00Z"))).toMatchObject({month:"2026-11",today:"2026-11-30",completedDays:29,days:30});
  expect(budgetWindow("Asia/Kolkata",new Date("2026-11-30T20:00Z"))).toMatchObject({month:"2026-12",today:"2026-12-01",completedDays:0,completedEnd:null});
  expect(budgetWindow("UTC",new Date("2028-02-20T00:00Z")).days).toBe(29);
 });
 it("separates actual thresholds from completed-day estimates without early-month extrapolation",()=>{
  const w=budgetWindow("UTC",now);
  expect(budgetFacts(750,1200,1100,w)).toMatchObject({level:"reached",over:450,remaining:0});
  expect(budgetFacts(750,750,700,w).level).toBe("reached");
  expect(budgetFacts(750,600,550,w).level).toBe("approaching");
  expect(budgetFacts(750,200,600,w)).toMatchObject({level:"projected",projected:600/21*30});
  expect(budgetFacts(750,200,190,w).level).toBe("underspend");
  expect(budgetFacts(750,500,490,w).level).toBe("within");
  expect(budgetFacts(750,100,90,budgetWindow("UTC",new Date("2026-11-03T12:00Z"))).projected).toBeNull();
  expect(budgetFacts(750,0,0,w).projected).toBe(0);
  expect(budgetFacts(1000,900,50,w).projected).toBe(900);
  expect(()=>budgetFacts(0,100,90,w)).toThrow();expect(()=>budgetFacts(750,NaN,null,w)).toThrow();expect(()=>budgetFacts(750,100,-1,w)).toThrow();
 });
 it("invalidates old-month/configuration snapshots and keys alerts once per configuration/month/level",()=>{
  const raw=JSON.stringify({version:2,config,month:"2026-11",checkedAt:now.toISOString(),facts:budgetFacts(750,200,190,budgetWindow("UTC",now))});
  expect(readBudgetSnapshot(raw,config,now)).not.toBeNull();
  expect(readBudgetSnapshot(raw,{...config,monthlyBudget:800},now)).toBeNull();
  expect(readBudgetSnapshot(raw,{...config,metaAdAccountId:"999"},now)).toBeNull();
  expect(readBudgetSnapshot(raw,config,new Date("2026-12-01"))).toBeNull();
  expect(readBudgetSnapshot("invalid",config,now)).toBeNull();
  expect(budgetAlertKey("c","2026-11",config,"reached")).toBe(budgetAlertKey("c","2026-11",config,"reached"));
  expect(budgetAlertKey("c","2026-11",config,"reached")).not.toBe(budgetAlertKey("c","2026-11",{...config,monthlyBudget:800},"reached"));
 });
});
describe("budget monitoring snapshot and delivery boundaries",()=>{
 it("notifies the owner of projected underspend with the shortfall and configured allowance",async()=>{
  const result=await checkClientBudget("c","owner",now);expect(result.facts?.level).toBe("within");expect(mocks.queue).not.toHaveBeenCalled();
  mocks.spend.mockResolvedValue(100);await checkClientBudget("c","owner",now);
  const message=mocks.queue.mock.calls[0][0];expect(message.payload.text).toContain("Projected month-end shortfall");expect(message.payload.text).toContain("Allowed variance: $7.50");expect(message.key.endsWith(":underspend")).toBe(true);
 });
 it("does not queue emails for tolerated final overages",async()=>{
  const end=new Date("2026-11-30T12:00Z");vi.setSystemTime(end);
  mocks.find.mockResolvedValue({...client,budgetMonitorTolerance:10});
  mocks.spend.mockImplementation(async(_token,_account,_start,to)=>to==="2026-11-30"?755:730);
  const result=await checkClientBudget("c","owner",end);expect(result.facts?.over).toBe(5);expect(result.facts?.alertable).toBe(false);expect(mocks.queue).not.toHaveBeenCalled();
 });
 it("queries unfiltered actual and completed-period account spend, storing facts without emailing healthy accounts",async()=>{
  const s=await checkClientBudget("c","owner",now);expect(s.facts?.spent).toBe(500);expect(s.error).toBeUndefined();
  expect(mocks.spend.mock.calls).toEqual([["test-token","123","2026-11-01","2026-11-22"],["test-token","123","2026-11-01","2026-11-21"]]);
  expect(mocks.queue).not.toHaveBeenCalled();
 });
 it("rejects another owner and concurrent checks before Meta access",async()=>{
  await expect(checkClientBudget("c","other",now)).rejects.toMatchObject({status:404});expect(mocks.spend).not.toHaveBeenCalled();
  mocks.update.mockResolvedValue({count:0});await expect(checkClientBudget("c","owner",now)).rejects.toMatchObject({status:429});expect(mocks.spend).not.toHaveBeenCalled();
 });
 it("refuses mismatched currency/timezone without accepting zero or sending an alert",async()=>{
  mocks.metadata.mockResolvedValue({currency:"INR",timezone_name:"UTC"});const s=await checkClientBudget("c","owner",now);
  expect(s.error).toContain("currency/timezone");expect(s.facts).toBeUndefined();expect(mocks.spend).not.toHaveBeenCalled();expect(mocks.queue).not.toHaveBeenCalled();
 });
 it("preserves prior spend with its successful timestamp on network failure, never exposing provider errors",async()=>{
  const previous={version:2,config,month:"2026-11",checkedAt:"2026-11-21T12:00:00Z",facts:budgetFacts(750,700,650,budgetWindow("UTC",now))};mocks.find.mockResolvedValue({...client,budgetMonitorSnapshot:JSON.stringify(previous)});
  mocks.spend.mockRejectedValue(Error("access_token=secret"));const s=await checkClientBudget("c","owner",now);expect(s.facts?.spent).toBe(700);expect(s.checkedAt).toBe(previous.checkedAt);expect(s.error).toContain("sync failed");expect(JSON.stringify(s)).not.toContain("secret");expect(mocks.queue).not.toHaveBeenCalled();
 });
 it("abandons changed configuration before queuing email",async()=>{
  mocks.spend.mockResolvedValue(900);mocks.update.mockResolvedValueOnce({count:1}).mockResolvedValueOnce({count:0});
  expect((await checkClientBudget("c","owner",now)).error).toContain("settings changed");expect(mocks.queue).not.toHaveBeenCalled();
 });
 it("queues an escaped owner-only alert and displays unconfirmed delivery",async()=>{
  mocks.spend.mockResolvedValue(1200);mocks.deliver.mockResolvedValue({accepted:false});const s=await checkClientBudget("c","owner",now);expect(s.facts?.over).toBe(450);expect(s.emailError).toContain("not been confirmed");
  const message=mocks.queue.mock.calls[0][0];expect(message.payload.to).toEqual(["owner@test.example"]);expect(message.payload.html).toContain("&lt;agency&gt;");expect(message.payload.html).not.toContain("A <agency>");expect(message.key).toBe(budgetAlertKey("c","2026-11",config,"reached"));
 });
 it("respects owner email opt-out",async()=>{
  mocks.find.mockResolvedValue({...client,budgetMonitorEmailEnabled:false});mocks.spend.mockResolvedValue(1200);expect((await checkClientBudget("c","owner",now)).facts?.level).toBe("reached");expect(mocks.queue).not.toHaveBeenCalled();
 });
});
