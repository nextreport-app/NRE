import { scheduledDeliveryIsCurrent } from "./report-schedules/delivery-guard";
import { budgetAlertKey } from "./budget-alert-key";
import { readBudgetSnapshot } from "./budget-monitor-facts";
import { prisma } from "./prisma";
import { FROM_ADDRESS, getResendClient } from "./email";
import { getSubscriptionStatus } from "./subscription";
import { isPerformanceFresh, readPerformanceSnapshot } from "./performance-monitor/facts";
export interface QueuedEmail { to: string[]; subject: string; text: string; html: string }
export interface EmailDeliveryResult { accepted: boolean; alreadyAccepted?: boolean; busy?: boolean; cancelled?: boolean; error?: string }
const LEASE_MS = 5 * 60_000;
const PROVIDER_IDEMPOTENCY_WINDOW_MS = 23 * 60 * 60_000;

export async function queueEmail(input: { key: string; kind: string; userId?: string; payload: QueuedEmail }) {
  // Never mutate a queued payload: provider retries with the same key require identical content.
  await prisma.emailDelivery.upsert({ where: { key: input.key }, create: { key: input.key, kind: input.kind, userId: input.userId, payloadJson: JSON.stringify(input.payload) }, update: {} });
  return input.key;
}

export async function deliverQueuedEmail(key: string, now = new Date()): Promise<EmailDeliveryResult> {
  const row = await prisma.emailDelivery.findUnique({ where: { key } });
  if (!row) return { accepted: false, error: "Email intent was not found." };
  if (row.status === "ACCEPTED") return { accepted: true, alreadyAccepted: true };
  if (row.status === "CANCELLED") return { accepted: false, cancelled: true };
  if (row.status === "PENDING" && row.leaseUntil && row.leaseUntil > now) return { accepted: false, busy: true };
  if (row.status === "REVIEW") return { accepted: false, error: "Email delivery needs provider-log review." };
  if (row.status === "SENDING" && row.leaseUntil && row.leaseUntil > now) return { accepted: false, busy: true };
  // Queue creation is a conservative bound on the first request; retries must not reset the dedupe window.
  if (row.status === "SENDING" && row.lastAttemptAt && now.getTime() - row.createdAt.getTime() >= PROVIDER_IDEMPOTENCY_WINDOW_MS) {
    await prisma.emailDelivery.updateMany({ where: { key, status: "SENDING", leaseUntil: { lte: now } }, data: { status: "REVIEW", lastError: "Ambiguous send is older than the safe provider deduplication window; inspect Resend before retrying." } });
    return { accepted: false, error: "Email delivery needs provider-log review." };
  }
  if (row.userId && ["WELCOME", "TRIAL_ENDING", "TRIAL_EXPIRED"].includes(row.kind)) {
    const user = await prisma.user.findUnique({ where: { id: row.userId } });
    const expired = user ? user.trialEndsAt <= now : false;
    const obsolete = !user || user.planId !== "trial" || getSubscriptionStatus(user).isAdminOverride
      || (row.kind === "TRIAL_ENDING" && expired) || (row.kind === "TRIAL_EXPIRED" && (!expired || (user && now.getTime() - user.trialEndsAt.getTime() > 2 * 86400000))) || (row.kind === "WELCOME" && expired);
    if (obsolete) { await prisma.emailDelivery.update({ where: { key }, data: { status: "CANCELLED" } }); return { accepted: false, cancelled: true }; }
  }
  if (["SCHEDULE_NOTICE","SCHEDULE_CLIENT"].includes(row.kind)) {
    const id=row.key.split(":")[1];
    const run=id?await prisma.scheduledReportRun.findUnique({where:{id},include:{report:true,schedule:{include:{client:{include:{user:true}}}}}}):null;
    const payload=JSON.parse(row.payloadJson) as QueuedEmail;
    const valid=scheduledDeliveryIsCurrent(row.kind,row.key,row.userId,payload.to,run);
    if(!valid){await prisma.emailDelivery.update({where:{key},data:{status:"CANCELLED"}});return {accepted:false,cancelled:true};}
  }
  if (row.kind === "BUDGET_ALERT") {
    const id=row.key.split(":")[1];
    const client=id ? await prisma.client.findUnique({where:{id},include:{user:true}}) : null;
    const snapshot=client ? readBudgetSnapshot(client.budgetMonitorSnapshot,client,now) : null;
    const payload=JSON.parse(row.payloadJson) as QueuedEmail;
    const valid=client && !getSubscriptionStatus(client.user).isBlocked && payload.to.length===1 && payload.to[0]===client.user.email && client.userId===row.userId && client.budgetMonitorEnabled && client.budgetMonitorEmailEnabled &&
      snapshot?.facts?.alertable && !snapshot.error && now.getTime()-Date.parse(snapshot.checkedAt)<26*3600000 &&
      row.key===budgetAlertKey(client.id,snapshot.month,client,snapshot.facts.level);
    if (!valid) {await prisma.emailDelivery.update({where:{key},data:{status:"CANCELLED"}});return {accepted:false,cancelled:true};}
  }
  if (row.kind === "PERFORMANCE_ALERT") {
    const id=row.key.split(":")[1];
    const client=id?await prisma.client.findUnique({where:{id},include:{user:true}}):null;
    const snapshot=client?readPerformanceSnapshot(client.performanceMonitorSnapshot,client,now):null;
    const payload=JSON.parse(row.payloadJson) as QueuedEmail;
    const warnings=snapshot?.facts?.campaigns.some(c=>c.signals.some(s=>s.tone==="warning"));
    const valid=client && !getSubscriptionStatus(client.user).isBlocked && !!client.user.emailVerified && client.userId===row.userId && client.performanceMonitorEnabled && client.performanceMonitorEmailEnabled && isPerformanceFresh(snapshot,now) && warnings && payload.to.length===1 && payload.to[0]===client.user.email && row.key===`performance-alert:${client.id}:${snapshot!.facts!.periodA.endIso}` && payload.text.includes(`Last checked: ${snapshot!.checkedAt}.`);
    if(!valid){await prisma.emailDelivery.update({where:{key},data:{status:"CANCELLED"}});return {accepted:false,cancelled:true};}
  }
  if (!process.env.RESEND_API_KEY?.trim()) return { accepted: false, error: "Email sending is not configured." };
  // lastAttemptAt is also the claim identity; a stale sender cannot overwrite a newer claim.
  const claimTime = new Date(now.getTime());
  const leaseUntil = new Date(now.getTime() + LEASE_MS);
  const claimed = await prisma.emailDelivery.updateMany({ where: { key, OR: [{ status: "PENDING", OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }] }, { status: "SENDING", leaseUntil: { lte: now } }] }, data: { status: "SENDING", attempts: { increment: 1 }, lastAttemptAt: claimTime, leaseUntil } });
  if (!claimed.count) return { accepted: false, busy: true };
  try {
    const payload = JSON.parse(row.payloadJson) as QueuedEmail;
    const { data, error } = await getResendClient().emails.send({ from: FROM_ADDRESS, replyTo: FROM_ADDRESS, ...payload }, { idempotencyKey: key });
    if (error) {
      await prisma.emailDelivery.updateMany({ where: { key, status: "SENDING", lastAttemptAt: claimTime }, data: { status: "PENDING", leaseUntil, lastError: error.message.slice(0, 500) } });
      return { accepted: false, error: error.message };
    }
    if (!data?.id) throw new Error("Provider did not acknowledge this email.");
    await prisma.$transaction(async tx => {
      const accepted = await tx.emailDelivery.updateMany({ where: { key, status: "SENDING", lastAttemptAt: claimTime }, data: { status: "ACCEPTED", acceptedAt: new Date(), providerId: data.id, leaseUntil: null, lastError: null } });
      if (accepted.count && row.userId && ["TRIAL_ENDING", "TRIAL_EXPIRED"].includes(row.kind)) await tx.user.updateMany({ where: { id: row.userId }, data: row.kind === "TRIAL_ENDING" ? { trialEndingEmailSentAt: new Date() } : { trialExpiredEmailSentAt: new Date() } });
    });
    return { accepted: true };
  } catch (err) {
    // Keep the lease/ambiguous state; retry with the same provider key, not a new message.
    const message = err instanceof Error ? err.message : "Email request failed.";
    await prisma.emailDelivery.updateMany({ where: { key, status: "SENDING", lastAttemptAt: claimTime }, data: { lastError: message.slice(0, 500) } }).catch(() => {});
    return { accepted: false, error: message };
  }
}

export async function retryPendingEmails(limit = 30) {
  const rows = await prisma.emailDelivery.findMany({ where: { OR: [{ status: "PENDING", OR: [{ leaseUntil: null }, { leaseUntil: { lte: new Date() } }] }, { status: "SENDING", leaseUntil: { lte: new Date() } }] }, orderBy: { createdAt: "asc" }, take: limit });
  let accepted = 0, failed = 0;
  for (const row of rows) { const result = await deliverQueuedEmail(row.key); if (result.accepted) accepted++; else if (!result.cancelled && !result.busy) failed++; if (!result.cancelled && !result.busy) await new Promise(resolve => setTimeout(resolve, 550)); }
  return { checked: rows.length, accepted, failed };
}
