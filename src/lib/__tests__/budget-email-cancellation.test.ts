import{beforeEach,it,expect,vi}from "vitest";
const m=vi.hoisted(()=>({email:vi.fn(),client:vi.fn(),update:vi.fn(),send:vi.fn()}));
vi.mock("../prisma",()=>({prisma:{emailDelivery:{findUnique:m.email,update:m.update},client:{findUnique:m.client}}}));
vi.mock("../email",()=>({FROM_ADDRESS:"test@test.example",getResendClient:()=>({emails:{send:m.send}})}));
vi.mock("../subscription",()=>({getSubscriptionStatus:()=>({isBlocked:false})}));
import{deliverQueuedEmail}from "../email-delivery";
import{budgetAlertKey}from "../budget-alert-key";
const config={monthlyBudget:750,currency:"USD",timezone:"UTC",metaAdAccountId:"123"};
const now=new Date("2026-11-22T12:00Z");const key=budgetAlertKey("c","2026-11",config,"reached");
beforeEach(()=>{vi.clearAllMocks();m.email.mockResolvedValue({key,kind:"BUDGET_ALERT",userId:"owner",status:"PENDING",payloadJson:JSON.stringify({to:["owner@example.test"]})});});
it.each(["disabled","new budget","next month","no snapshot","recipient changed"])("cancels obsolete alerts: %s",async reason=>{
 const client={id:"c",userId:"owner",user:{email:"owner@example.test"},...config,budgetMonitorEnabled:reason!=="disabled",budgetMonitorEmailEnabled:true,budgetMonitorSnapshot:reason==="no snapshot"?null:JSON.stringify({version:2,config,month:"2026-11",checkedAt:now.toISOString(),facts:{level:"reached",alertable:true}})};
 if(reason==="new budget")client.monthlyBudget=800;if(reason==="recipient changed")client.user.email="new@example.test";
 m.client.mockResolvedValue(client);const r=await deliverQueuedEmail(key,reason==="next month"?new Date("2026-12-01T12:00Z"):now);expect(r.cancelled).toBe(true);expect(m.update).toHaveBeenCalledWith({where:{key},data:{status:"CANCELLED"}});expect(m.send).not.toHaveBeenCalled();
});
it("cancels a previously queued reached-budget alert when the current overage is now tolerated",async()=>{
 m.client.mockResolvedValue({id:"c",userId:"owner",user:{email:"owner@example.test"},...config,budgetMonitorEnabled:true,budgetMonitorEmailEnabled:true,budgetMonitorSnapshot:JSON.stringify({version:2,config,month:"2026-11",checkedAt:now.toISOString(),facts:{level:"reached",alertable:false}})});
 expect((await deliverQueuedEmail(key,now)).cancelled).toBe(true);expect(m.send).not.toHaveBeenCalled();
});
