import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@vercel/blob", () => ({
  list: vi.fn(),
  del: vi.fn().mockResolvedValue(undefined),
}));

import { del, list } from "@vercel/blob";
import { purgeStaleWizardBlobs } from "@/lib/wizard-storage-cleanup";

const listMock = vi.mocked(list);
const delMock = vi.mocked(del);

describe("purgeStaleWizardBlobs", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("deletes upload sessions and drafts older than TTL", async () => {
    const now = Date.parse("2026-10-12T12:00:00.000Z");
    listMock
      .mockResolvedValueOnce({
        blobs: [
          {
            url: "https://blob/upload-old",
            pathname: "wizard-upload-sessions/u/c/s.json",
            downloadUrl: "https://blob/download", size: 1, etag: "test",
            uploadedAt: new Date("2026-10-10T12:00:00.000Z"),
          },
          {
            url: "https://blob/upload-new",
            pathname: "wizard-upload-sessions/u/c/s2.json",
            downloadUrl: "https://blob/download", size: 1, etag: "test",
            uploadedAt: new Date("2026-10-12T10:00:00.000Z"),
          },
        ],
        hasMore: false,
        cursor: undefined,
      })
      .mockResolvedValueOnce({
        blobs: [
          {
            url: "https://blob/draft-old",
            pathname: "wizard-drafts/u/c.json",
            downloadUrl: "https://blob/download", size: 1, etag: "test",
            uploadedAt: new Date("2026-09-01T12:00:00.000Z"),
          },
        ],
        hasMore: false,
        cursor: undefined,
      });

    const result = await purgeStaleWizardBlobs(now, 50);

    expect(result).toEqual({ uploadSessions: 1, drafts: 1 });
    expect(delMock).toHaveBeenCalledTimes(2);
    expect(delMock).toHaveBeenCalledWith(["https://blob/upload-old"]);
    expect(delMock).toHaveBeenCalledWith(["https://blob/draft-old"]);
  });
});
