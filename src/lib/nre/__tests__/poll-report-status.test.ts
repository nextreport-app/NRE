import { describe, expect, it, vi } from "vitest";
import { pollReportStatus, ReportGenerationPollError } from "../poll-report-status";

describe("pollReportStatus", () => {
  it("returns immediately when first poll is COMPLETE", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "COMPLETE", shareToken: "tok-1" }),
    });

    const result = await pollReportStatus("report-1", { fetchFn, intervalMs: 1, maxAttempts: 3 });
    expect(result.shareToken).toBe("tok-1");
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it("polls until COMPLETE", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: "GENERATING" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: "COMPLETE", shareToken: null }),
      });

    const result = await pollReportStatus("report-2", { fetchFn, intervalMs: 1, maxAttempts: 5 });
    expect(result.shareToken).toBeNull();
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("throws on FAILED status", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "FAILED", errorMessage: "AI timeout" }),
    });

    await expect(pollReportStatus("report-3", { fetchFn, intervalMs: 1, maxAttempts: 2 })).rejects.toThrow(
      ReportGenerationPollError,
    );
  });
});

describe("status polling recovery", () => {
 const complete = {ok:true,status:200,json:async()=>({status:"COMPLETE",shareToken:"ready"})};
 it("recovers from a dropped connection and temporary server failure without starting another report", async () => {
  const fetchFn=vi.fn().mockRejectedValueOnce(new TypeError("offline")).mockResolvedValueOnce({ok:false,status:503,json:async()=>null}).mockResolvedValue(complete);
  await expect(pollReportStatus("existing",{fetchFn,intervalMs:1,maxAttempts:5})).resolves.toEqual({shareToken:"ready"});
  expect(fetchFn).toHaveBeenCalledTimes(3);
  for(const [url,options] of fetchFn.mock.calls){expect(url).toBe("/api/reports/existing/status");expect(options).toEqual({cache:"no-store"});}
 });
 it.each([401,403,404])("does not retry permanent HTTP %s",async status=>{
  const fetchFn=vi.fn().mockResolvedValue({ok:false,status,json:async()=>null});
  await expect(pollReportStatus("existing",{fetchFn,intervalMs:1,maxAttempts:5})).rejects.toMatchObject({reason:"unavailable"});
  expect(fetchFn).toHaveBeenCalledOnce();
 });
 it("bounds repeated transient failures",async()=>{
  const fetchFn=vi.fn().mockRejectedValue(new TypeError("offline"));
  await expect(pollReportStatus("existing",{fetchFn,intervalMs:1,maxAttempts:10})).rejects.toMatchObject({reason:"unavailable"});
  expect(fetchFn).toHaveBeenCalledTimes(3);
 });
 it("distinguishes a failed job from a still-running timeout",async()=>{
  const failed=vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>({status:"FAILED",errorMessage:"Render failed"})});
  await expect(pollReportStatus("existing",{fetchFn:failed,intervalMs:1,maxAttempts:1})).rejects.toMatchObject({reason:"failed",message:"Render failed"});
  const pending=vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>({status:"GENERATING"})});
  await expect(pollReportStatus("existing",{fetchFn:pending,intervalMs:1,maxAttempts:1})).rejects.toMatchObject({reason:"timeout"});
 });
});
