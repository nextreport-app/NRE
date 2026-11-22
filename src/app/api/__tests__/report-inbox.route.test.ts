import { beforeEach, describe, it, expect, vi } from "vitest";
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { scheduledReportRun: { groupBy: vi.fn(), findMany: vi.fn() } },
}));
vi.mock("@/lib/report-schedules/health", () => ({
  schedulerHealth: vi
    .fn()
    .mockResolvedValue({ healthy: false, configured: false, lastTickAt: null }),
}));
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GET } from "../report-inbox/route";
const request = (query = "") =>
  new Request(`https://nextreport.in/api/report-inbox${query}`);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({ user: { id: "owner" } } as never);
  vi.mocked(prisma.scheduledReportRun.groupBy).mockResolvedValue([
    { status: "READY", _count: { _all: 31 } },
  ] as never);
  vi.mocked(prisma.scheduledReportRun.findMany).mockResolvedValue([]);
});
describe("private owner report inbox", () => {
  it("requires authentication before any database read", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    expect((await GET(request())).status).toBe(401);
    expect(prisma.scheduledReportRun.groupBy).not.toHaveBeenCalled();
    expect(prisma.scheduledReportRun.findMany).not.toHaveBeenCalled();
  });
  it("scopes counts and rows to the owner, keeps data private, and pages without a per-schedule cap", async () => {
    const response = await GET(request("?view=ready&page=2&q=Express"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toMatchObject({
      total: 31,
      page: 2,
      pages: 2,
    });
    const scope = {
      schedule: {
        client: {
          userId: "owner",
          accountName: { contains: "Express", mode: "insensitive" },
        },
      },
    };
    expect(prisma.scheduledReportRun.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: scope }),
    );
    expect(prisma.scheduledReportRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ...scope, status: { in: ["READY"] } },
        skip: 25,
        take: 25,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      }),
    );
  });
  it("clamps a disappearing final page after drafts leave the selected view", async () => {
    vi.mocked(prisma.scheduledReportRun.groupBy).mockResolvedValue([
      { status: "READY", _count: { _all: 1 } },
    ] as never);
    const response = await GET(request("?page=2"));
    expect(await response.json()).toMatchObject({ page: 1, pages: 1 });
    expect(prisma.scheduledReportRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0 }),
    );
  });
  it.each([
    "?view=bad",
    "?page=-1",
    "?page=1.5",
    "?page=10001",
    `?q=${"x".repeat(101)}`,
  ])(
    "rejects invalid filters before reading private data: %s",
    async (query) => {
      expect((await GET(request(query))).status).toBe(400);
      expect(prisma.scheduledReportRun.findMany).not.toHaveBeenCalled();
    },
  );
  it("uses a distinct history filter rather than hiding old awaiting-review drafts", async () => {
    await GET(request("?view=history"));
    expect(prisma.scheduledReportRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          schedule: { client: { userId: "owner" } },
          status: { in: ["SENT", "SKIPPED"] },
        },
      }),
    );
  });
});
