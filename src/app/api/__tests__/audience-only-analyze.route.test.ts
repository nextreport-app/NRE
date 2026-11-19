import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/auth", () => ({
  auth: async () => ({ user: { id: "owner" } }),
}));
vi.mock("@/lib/subscription-guard", () => ({
  requireActiveSubscription: async () => null,
}));
vi.mock("@/lib/usage-rate-limit", () => ({
  enforceWizardLimits: async () => null,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    client: {
      findUnique: async () => ({
        id: "client",
        userId: "owner",
        currency: "USD",
        timezone: "UTC",
        previousMonthDataUrl: null,
      }),
    },
  },
}));
vi.mock("@/lib/nre/meta-custom-conversion-catalog", () => ({
  tryFetchMetaCustomConversionResultTypesForUser: async () => undefined,
}));
vi.mock("@/lib/nre/previous-month-data", () => ({
  loadPreviousMonthDataRowsForCampaigns: async () => undefined,
}));
const saved = vi.hoisted(() =>
  vi.fn().mockResolvedValue("11111111-1111-4111-8111-111111111111"),
);
vi.mock("@/lib/nre/wizard-upload-session", () => ({
  saveWizardUploadSession: saved,
  hashUploadBuffer: () => "original",
}));
import { POST } from "../clients/[id]/reports/analyze/route";
function req(type = "WEEKLY",choice:unknown={kind:"BREAKDOWN",dimension:"age"}) {
  const csv =
    "Campaign name,Ad set name,Day,Amount spent (USD),Impressions,Results,Result type,Age\nExample,Set,2026-11-10,10,100,1,Leads (form),18-24\nExample,Set,2026-11-10,20,200,2,Leads (form),25-34";
  const form = new FormData();
  form.set("mtdDailyCsv", new File([csv], "age.csv"));
  form.set("reportType", JSON.stringify(type));
  form.set("dateSelection",JSON.stringify({mode:"custom",customStart:"2026-11-10",customEnd:"2026-11-10"}));
  if(choice)form.set("reportSelection",JSON.stringify(choice));
  return new Request("http://localhost/analyze", {
    method: "POST",
    body: form,
  });
}
describe("audience-only wizard entry", () => {
  it("validates the chosen Breakdown source and persists its choice alongside routing facts", async () => {
    const response = await POST(req(), {
      params: Promise.resolve({ id: "client" }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      valid: true,
      sourceContentOnly: true,
    });
    const payload = saved.mock.calls[0][0];
    expect(payload.metaReportContent).toMatchObject({
      sourceOnly: true,
      options: { includeStandard: false, audience: ["age"] },
    });
    expect(payload.rows).toHaveLength(1);
    expect(payload.headers).not.toContain("Age");
  });
  it("rejects a different selected dimension instead of generating the wrong view",async()=>{
    const response=await POST(req("WEEKLY",{kind:"BREAKDOWN",dimension:"location"}),{params:Promise.resolve({id:"client"})});expect(await response.json()).toMatchObject({valid:false,errors:[{field:"reportContent",message:expect.stringContaining("selected on Import")}]});
  });
  it("accepts an Ads-level Creative CSV as the primary upload",async()=>{
    const form=new FormData();form.set("mtdDailyCsv",new File(["Campaign name,Ad set name,Day,Amount spent (USD),Impressions,Results,Result type,Ad ID,Ad name\nExample,Set,2026-11-10,30,300,1,Leads (form),100,Creative A"],"ads.csv"));form.set("reportType",'"WEEKLY"');form.set("reportSelection",JSON.stringify({kind:"CREATIVE"}));form.set("dateSelection",JSON.stringify({mode:"custom",customStart:"2026-11-10",customEnd:"2026-11-10"}));
    const response=await POST(new Request("http://localhost/analyze",{method:"POST",body:form}),{params:Promise.resolve({id:"client"})});expect(await response.json()).toMatchObject({valid:true,reportContentPrepared:true});expect(saved.mock.calls.at(-1)?.[0].metaReportContent).toMatchObject({selection:{kind:"CREATIVE"},options:{creatives:true,includeStandard:false},sources:[{kind:"creative"}]});
  });
  it("does not silently turn a comparison into an audience-only report", async () => {
    const response = await POST(req("COMPARISON",null), {
      params: Promise.resolve({ id: "client" }),
    });
    expect(await response.json()).toMatchObject({
      valid: false,
      errors: [
        {
          field: "reportSelection",
          message: expect.stringContaining("Choose Breakdown on Import"),
        },
      ],
    });
  });
});
