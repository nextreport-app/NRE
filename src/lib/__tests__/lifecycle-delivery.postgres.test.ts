import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
const send = vi.hoisted(() => vi.fn());
vi.mock("@/lib/email", () => ({ FROM_ADDRESS: "test@example.test", getResendClient: () => ({ emails: { send } }) }));
import { prisma } from "../prisma";
import { queueEmail, deliverQueuedEmail } from "../email-delivery";
import { processTrialLifecycle } from "../trial-lifecycle";
import { completeReportGeneration } from "../report-generation-events";
import { buildDailyReportDigestStats, istDayBoundsForDigest, sendAdminDailyReportDigest } from "../admin-report-digest";
const ids: string[] = [], keys: string[] = [];
const optedIn = !!process.env.LAUNCH_TEST_DATABASE_URL;
async function user(hoursLeft = 12) {
  const id = `lifecycle_test_${randomUUID()}`; ids.push(id);
  return prisma.user.create({ data: { id, email: `${id}@example.test`, emailVerified: new Date(), trialEndsAt: new Date(Date.now()+hoursLeft*3600000) } });
}
async function email(userId?: string, kind = "TEST") {
  const key = `test:${randomUUID()}`; keys.push(key);
  await queueEmail({ key, kind, userId, payload: { to: ["nobody@example.test"], subject: "Test", text: "Original", html: "<p>Original</p>" } });
  return key;
}
describe.skipIf(!optedIn)("lifecycle delivery and digest with real PostgreSQL", () => {
  beforeAll(() => { const url = new URL(process.env.LAUNCH_TEST_DATABASE_URL!); if (!["127.0.0.1","localhost"].includes(url.hostname) || process.env.DATABASE_URL !== process.env.LAUNCH_TEST_DATABASE_URL) throw Error("Explicit local disposable database required"); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); send.mockReset(); });
  afterAll(async () => {
    await prisma.emailDelivery.deleteMany({ where: { OR: [{ key: { in: keys } }, { userId: { in: ids } }] } });
    await prisma.reportGenerationEvent.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  });
  it("claims and sends a queued email once across simultaneous cron calls", async () => {
    vi.stubEnv("RESEND_API_KEY","fake-local-key"); send.mockResolvedValue({ data: { id: "message_one" }, error: null });
    const key = await email();
    const results = await Promise.all(Array.from({length:5},()=>deliverQueuedEmail(key)));
    expect(send).toHaveBeenCalledTimes(1); expect(results.some(result=>result.accepted)).toBe(true);
    expect((await deliverQueuedEmail(key)).alreadyAccepted).toBe(true);
    expect(send.mock.calls[0][1]).toEqual({idempotencyKey:key});
  });
  it("does not mark reminder sent when configuration or provider delivery fails", async () => {
    const account = await user(); const key=await email(account.id,"TRIAL_ENDING");
    vi.stubEnv("RESEND_API_KEY",""); expect((await deliverQueuedEmail(key)).accepted).toBe(false); expect(send).not.toHaveBeenCalled();
    vi.stubEnv("RESEND_API_KEY","fake-local-key"); send.mockResolvedValueOnce({data:null,error:{message:"Synthetic rate limit"}});
    expect((await deliverQueuedEmail(key)).accepted).toBe(false);
    expect((await prisma.user.findUniqueOrThrow({where:{id:account.id}})).trialEndingEmailSentAt).toBeNull();
    const row=await prisma.emailDelivery.findUniqueOrThrow({where:{key}});expect(row.status).toBe("PENDING");
    await prisma.emailDelivery.update({where:{key},data:{leaseUntil:new Date(Date.now()-1000)}});
    send.mockResolvedValueOnce({data:{id:"retry_accepted"},error:null});expect((await deliverQueuedEmail(key)).accepted).toBe(true);
    expect((await prisma.user.findUniqueOrThrow({where:{id:account.id}})).trialEndingEmailSentAt).not.toBeNull();
  });
  it("freezes queued content across retries and holds ambiguous old sends for review", async () => {
    const key=await email();
    await queueEmail({key,kind:"TEST",payload:{to:["changed@example.test"],subject:"Changed",text:"Changed",html:"Changed"}});
    expect((await prisma.emailDelivery.findUniqueOrThrow({where:{key}})).payloadJson).toContain("Original");
    await prisma.emailDelivery.update({where:{key},data:{createdAt:new Date(Date.now()-25*3600000),status:"SENDING",lastAttemptAt:new Date(Date.now()-3600000),leaseUntil:new Date(Date.now()-1)}});
    expect((await deliverQueuedEmail(key)).accepted).toBe(false);
    expect((await prisma.emailDelivery.findUniqueOrThrow({where:{key}})).status).toBe("REVIEW");expect(send).not.toHaveBeenCalled();
  });
  it("cancels a queued trial reminder after an upgrade", async () => {
    const account=await user();const key=await email(account.id,"TRIAL_ENDING");
    await prisma.user.update({where:{id:account.id},data:{planId:"starter",paidThrough:new Date(Date.now()+86400000)}});
    expect((await deliverQueuedEmail(key)).cancelled).toBe(true);expect(send).not.toHaveBeenCalled();
  });
  it("reminds in the final day, not 24–48 hours ahead; sends expiry once without retroactive blasts", async () => {
    vi.stubEnv("RESEND_API_KEY","fake-local-key");send.mockResolvedValue({data:{id:"lifecycle_accepted"},error:null});
    vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(new Date("2040-01-01T12:00:00Z"));
    const due=await user(12), tooEarly=await user(36), expired=await user(-1), old=await user(-72);
    const result=await processTrialLifecycle();expect(result.reminders).toBeGreaterThanOrEqual(1);expect(result.expired).toBeGreaterThanOrEqual(1);
    expect((await prisma.user.findUniqueOrThrow({where:{id:due.id}})).trialEndingEmailSentAt).not.toBeNull();
    expect((await prisma.user.findUniqueOrThrow({where:{id:tooEarly.id}})).trialEndingEmailSentAt).toBeNull();
    expect((await prisma.user.findUniqueOrThrow({where:{id:expired.id}})).trialExpiredEmailSentAt).not.toBeNull();
    expect((await prisma.user.findUniqueOrThrow({where:{id:old.id}})).trialExpiredEmailSentAt).toBeNull();
    send.mockClear();await processTrialLifecycle();expect(send).not.toHaveBeenCalled();
  },20000);
  it("counts completion time, survives report deletion, and does not double-count a completion", async () => {
    vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(new Date("2030-02-01T18:31:00Z"));
    const account=await user();const client=await prisma.client.create({data:{userId:account.id,accountName:"Anonymous brand"}});
    const report=await prisma.report.create({data:{clientId:client.id,status:"GENERATING",createdAt:new Date("2030-02-01T18:29:00Z")}});
    await completeReportGeneration({where:{id:report.id},data:{status:"COMPLETE"}});await completeReportGeneration({where:{id:report.id},data:{status:"COMPLETE"}});
    const yesterday=await buildDailyReportDigestStats(istDayBoundsForDigest(new Date("2030-02-01T19:00:00Z")));
    const today=await buildDailyReportDigestStats(istDayBoundsForDigest(new Date("2030-02-02T19:00:00Z")));
    expect(yesterday.total).toBe(0);expect(today.total).toBe(1);expect(today.byPlan).toEqual({Trial:1});
    await prisma.client.delete({where:{id:client.id}});
    const after=await buildDailyReportDigestStats(istDayBoundsForDigest(new Date("2030-02-02T19:00:00Z")));
    expect(after.total).toBe(1);expect(after.byUser[0].clients).toEqual(["Deleted client"]);
  });
  it("does not send a second digest for the same IST day", async () => {
    vi.stubEnv("RESEND_API_KEY","fake-local-key");send.mockResolvedValue({data:{id:"digest_accepted"},error:null});
    const when=new Date("2031-01-02T19:00:00Z");
    const first=await sendAdminDailyReportDigest(when), second=await sendAdminDailyReportDigest(when);
    const bounds=istDayBoundsForDigest(when);keys.push(`admin-digest:${bounds.start.toISOString().slice(0,10)}:${bounds.end.toISOString().slice(0,10)}`);
    expect(first.sent).toBe(true);expect(second.alreadySent).toBe(true);expect(send).toHaveBeenCalledTimes(1);
  });
});
