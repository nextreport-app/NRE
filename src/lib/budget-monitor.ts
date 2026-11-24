import { budgetAlertKey } from "./budget-alert-key";
import { prisma } from "./prisma";
import { ServiceError } from "./service-error";
import { budgetWindow, budgetFacts, effectiveBudgetTolerance, readBudgetSnapshot, BUDGET_LEVEL_LABELS, type BudgetSnapshot } from "./budget-monitor-facts";
import { fetchMetaAccountSpend, fetchMetaAdAccountMetadata, ensureFreshMetaAccessToken } from "./meta-api";
import { decryptMetaToken, encryptMetaToken } from "./meta-token-storage";
import { queueEmail, deliverQueuedEmail } from "./email-delivery";
import { getSubscriptionStatus } from "./subscription";

/** Database lease prevents concurrent scans; account settings are rechecked before committing facts. */
export async function checkClientBudget(id: string, userId: string, now = new Date()) {
  const client=await prisma.client.findUnique({where:{id}, include:{user:true}});
  if (!client || client.userId !== userId) throw new ServiceError("Not found",404);
  if (getSubscriptionStatus(client.user).isBlocked) {
    await prisma.client.updateMany({where:{id,userId},data:{budgetMonitorLastAttemptAt:now}});
    throw new ServiceError("An active trial or subscription is required.",403);
  }
  if (!client.budgetMonitorEnabled) throw new ServiceError("Enable budget monitoring first.");
  if (!client.monthlyBudget || client.monthlyBudget <= 0 || !client.metaAdAccountId) throw new ServiceError("Save an approved budget and link a Meta ad account first.");
  const claimed=await prisma.client.updateMany({where:{id, budgetMonitorEnabled:true,
    OR:[{budgetMonitorLeaseUntil:null},{budgetMonitorLeaseUntil:{lte:now}}],
    AND:[{OR:[{budgetMonitorLastAttemptAt:null},{budgetMonitorLastAttemptAt:{lte:new Date(now.getTime()-5*60000)}}]}]},
    data:{budgetMonitorLeaseUntil:new Date(now.getTime()+4*60000),budgetMonitorLastAttemptAt:now}});
  if (!claimed.count) throw new ServiceError("A check is running or was attempted recently. Retry in five minutes.",429,300);
  const config={monthlyBudget:client.monthlyBudget,currency:client.currency,timezone:client.timezone,metaAdAccountId:client.metaAdAccountId,budgetMonitorTolerance:client.budgetMonitorTolerance};
  const window=budgetWindow(client.timezone,now);
  const where={id,budgetMonitorLastAttemptAt:now,budgetMonitorEnabled:true,...config};
  let snapshot: BudgetSnapshot;
  try {
    if (!client.user.metaAccessToken) throw new ServiceError("Reconnect Meta Ads in Account settings.");
    const fresh=await ensureFreshMetaAccessToken({accessToken:decryptMetaToken(client.user.metaAccessToken),tokenExpiresAt:client.user.metaTokenExpiresAt});
    if (fresh.refreshed) await prisma.user.update({where:{id:userId},data:{metaAccessToken:encryptMetaToken(fresh.accessToken),metaTokenExpiresAt:fresh.tokenExpiresAt}});
    const account=await fetchMetaAdAccountMetadata(fresh.accessToken,client.metaAdAccountId);
    if (account.currency !== client.currency || account.timezone_name !== client.timezone) throw new ServiceError("Client currency/timezone must match the linked Meta account. Update Client settings before monitoring.");
    const [spent,completedSpend]=await Promise.all([
      fetchMetaAccountSpend(fresh.accessToken,client.metaAdAccountId,window.start,window.today),
      window.completedDays>=3 && window.completedEnd ? fetchMetaAccountSpend(fresh.accessToken,client.metaAdAccountId,window.start,window.completedEnd) : Promise.resolve(null),
    ]);
    // A check crossing midnight/month rollover must not be presented as today's complete scope.
    if (budgetWindow(client.timezone).today !== window.today) throw new ServiceError("The account calendar changed during this check. Retry for the new day.");
    snapshot={version:2,config,month:window.month,checkedAt:new Date().toISOString(),facts:budgetFacts(client.monthlyBudget,spent,completedSpend,window,effectiveBudgetTolerance(config))};
    const saved=await prisma.client.updateMany({where,data:{budgetMonitorSnapshot:JSON.stringify(snapshot)}});
    if (!saved.count) throw new ServiceError("Budget settings changed during the check. Refresh and check again.",409);
  } catch (error) {
    const previous=readBudgetSnapshot(client.budgetMonitorSnapshot,config,now);
    snapshot={version:2,config,month:window.month,checkedAt:previous?.checkedAt ?? now.toISOString(),facts:previous?.facts,
      error:error instanceof ServiceError ? error.message : "Meta budget sync failed. Reconnect Meta or retry; prior spend is not a fresh check."};
    await prisma.client.updateMany({where,data:{budgetMonitorSnapshot:JSON.stringify(snapshot),budgetMonitorLeaseUntil:null}});
    return snapshot;
  }
  try {
    if (client.budgetMonitorEmailEnabled && snapshot.facts?.alertable) {
      const current=await prisma.client.findFirst({where:{...where,budgetMonitorEmailEnabled:true}});
      if (current) {
        const key=budgetAlertKey(id,window.month,config,snapshot.facts!.level);
        const money=(n:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:client.currency}).format(n);
        const title=BUDGET_LEVEL_LABELS[snapshot.facts!.level];
        const text=`${client.accountName}: ${title}.\nApproved monthly ad spend (excluding tax): ${money(client.monthlyBudget)}.\nSpend this month through ${window.today}: ${money(snapshot.facts!.spent)}.\n${snapshot.facts!.projected===null?"Projection unavailable until three full days have elapsed.":`Projected month-end spend: ${money(snapshot.facts!.projected)} (estimate from completed days).`}\nAllowed variance: ${money(snapshot.facts!.tolerance)}.\n${snapshot.facts!.level === "underspend" ? `Projected month-end shortfall: ${money(snapshot.facts!.projectedShortfall!)}. Review delivery and budget pacing.` : ""}\nLast checked: ${snapshot.checkedAt}.\nReview: https://nextreport.in/overview?client=${encodeURIComponent(id)}#meta-budget-${encodeURIComponent(id)}\nRead-only monitoring cannot adjust spend; Meta data can be delayed. Adjust campaigns in Ads Manager.`;
        await queueEmail({key,kind:"BUDGET_ALERT",userId,payload:{to:[client.user.email],subject:`NextReport budget alert — ${client.accountName}`,text,html:`<pre style="white-space:pre-wrap;font:14px Arial,sans-serif">${text.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")}</pre>`}});
        const delivery=await deliverQueuedEmail(key);
        if (!delivery.accepted) snapshot.emailError="Email has not been confirmed sent. Check again later; the in-app alert remains available.";
      }
    }
  } catch {snapshot.emailError="Email could not be confirmed sent. The in-app alert remains available.";}
  await prisma.client.updateMany({where,data:{budgetMonitorSnapshot:JSON.stringify(snapshot),budgetMonitorLeaseUntil:null}});
  return snapshot;
}
