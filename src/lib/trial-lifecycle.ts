import { prisma } from "./prisma";
import { getSubscriptionStatus } from "./subscription";
import { retryPendingEmails } from "./email-delivery";
import { sendTrialEndingReminderEmail, sendTrialExpiredEmail } from "./billing-user-emails";
/** Daily final-24-hour reminder and recent expiry notice; no bulk mail to historical expired trials. */
export async function processTrialLifecycle(now = new Date(), batchSize = 100) {
  const retried = await retryPendingEmails(30);
  let reminders = 0, expired = 0, checked = 0, failures = retried.failed, pages = 0;
  let cursor: string | undefined, remaining = false;
  while (checked < batchSize && pages++ < 10) {
    const due = await prisma.user.findMany({ where: { planId: "trial", emailVerified: { not: null }, OR: [
      { trialEndingEmailSentAt: null, trialEndsAt: { gt: now, lte: new Date(now.getTime()+86400000) } },
      { trialExpiredEmailSentAt: null, trialEndsAt: { gte: new Date(now.getTime()-2*86400000), lte: now } },
    ] }, orderBy: { id: "asc" }, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), take: 100,
      select: { id: true, email: true, name: true, trialEndsAt: true, emailVerified: true, paidThrough: true, planId: true } });
    if (!due.length) { remaining = false; break; }
    const keyFor = (user: typeof due[number]) => `trial-${user.trialEndsAt <= now ? "expired" : "ending"}:${user.id}:${user.trialEndsAt.toISOString()}`;
    const settled = await prisma.emailDelivery.findMany({ where: { key: { in: due.map(keyFor) }, status: { in: ["ACCEPTED", "CANCELLED", "REVIEW"] } }, select: { key: true } });
    const done = new Set(settled.map(row=>row.key));
    for (const user of due) {
      cursor = user.id;
      if (getSubscriptionStatus(user).isAdminOverride || done.has(keyFor(user))) continue;
      checked++;
      try {
        const input = { userId: user.id, to: user.email, name: user.name, trialEndsAt: user.trialEndsAt };
        const isExpired = user.trialEndsAt <= now;
        const result = isExpired ? await sendTrialExpiredEmail(input) : await sendTrialEndingReminderEmail(input);
        if (result.accepted) { if (isExpired) expired++; else reminders++; }
        else if (!result.cancelled) failures++;
        if (!result.cancelled && !result.busy) await new Promise(resolve => setTimeout(resolve, 550));
      } catch (err) { console.error("[trial-lifecycle] email attempt failed",err); failures++; }
      if (checked >= batchSize) { remaining = true; break; }
    }
    if (checked >= batchSize || due.length < 100) break;
    remaining = true;
  }
  const reviewNeeded = await prisma.emailDelivery.count({ where: { status: "REVIEW" } });
  return { checked, reminders, expired, failures, remaining, reviewNeeded, retried };
}
