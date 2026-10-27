import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import * as XLSX from "xlsx";
import { forEachConcurrent } from "../for-each-concurrent";
import { assertReportComplexity } from "../report-complexity";
import { safeAuthRedirect } from "../safe-auth-redirect";
import { billingPeriodEnd } from "../billing-entitlements";
import { getSubscriptionStatus } from "../subscription";
import { createPkce } from "../oauth-pkce";
import { assertWorkbookUploadBudget } from "../nre/workbook-upload-budget";
import { fileFromFormData } from "../http-file";
import { signupSchema } from "../validators/auth";
import { isRazorpaySubscriptionsConfigured, planIdForAmount } from "../razorpay";

describe("launch security contracts", () => {
  it("rejects executable and external callbacks while preserving local paths", () => {
    for (const path of ["javascript:alert(1)", "//evil.test", "/\\evil.test", "https://evil.test", "/\n/evil.test"]) expect(safeAuthRedirect(path)).toBe("/clients");
    expect(safeAuthRedirect("/pricing?billing=annual")).toBe("/pricing?billing=annual");
  });
  it("expires monthly/annual one-time purchases at clamped calendar boundaries", () => {
    expect(billingPeriodEnd(new Date("2028-01-31T12:00:00Z"), "monthly").toISOString()).toBe("2028-02-29T12:00:00.000Z");
    expect(billingPeriodEnd(new Date("2028-02-29T12:00:00Z"), "annual").toISOString()).toBe("2029-02-28T12:00:00.000Z");
  });
  it("blocks paid tiers with absent or elapsed payment periods", () => {
    const base = { email: "payer@example.test", planId: "professional", trialEndsAt: new Date(Date.now() + 86400000) };
    expect(getSubscriptionStatus(base).isBlocked).toBe(true);
    expect(getSubscriptionStatus({ ...base, paidThrough: new Date(Date.now() - 1000) }).isBlocked).toBe(true);
    expect(getSubscriptionStatus({ ...base, paidThrough: new Date(Date.now() + 86400000) }).clientLimit).toBe(50);
  });
  it("does not grant an admin override to an unverified address", () => {
    vi.stubEnv("ADMIN_EMAILS", "owner@example.test");
    try { expect(getSubscriptionStatus({email:"owner@example.test",planId:"trial",emailVerified:null,trialEndsAt:new Date(Date.now()+86400000)}).isAdminOverride).toBe(false); }
    finally { vi.unstubAllEnvs(); }
  });
  it("does not treat another currency as a USD-priced payment", () => expect(planIdForAmount(900, "EUR")).toBeNull());
  it("recognizes a configured currency even if Starter INR is not configured", () => {
    vi.stubEnv("RAZORPAY_PLAN_STARTER_INR_MONTHLY", ""); vi.stubEnv("RAZORPAY_PLAN_PROFESSIONAL_USD_MONTHLY", "plan_usd");
    try { expect(isRazorpaySubscriptionsConfigured()).toBe(true); } finally { vi.unstubAllEnvs(); }
  });
  it("uses unique S256 PKCE secrets", () => {
    const a = createPkce(), b = createPkce();
    expect(a.verifier.length).toBeGreaterThanOrEqual(43);
    expect(a.verifier).not.toBe(b.verifier);
    expect(a.challenge).toBe(createHash("sha256").update(a.verifier).digest("base64url"));
  });
  it("accepts a normal workbook and refuses an oversized declared ZIP expansion", () => {
    const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Spend"], [42]]), "Data");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
    expect(() => assertWorkbookUploadBudget(buffer)).not.toThrow();
    const bomb = Buffer.from(buffer); const directory = bomb.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]));
    bomb.writeUInt32LE(40 * 1024 * 1024, directory + 24);
    expect(() => assertWorkbookUploadBudget(bomb)).toThrow(/32 MB/);
  });
  it("rejects oversized uploads before copying their bytes", async () => {
    const form = new FormData(); form.set("csv", new File([new Uint8Array(4*1024*1024+1)], "huge.csv"));
    await expect(fileFromFormData(form, "csv")).rejects.toThrow(/4 MB/);
  });
  it("limits parallel AI work without dropping slides", async () => {
    let running = 0, peak = 0; const finished: number[] = [];
    await forEachConcurrent([1,2,3,4,5,6], 2, async item => {
      running++; peak = Math.max(peak, running);
      await new Promise(resolve => setTimeout(resolve, 2)); finished.push(item); running--;
    });
    expect(peak).toBe(2); expect(finished.sort()).toEqual([1,2,3,4,5,6]);
  });
  it("rejects excessive report detail without silently truncating it", () => {
    expect(() => assertReportComplexity({ campaignSlides: Array(30), adSetSlides: Array(21) })).toThrow(/50/);
    expect(() => assertReportComplexity({ campaignSlides: Array(25), adSetSlides: Array(25) })).not.toThrow();
  });
  it("does not silently accept bcrypt-truncated Unicode passwords", () => {
    expect(signupSchema.safeParse({ name: "A", email: "a@example.test", password: "界".repeat(30) }).success).toBe(false);
  });
});
