import { afterEach, describe, expect, it, vi } from "vitest";
import { isCronBearerAuthorized, isInternalWorkerPath } from "../internal-cron-auth";

describe("isInternalWorkerPath", () => {
  it("matches cron and generate-report worker routes", () => {
    expect(isInternalWorkerPath("/api/cron/purge-reports")).toBe(true);
    expect(isInternalWorkerPath("/api/jobs/generate-report")).toBe(true);
    expect(isInternalWorkerPath("/api/clients/x/reports")).toBe(false);
  });
});

describe("isCronBearerAuthorized", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns false when CRON_SECRET is unset", () => {
    vi.stubEnv("CRON_SECRET", "");
    const req = new Request("https://nextreport.in/api/cron/purge-reports", {
      headers: { Authorization: "Bearer anything" },
    });
    expect(isCronBearerAuthorized(req)).toBe(false);
  });

  it("returns true only for exact Bearer match", () => {
    vi.stubEnv("CRON_SECRET", "test-secret");
    const ok = new Request("https://nextreport.in/api/jobs/generate-report", {
      headers: { Authorization: "Bearer test-secret" },
    });
    const bad = new Request("https://nextreport.in/api/jobs/generate-report", {
      headers: { Authorization: "Bearer wrong" },
    });
    expect(isCronBearerAuthorized(ok)).toBe(true);
    expect(isCronBearerAuthorized(bad)).toBe(false);
  });
});
