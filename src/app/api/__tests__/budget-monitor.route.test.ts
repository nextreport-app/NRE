import {beforeEach,it,expect,vi}from "vitest";
const m=vi.hoisted(()=>({user:"owner",find:vi.fn(),update:vi.fn(),check:vi.fn()}));
vi.mock("@/lib/auth",()=>({auth:async()=>m.user?{user:{id:m.user}}:null}));
vi.mock("@/lib/prisma",()=>({prisma:{client:{findUnique:m.find,update:m.update}}}));
vi.mock("@/lib/budget-monitor",()=>({checkClientBudget:m.check}));
import{GET,POST}from "../clients/[id]/budget-monitor/route";
const ctx={params:Promise.resolve({id:"c"})};
const req=(body?:object)=>new Request("https://nextreport.in/api/clients/c/budget-monitor",body?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{});
beforeEach(()=>{vi.clearAllMocks();m.user="owner";m.find.mockResolvedValue({id:"c",userId:"owner",monthlyBudget:750,metaAdAccountId:"123",currency:"USD",timezone:"UTC",budgetMonitorEnabled:true,budgetMonitorEmailEnabled:true,budgetMonitorSnapshot:null,secret:"DO-NOT-EXPORT"});m.check.mockResolvedValue({month:"2026-11"});});
it("requires authentication and ownership before any check or change",async()=>{
 m.user="";expect((await GET(req(),ctx)).status).toBe(401);expect(m.find).not.toHaveBeenCalled();
 m.user="other";expect((await POST(req({action:"check"}),ctx)).status).toBe(404);expect(m.check).not.toHaveBeenCalled();expect(m.update).not.toHaveBeenCalled();
});
it("exports only owner-safe fields without automatically syncing Meta",async()=>{
 const r=await GET(req(),ctx);expect(r.headers.get("cache-control")).toBe("private, no-store");const text=await r.text();expect(text).not.toContain("DO-NOT-EXPORT");expect(JSON.parse(text).budget).toBe(750);expect(m.check).not.toHaveBeenCalled();
});
it("rejects an unlinked account or absent budget before enabling",async()=>{
 m.find.mockResolvedValue({userId:"owner",monthlyBudget:750,metaAdAccountId:null});expect((await POST(req({action:"settings",enabled:true,emailEnabled:true}),ctx)).status).toBe(400);expect(m.update).not.toHaveBeenCalled();
});
it("checks only the authenticated owner and explicitly saves opt-out",async()=>{
 expect((await POST(req({action:"check"}),ctx)).status).toBe(200);expect(m.check).toHaveBeenCalledWith("c","owner");
 await POST(req({action:"settings",enabled:false,emailEnabled:false}),ctx);expect(m.update).toHaveBeenCalledWith({where:{id:"c"},data:{budgetMonitorEnabled:false,budgetMonitorEmailEnabled:false}});
});
it("validates actions and settings",async()=>{expect((await POST(req({action:"settings",enabled:"true",emailEnabled:true}),ctx)).status).toBe(400);expect(m.update).not.toHaveBeenCalled();});

it("validates and saves an explicit variance without changing the approved budget",async()=>{
 expect((await POST(req({action:"settings",enabled:true,emailEnabled:true,tolerance:10}),ctx)).status).toBe(200);
 expect(m.update).toHaveBeenCalledWith({where:{id:"c"},data:{budgetMonitorEnabled:true,budgetMonitorEmailEnabled:true,budgetMonitorTolerance:10}});
 m.update.mockClear();expect((await POST(req({action:"settings",enabled:true,emailEnabled:true,tolerance:800}),ctx)).status).toBe(400);expect(m.update).not.toHaveBeenCalled();
 expect((await POST(req({action:"settings",enabled:true,emailEnabled:true,tolerance:-1}),ctx)).status).toBe(400);
});
