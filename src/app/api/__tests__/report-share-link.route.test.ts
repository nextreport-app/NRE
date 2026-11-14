import {beforeEach,describe,it,expect,vi} from "vitest";
vi.mock("@/lib/auth",()=>({auth:vi.fn()}));
vi.mock("@/lib/prisma",()=>({prisma:{report:{updateMany:vi.fn()}}}));
import {auth} from "@/lib/auth";
import {prisma} from "@/lib/prisma";
import {POST} from "../reports/[id]/share-link/route";
const params={params:Promise.resolve({id:"report"})};
const request=(action:string,origin="https://nextreport.in")=>new Request("https://nextreport.in/api/reports/report/share-link",{method:"POST",headers:{"Content-Type":"application/json",origin},body:JSON.stringify({action})});
beforeEach(()=>{vi.clearAllMocks();vi.mocked(auth).mockResolvedValue({user:{id:"owner"}} as never);vi.mocked(prisma.report.updateMany).mockResolvedValue({count:1});});
describe("report link access",()=>{
 it("requires authentication",async()=>{vi.mocked(auth).mockResolvedValue(null as never);expect((await POST(request("reset"),params)).status).toBe(401);expect(prisma.report.updateMany).not.toHaveBeenCalled();});
 it("rejects foreign origins",async()=>{expect((await POST(request("reset","https://other.test"),params)).status).toBe(403);expect(prisma.report.updateMany).not.toHaveBeenCalled();});
 it("disables the link with an owner- and completion-scoped update",async()=>{expect((await POST(request("disable"),params)).status).toBe(200);expect(prisma.report.updateMany).toHaveBeenCalledWith({where:{id:"report",status:"COMPLETE",client:{userId:"owner"}},data:{shareToken:null}});});
 it("generates a new unguessable token",async()=>{const json=await(await POST(request("reset"),params)).json();expect(json.shareToken).toMatch(/^[a-zA-Z0-9]{12}$/);});
 it("does not modify another user's report",async()=>{vi.mocked(prisma.report.updateMany).mockResolvedValue({count:0});expect((await POST(request("disable"),params)).status).toBe(404);});
 it("rejects invalid actions",async()=>{expect((await POST(request("delete"),params)).status).toBe(400);expect(prisma.report.updateMany).not.toHaveBeenCalled();});
});
