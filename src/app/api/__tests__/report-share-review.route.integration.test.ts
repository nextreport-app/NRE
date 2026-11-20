import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { report: { findUnique: vi.fn(), update: vi.fn() } },
}));
vi.mock("@/lib/usage-rate-limit", () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/storage", () => ({
  saveReportFile: vi.fn().mockResolvedValue("blob:new.pptx"),
  readLogoFile: vi.fn(),
}));
vi.mock("@/lib/pptx/templates", () => ({
  loadTemplateBufferForPlatform: vi
    .fn()
    .mockResolvedValue(Buffer.from("template")),
}));
vi.mock("@/lib/nre/regenerate-report", () => ({
  regeneratePptxFromShare: vi.fn().mockResolvedValue(Buffer.from("pptx")),
}));
import { auth } from "@/lib/auth";
import { regeneratePptxFromShare } from "@/lib/nre/regenerate-report";
import { saveReportFile } from "@/lib/storage";
import { prisma } from "@/lib/prisma";
import { buildReportData } from "@/lib/nre/report-data";
import { buildShareReportData } from "@/lib/nre/share-report";
import { GET, PATCH } from "../clients/[id]/reports/[reportId]/route";
const params = {
  params: Promise.resolve({ id: "client_1", reportId: "report_1" }),
};
const share = buildShareReportData(
  buildReportData({
    accountName: "Example",
    currencySymbol: "$",
    timezone: "UTC",
    monthlyBudget: null,
    mtdDailyRows: [],
    now: new Date("2026-10-01T12:00:00Z"),
  }),
  new Map(),
);
const report = {
  id: "report_1",
  clientId: "client_1",
  client: { userId: "owner", template: "DARK", logoUrl: null },
  shareToken: "token",
  status: "COMPLETE",
  filePath: "blob:old.pptx",
  slidesUrl: "https://docs.google.com/presentation/d/old",
  summaryJson: JSON.stringify({
    ...share,
    _renderArchive: {
      reportData: {},
      aiCopy: {},
      currencySymbol: "$",
      isLightTemplate: false,
    },
  }),
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({ user: { id: "owner" } } as never);
  vi.mocked(prisma.report.findUnique).mockResolvedValue(report as never);
});
describe("report review boundary", () => {
  it("does not parse comparison records as weekly share data", async () => {
    vi.mocked(prisma.report.findUnique).mockResolvedValue({
      ...report,
      summaryJson: JSON.stringify({
        version: 1,
        kind: "comparison",
        campaigns: [],
      }),
    } as never);
    const response = await GET(new Request("http://localhost/review"), params);
    expect(response.status).toBe(200);
    expect((await response.json()).share).toBeNull();
  });
  it("does not expose another owner's report", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "other" } } as never);
    expect(
      (await GET(new Request("http://localhost/review"), params)).status,
    ).toBe(404);
  });
  it("rejects publishing an empty report before writing a deck", async () => {
    const empty = {
      ...share,
      isPaused: false,
      visibility: {
        cover: false,
        overview: false,
        combinedTotal: false,
        metricGuide: false,
        campaigns: {},
        adSets: {},
      },
    };
    vi.mocked(prisma.report.findUnique).mockResolvedValue({
      ...report,
      summaryJson: JSON.stringify(empty),
    } as never);
    const response = await PATCH(
      new Request("http://localhost/review", {
        method: "PATCH",
        body: JSON.stringify({
          shareReview: {
            publish: true,
            visibility: empty.visibility,
            campaigns: [],
            adSets: [],
          },
        }),
      }),
      params,
    );
    expect(response.status).toBe(400);
    expect(prisma.report.update).not.toHaveBeenCalled();
  });
  it("publishes browser edits without replacing the PPTX or invalidating Google Slides", async () => {
    const response = await PATCH(new Request("http://localhost/review", {
      method: "PATCH",
      body: JSON.stringify({ shareReview: {
        publish: true, target: "browser", visibility: share.visibility, campaigns: [], adSets: [],
        cover: { accountName: "Edited browser title", dateRange: "November 11–17", healthBadge: "" },
      } }),
    }), params);
    expect(response.status).toBe(200);
    expect(regeneratePptxFromShare).not.toHaveBeenCalled();
    expect(saveReportFile).not.toHaveBeenCalled();
    const update = vi.mocked(prisma.report.update).mock.calls[0][0];
    expect(update.data).not.toHaveProperty("filePath");
    expect(update.data).not.toHaveProperty("slidesUrl");
    const saved = JSON.parse(update.data.summaryJson as string);
    expect(saved.accountName).toBe("Edited browser title");
    expect(saved.publishedAt).toEqual(expect.any(String));
  });
  it("edits audience captions and visibility without changing source metrics or PPTX",async()=>{
    const row={key:"25-34",name:"25-34",spend:12.34,impressions:100,results:2,ctr:5,cpr:6.17,cpc:2.46,cpm:123.4,roas:null,websiteCvr:null,eligible:true};
    const metaContent={includeStandard:false,currencySymbol:"$",media:{},notices:[],pages:[{id:"age-page",kind:"audience",title:"Age performance",dateLabel:"Nov 10–11",objective:"Leads",costLabel:"Cost per lead",rows:[row],note:"Source note"}]};
    vi.mocked(prisma.report.findUnique).mockResolvedValue({...report,summaryJson:JSON.stringify({...share,metaContent})} as never);
    const response=await PATCH(new Request("http://localhost/review",{method:"PATCH",body:JSON.stringify({shareReview:{publish:true,target:"browser",visibility:share.visibility,campaigns:[],adSets:[],metaPages:[{id:"age-page",title:"Audience age",note:"Reviewed",insight:"Reviewed summary",visible:true,rows:[{spend:999}]}]}})}),params);
    expect(response.status).toBe(200);
    const saved=JSON.parse(vi.mocked(prisma.report.update).mock.calls[0][0].data.summaryJson as string);
    expect(saved.metaContent.pages[0]).toMatchObject({title:"Audience age",note:"Reviewed",insight:"Reviewed summary",visible:true,rows:[row]});
    expect(regeneratePptxFromShare).not.toHaveBeenCalled();
  });
  it("invalidates cached Slides only after a successful publish", async () => {
    const response = await PATCH(
      new Request("http://localhost/review", {
        method: "PATCH",
        body: JSON.stringify({
          shareReview: {
            publish: true,
            visibility: share.visibility,
            campaigns: [],
            adSets: [],
          },
        }),
      }),
      params,
    );
    expect(response.status).toBe(200);
    expect(prisma.report.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          filePath: "blob:new.pptx",
          slidesUrl: null,
        }),
      }),
    );
  });
});
