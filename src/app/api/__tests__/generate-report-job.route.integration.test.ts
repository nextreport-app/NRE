import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { jsonBody } from "@/test/api-route-harness";

vi.mock("@/lib/nre/report-generation-job", () => ({
  processReportGeneration: vi.fn(),
}));

import { processReportGeneration } from "@/lib/nre/report-generation-job";
import { POST } from "../jobs/generate-report/route";

describe("POST /api/jobs/generate-report", () => {
  const originalSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = "test-cron-secret";
    vi.mocked(processReportGeneration).mockReset();
    vi.mocked(processReportGeneration).mockResolvedValue(undefined);
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalSecret;
  });

  it("returns 503 when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;
    const res = await POST(
      new Request("http://localhost/api/jobs/generate-report", {
        method: "POST",
        headers: { Authorization: "Bearer test-cron-secret" },
        body: JSON.stringify({ reportId: "r1" }),
      }),
    );
    expect(res.status).toBe(503);
  });

  it("returns 401 without bearer token", async () => {
    const res = await POST(
      new Request("http://localhost/api/jobs/generate-report", {
        method: "POST",
        body: JSON.stringify({ reportId: "r1" }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid body", async () => {
    const res = await POST(
      new Request("http://localhost/api/jobs/generate-report", {
        method: "POST",
        headers: { Authorization: "Bearer test-cron-secret" },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("processes the report when authorized", async () => {
    const res = await POST(
      new Request("http://localhost/api/jobs/generate-report", {
        method: "POST",
        headers: { Authorization: "Bearer test-cron-secret" },
        body: JSON.stringify({ reportId: "report_abc" }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await jsonBody<{ ok: boolean; reportId: string }>(res);
    expect(body.ok).toBe(true);
    expect(body.reportId).toBe("report_abc");
    expect(processReportGeneration).toHaveBeenCalledWith("report_abc");
  });
});
