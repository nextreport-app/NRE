import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { report: { findUnique: vi.fn() } },
}));
vi.mock("@vercel/blob", async (original) => ({
  ...(await original<typeof import("@vercel/blob")>()),
  get: vi.fn(),
}));
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { get, BlobError } from "@vercel/blob";
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
  vi.mocked(get).mockImplementation(async (_url, options) => {
    const headers = new Headers(options.headers);
    const etag = '\"blob-version-1\"';
    const range =
      !headers.has("if-range") || headers.get("if-range") === etag
        ? headers.get("range")
        : null;
    const match = range?.match(/^bytes=(\d*)-(\d*)$/);
    let data = bytes;
    const responseHeaders = new Headers({
      etag,
      "content-type":
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    });
    if (match) {
      const start = match[1]
        ? Number(match[1])
        : Math.max(0, bytes.length - Number(match[2]));
      const end =
        match[1] && match[2]
          ? Math.min(Number(match[2]), bytes.length - 1)
          : bytes.length - 1;
      if (
        start >= bytes.length ||
        end < start ||
        (!match[1] && !Number(match[2]))
      )
        throw new BlobError("Failed to fetch blob: 416 Range Not Satisfiable");
      data = bytes.subarray(start, end + 1);
      responseHeaders.set(
        "content-range",
        `bytes ${start}-${end}/${bytes.length}`,
      );
    }
    responseHeaders.set("content-length", String(data.length));
    return {
      statusCode: 200,
      headers: responseHeaders,
      stream: new Response(new Uint8Array(data)).body!,
      blob: { size: data.length },
    } as never;
  });
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
    expect(get).not.toHaveBeenCalled();
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
    expect(get).not.toHaveBeenCalled();
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
    expect(get).not.toHaveBeenCalled();
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

it("asks private storage for only the requested bytes, including its version validator", async () => {
  const request = new Request("http://localhost/download", {
    headers: { Range: "bytes=3-7", "If-Range": '"blob-version-1"' },
  });
  const result = await publicDownload(request, {
    params: Promise.resolve({ token: "shared-token" }),
  });
  expect(get).toHaveBeenCalledWith(
    "private-file",
    expect.objectContaining({
      access: "private",
      abortSignal: request.signal,
      headers: {
        Range: "bytes=3-7",
        "If-Range": '"blob-version-1"',
        "Accept-Encoding": "identity",
      },
    }),
  );
  expect(result.status).toBe(206);
  expect(Buffer.from(await result.arrayBuffer())).toEqual(bytes.subarray(3, 8));
});

it("returns the storage stream without buffering the whole report and propagates cancellation", async () => {
  const canceled = vi.fn();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array([80, 75]));
    },
    cancel: canceled,
  });
  vi.mocked(get).mockResolvedValue({
    statusCode: 200,
    headers: new Headers({ "content-length": "1000000", etag: '"origin"' }),
    stream,
    blob: { size: 1000000 },
  } as never);
  const result = await ownerDownload(new Request("http://localhost/download"), {
    params: Promise.resolve({ id: "report" }),
  });
  const reader = result.body!.getReader();
  expect((await reader.read()).value).toEqual(new Uint8Array([80, 75]));
  await reader.cancel();
  expect(canceled).toHaveBeenCalledOnce();
});

it("keeps parts bounded and stops reading once the part is complete if storage ignores Range", async () => {
  const canceled = vi.fn();
  const source = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(bytes));
    },
    cancel: canceled,
  });
  vi.mocked(get).mockResolvedValue({
    statusCode: 200,
    headers: new Headers({
      "content-length": String(bytes.length),
      etag: '"origin"',
    }),
    stream: source,
    blob: { size: bytes.length },
  } as never);
  const result = await publicDownload(
    new Request("http://localhost/download", {
      headers: { Range: "bytes=3-7" },
    }),
    { params: Promise.resolve({ token: "shared-token" }) },
  );
  expect(result.status).toBe(206);
  expect(result.headers.get("content-range")).toBe(`bytes 3-7/${bytes.length}`);
  expect(Buffer.from(await result.arrayBuffer())).toEqual(bytes.subarray(3, 8));
  expect(canceled).toHaveBeenCalledOnce();
});
