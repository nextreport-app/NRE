import { beforeEach, describe, it, expect, vi } from "vitest";
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    client: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("@/lib/performance-monitor/service", () => ({
  checkClientPerformance: vi.fn(),
}));
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkClientPerformance } from "@/lib/performance-monitor/service";
import { POST } from "../clients/[id]/performance-monitor/route";
import { GET } from "../agency-overview/route";
const params = { params: Promise.resolve({ id: "client" }) };
const request = (body: object) =>
  new Request("http://localhost/api/clients/client/performance-monitor", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({ user: { id: "owner" } } as never);
  vi.mocked(prisma.client.findUnique).mockResolvedValue({
    id: "client",
    userId: "owner",
    metaAdAccountId: "123",
    timezone:"UTC",currency:"USD",
  } as never);
  vi.mocked(prisma.client.findMany).mockResolvedValue([]);
  vi.mocked(checkClientPerformance).mockResolvedValue({ version: 1 } as never);
});
describe("performance monitoring owner controls", () => {
  it("requires login for reads and writes", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    expect((await GET()).status).toBe(401);
    expect((await POST(request({ action: "check" }), params)).status).toBe(401);
    expect(checkClientPerformance).not.toHaveBeenCalled();
  });
  it("does not expose another owner's clients", async () => {
    vi.mocked(prisma.client.findUnique).mockResolvedValue({
      userId: "other",
    } as never);
    expect((await POST(request({ action: "check" }), params)).status).toBe(404);
    expect(checkClientPerformance).not.toHaveBeenCalled();
  });
  it("scopes the overview query and keeps its response private", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(prisma.client.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "owner" } }),
    );
    expect(checkClientPerformance).not.toHaveBeenCalled();
  });
  it("saves opt-in preferences without a Meta fetch or email", async () => {
    expect(
      (
        await POST(
          request({ action: "settings", enabled: true, emailEnabled: false }),
          params,
        )
      ).status,
    ).toBe(200);
    expect(prisma.client.update).toHaveBeenCalledWith({
      where: { id: "client" },
      data: {
        performanceMonitorEnabled: true,
        performanceMonitorEmailEnabled: false,
      },
    });
    expect(checkClientPerformance).not.toHaveBeenCalled();
  });
  it("requires a linked account before opt-in", async () => {
    vi.mocked(prisma.client.findUnique).mockResolvedValue({
      userId: "owner",
      metaAdAccountId: null,
    } as never);
    expect(
      (
        await POST(
          request({ action: "settings", enabled: true, emailEnabled: true }),
          params,
        )
      ).status,
    ).toBe(400);
    expect(prisma.client.update).not.toHaveBeenCalled();
  });
  it("explicitly refreshes the owned account", async () => {
    expect((await POST(request({ action: "check" }), params)).status).toBe(200);
    expect(checkClientPerformance).toHaveBeenCalledWith("client", "owner");
  });
  it("rejects malformed settings", async () => {
    expect(
      (
        await POST(
          request({ action: "settings", enabled: "yes", emailEnabled: true }),
          params,
        )
      ).status,
    ).toBe(400);
    expect(prisma.client.update).not.toHaveBeenCalled();
  });
});

it("saves owned comparison settings and invalidates cached evidence without fetching",async()=>{
 expect((await POST(request({action:"comparison",days:30}),params)).status).toBe(200);
 expect(prisma.client.update).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({performanceWindowDays:30,performanceMonitorSnapshot:null})}));
 expect(checkClientPerformance).not.toHaveBeenCalled();
});
it("rejects invalid historical dates before mutation",async()=>{
 expect((await POST(request({action:"comparison",days:7,customStart:"2026-02-30",customEnd:"2026-03-01"}),params)).status).toBe(400);
 expect(prisma.client.update).not.toHaveBeenCalled();
});
it("binds targets to the owned account and currency",async()=>{
 expect((await POST(request({action:"targets",rules:{"456":{objective:"PURCHASES",maxCpr:20,minRoas:2}}}),params)).status).toBe(200);
 const data=vi.mocked(prisma.client.update).mock.calls[0][0].data;
 expect(JSON.parse(data.performanceTargetRules as string)).toEqual({accountId:"123",currency:"USD",rules:{"456":{objective:"PURCHASES",maxCpr:20,minRoas:2}}});
});
it("rejects ROAS targets on non-purchase objectives",async()=>{
 expect((await POST(request({action:"targets",rules:{"456":{objective:"LEADS",minRoas:2}}}),params)).status).toBe(400);
 expect(prisma.client.update).not.toHaveBeenCalled();
});
