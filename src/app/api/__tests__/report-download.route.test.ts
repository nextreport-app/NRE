import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { report: { findUnique: vi.fn() } } }));
vi.mock("@/lib/storage", () => ({ readReportFile: vi.fn() }));
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readReportFile } from "@/lib/storage";
import { dailyRangeLabel } from "@/lib/nre/daily-period-selection";
import { GET as ownerDownload } from "../reports/[id]/download/route";
import { GET as publicDownload } from "../r/[token]/download/route";
const fileName = `Daily Report - ${dailyRangeLabel({startIso:"2026-11-01",endIso:"2026-11-13"})}.pptx`.replace(/[\s/]/g,"_");
const bytes = Buffer.from("PKfixture-pptx");
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({user:{id:"owner"}} as never);
  vi.mocked(prisma.report.findUnique).mockResolvedValue({status:"COMPLETE",filePath:"private-file",fileName,client:{userId:"owner"}} as never);
  vi.mocked(readReportFile).mockResolvedValue(bytes);
});
describe("download preserves Unicode report filenames safely", () => {
  it.each(["owner","public"])("downloads an existing daily report through the %s route", async kind => {
    const request = new Request("http://localhost/download");
    const response = kind === "owner" ? await ownerDownload(request,{params:Promise.resolve({id:"report"})}) : await publicDownload(request,{params:Promise.resolve({token:"shared-token"})});
    expect(response.status).toBe(200);
    const header = response.headers.get("content-disposition")!;
    expect(header).toMatch(/^attachment; filename="[\x20-\x7e]+"; filename\*=UTF-8''/);
    expect(decodeURIComponent(header.split("filename*=UTF-8''")[1])).toBe(fileName);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
  });
  it("still rejects an unauthenticated owner download", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    expect((await ownerDownload(new Request("http://localhost/download"),{params:Promise.resolve({id:"report"})})).status).toBe(401);
    expect(readReportFile).not.toHaveBeenCalled();
  });
  it("still rejects another owner's report before reading storage", async () => {
    vi.mocked(auth).mockResolvedValue({user:{id:"other"}} as never);
    expect((await ownerDownload(new Request("http://localhost/download"),{params:Promise.resolve({id:"report"})})).status).toBe(404);
    expect(readReportFile).not.toHaveBeenCalled();
  });
  it("does not download a missing or disabled-token report", async () => {
    vi.mocked(prisma.report.findUnique).mockResolvedValue(null as never);
    expect((await publicDownload(new Request("http://localhost/download"),{params:Promise.resolve({token:"disabled-token"})})).status).toBe(404);
    expect(prisma.report.findUnique).toHaveBeenCalledWith({where:{shareToken:"disabled-token"}});
    expect(readReportFile).not.toHaveBeenCalled();
  });
});
