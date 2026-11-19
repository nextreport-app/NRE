import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { report: { findUnique: vi.fn() } },
}));
vi.mock("@/lib/storage", () => ({ readReportFile: vi.fn() }));
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readReportFile } from "@/lib/storage";
import { dailyRangeLabel } from "@/lib/nre/daily-period-selection";
import { GET as ownerDownload } from "../reports/[id]/download/route";
import { GET as publicDownload } from "../r/[token]/download/route";
const fileName =
  `Daily Report - ${dailyRangeLabel({ startIso: "2026-11-01", endIso: "2026-11-13" })}.pptx`.replace(
    /[\s/]/g,
    "_",
  );
const bytes = Buffer.from("PKfixture-pptx");
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({ user: { id: "owner" } } as never);
  vi.mocked(prisma.report.findUnique).mockResolvedValue({
    status: "COMPLETE",
    filePath: "private-file",
    fileName,
    client: { userId: "owner" },
  } as never);
  vi.mocked(readReportFile).mockResolvedValue(bytes);
});
describe("download preserves Unicode report filenames safely", () => {
  it.each(["owner", "public"])(
    "downloads an existing daily report through the %s route",
    async (kind) => {
      const request = new Request("http://localhost/download");
      const response =
        kind === "owner"
          ? await ownerDownload(request, {
              params: Promise.resolve({ id: "report" }),
            })
          : await publicDownload(request, {
              params: Promise.resolve({ token: "shared-token" }),
            });
      expect(response.status).toBe(200);
      const header = response.headers.get("content-disposition")!;
      expect(header).toMatch(
        /^attachment; filename="[\x20-\x7e]+"; filename\*=UTF-8''/,
      );
      expect(decodeURIComponent(header.split("filename*=UTF-8''")[1])).toBe(
        fileName,
      );
      expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
    },
  );
  it("still rejects an unauthenticated owner download", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    expect(
      (
        await ownerDownload(new Request("http://localhost/download"), {
          params: Promise.resolve({ id: "report" }),
        })
      ).status,
    ).toBe(401);
    expect(readReportFile).not.toHaveBeenCalled();
  });
  it("still rejects another owner's report before reading storage", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "other" } } as never);
    expect(
      (
        await ownerDownload(new Request("http://localhost/download"), {
          params: Promise.resolve({ id: "report" }),
        })
      ).status,
    ).toBe(404);
    expect(readReportFile).not.toHaveBeenCalled();
  });
  it("does not download a missing or disabled-token report", async () => {
    vi.mocked(prisma.report.findUnique).mockResolvedValue(null as never);
    expect(
      (
        await publicDownload(new Request("http://localhost/download"), {
          params: Promise.resolve({ token: "disabled-token" }),
        })
      ).status,
    ).toBe(404);
    expect(prisma.report.findUnique).toHaveBeenCalledWith({
      where: { shareToken: "disabled-token" },
    });
    expect(readReportFile).not.toHaveBeenCalled();
  });
});

describe("resumable report transfers", () => {
  it.each(["owner", "public"])(
    "resumes the missing suffix through the %s route without repeating earlier bytes",
    async (kind) => {
      const initial = bytes.subarray(0, 5);
      const request = new Request("http://localhost/download", {
        headers: { Range: "bytes=5-" },
      });
      const response =
        kind === "owner"
          ? await ownerDownload(request, {
              params: Promise.resolve({ id: "report" }),
            })
          : await publicDownload(request, {
              params: Promise.resolve({ token: "shared-token" }),
            });
      expect(response.status).toBe(206);
      expect(response.headers.get("content-range")).toBe(
        `bytes 5-${bytes.length - 1}/${bytes.length}`,
      );
      expect(response.headers.get("accept-ranges")).toBe("bytes");
      const tail = Buffer.from(await response.arrayBuffer());
      expect(response.headers.get("content-length")).toBe(String(tail.length));
      expect(Buffer.concat([initial, tail])).toEqual(bytes);
      expect(response.headers.get("cache-control")).toContain("no-transform");
    },
  );
  it("restarts a changed file rather than joining bytes from different versions", async () => {
    const response = await publicDownload(
      new Request("http://localhost/download", {
        headers: { Range: "bytes=5-", "If-Range": '"old-file"' },
      }),
      { params: Promise.resolve({ token: "shared-token" }) },
    );
    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
  });
  it("returns a bounded suffix and an explicit unsatisfiable-range response", async () => {
    const tail = await publicDownload(
      new Request("http://localhost/download", {
        headers: { Range: "bytes=-4" },
      }),
      { params: Promise.resolve({ token: "shared-token" }) },
    );
    expect(Buffer.from(await tail.arrayBuffer())).toEqual(bytes.subarray(-4));
    const bad = await publicDownload(
      new Request("http://localhost/download", {
        headers: { Range: "bytes=999-" },
      }),
      { params: Promise.resolve({ token: "shared-token" }) },
    );
    expect(bad.status).toBe(416);
    expect(bad.headers.get("content-range")).toBe(`bytes */${bytes.length}`);
    expect((await bad.arrayBuffer()).byteLength).toBe(0);
  });
  it("returns HEAD metadata without a body", async () => {
    const response = await ownerDownload(
      new Request("http://localhost/download", { method: "HEAD" }),
      { params: Promise.resolve({ id: "report" }) },
    );
    expect(response.headers.get("content-length")).toBe(String(bytes.length));
    expect((await response.arrayBuffer()).byteLength).toBe(0);
  });
});

it("honors a matching strong If-Range validator", async () => {
  const initial = await publicDownload(
    new Request("http://localhost/download"),
    { params: Promise.resolve({ token: "shared-token" }) },
  );
  const etag = initial.headers.get("etag")!;
  const resumed = await publicDownload(
    new Request("http://localhost/download", {
      headers: { Range: "bytes=3-7", "If-Range": etag },
    }),
    { params: Promise.resolve({ token: "shared-token" }) },
  );
  expect(resumed.status).toBe(206);
  expect(resumed.headers.get("content-range")).toBe(
    `bytes 3-7/${bytes.length}`,
  );
  expect(Buffer.from(await resumed.arrayBuffer())).toEqual(
    bytes.subarray(3, 8),
  );
});
