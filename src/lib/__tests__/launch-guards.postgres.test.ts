/** Explicit opt-in disposable LOCAL database only; never uses a configured production database. */
import { randomUUID, createHmac } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const provider = vi.hoisted(() => ({ plans: { fetch: vi.fn() }, customers: { create: vi.fn() }, payments: { fetch: vi.fn() }, orders: { fetch: vi.fn() }, invoices: { fetch: vi.fn() }, subscriptions: { fetch: vi.fn(), create: vi.fn(), cancel: vi.fn() } }));
vi.mock("@/lib/razorpay", async original => ({ ...await original<typeof import("../razorpay")>(), razorpayClient: () => provider }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/billing-user-emails", () => ({ sendSubscriptionConfirmedEmail: vi.fn() }));
vi.mock("@/lib/inbound-notifications", () => ({ notifyBillingNewSubscription: vi.fn() }));
import { prisma } from "../prisma";
import { createClientWithinCapacity } from "../atomic-client-create";
import { createReportWithinCapacity, claimReportGeneration, failReportGeneration } from "../report-capacity";
import { takeRateLimit } from "../usage-rate-limit";
import { applyCapturedPayment } from "../billing-entitlements";
import { auth } from "../auth";
import { POST as verifyPayment } from "@/app/api/payments/verify/route";
import { createRazorpaySubscription } from "../razorpay-subscriptions";
import { POST as billingWebhook } from "@/app/api/payments/webhook/route";
import { resetPasswordWithToken } from "../password-reset";
import { verifyEmailToken } from "../email-verification";
import { createHash } from "node:crypto";
import { mockRouteAuth, mockSession } from "@/test/api-route-harness";
const enabled = !!process.env.LAUNCH_TEST_DATABASE_URL;
const ids: string[] = [];
async function account(planId = "trial", clients = 1, trialReportsUsed = 0) {
  const id = `launch_test_${randomUUID()}`; ids.push(id);
  const user = await prisma.user.create({ data: { id, email: `${id}@example.test`, emailVerified: new Date(), planId, trialReportsUsed, paidThrough: planId === "trial" ? null : new Date(Date.now()+86400000) } });
  const rows = await Promise.all(Array.from({ length: clients }, (_, i) => prisma.client.create({ data: { userId: id, accountName: `Anonymous ${i}` } })));
  return { user, clients: rows };
}
describe.skipIf(!enabled)("launch guards with real PostgreSQL", () => {
  beforeAll(() => {
    const url = new URL(process.env.LAUNCH_TEST_DATABASE_URL!);
    if (!["localhost", "127.0.0.1"].includes(url.hostname) || process.env.DATABASE_URL !== process.env.LAUNCH_TEST_DATABASE_URL) throw new Error("Disposable local database URL must be explicitly selected.");
  });
  afterEach(() => { vi.unstubAllEnvs(); });
  afterAll(async () => {
    await prisma.billingPayment.deleteMany({ where: { userId: { in: ids } } });
    await prisma.billingCheckout.deleteMany({ where: { userId: { in: ids } } });
    await prisma.verificationToken.deleteMany({ where: { identifier: { in: ids.map(id => `verify-email:${id}`) } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  });
  it("allows exactly one simultaneous create/duplicate into the tenth Agency slot", async () => {
    const { user } = await account("starter", 9);
    const attempts = await Promise.allSettled(Array.from({length: 8}, () => createClientWithinCapacity(user.id, {accountName: "New"})));
    expect(attempts.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.client.count({ where: { userId: user.id } })).toBe(10);
    const client = await prisma.client.findFirstOrThrow({ where: { userId: user.id } });
    await prisma.client.delete({ where: { id: client.id } });
    await expect(createClientWithinCapacity(user.id, {accountName:"Replacement"})).resolves.toBeTruthy();
  }, 20000);
  it("enforces 3 trial clients, 50 Professional clients, and verified email", async () => {
    for (const [plan, limit] of [["trial",3],["professional",50]] as const) {
      const {user} = await account(plan,limit);
      await expect(createClientWithinCapacity(user.id,{accountName:"Too many"})).rejects.toThrow(/active clients/);
    }
    const {user} = await account(); await prisma.user.update({where:{id:user.id},data:{emailVerified:null}});
    await expect(createClientWithinCapacity(user.id,{accountName:"Blocked"})).rejects.toThrow(/Verify/);
  });
  it("atomically reserves a trial credit and prevents simultaneous reports for an account", async () => {
    const {user,clients} = await account("trial",1,9);
    const args = {data:{clientId:clients[0].id,status:"GENERATING" as const}};
    const results = await Promise.allSettled(Array.from({length: 5}, () => createReportWithinCapacity(user.id,args)));
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    const report = await prisma.report.findFirstOrThrow({where:{clientId:clients[0].id}});
    await prisma.report.update({where:{id:report.id},data:{status:"COMPLETE"}});
    await expect(createReportWithinCapacity(user.id,args)).rejects.toThrow(/10 trial reports/);
    await prisma.client.delete({where:{id:clients[0].id}});
    expect((await prisma.user.findUniqueOrThrow({where:{id:user.id}})).trialReportsUsed).toBe(10);
  });
  it("refunds a failed generation once and claims a worker only once", async () => {
    const {user,clients} = await account();
    const report=await createReportWithinCapacity(user.id,{data:{clientId:clients[0].id,status:"GENERATING"}});
    expect((await Promise.all(Array.from({length:5},()=>claimReportGeneration(report.id)))).filter(Boolean)).toHaveLength(1);
    await Promise.all(Array.from({length:5},()=>failReportGeneration(report.id,"Synthetic failure")));
    expect((await prisma.user.findUniqueOrThrow({where:{id:user.id}})).trialReportsUsed).toBe(0);
  });
  it("caps concurrent jobs across users at three", async () => {
    const accounts=await Promise.all(Array.from({length:5},()=>account("professional")));
    const results=await Promise.allSettled(accounts.map(({user,clients})=>createReportWithinCapacity(user.id,{data:{clientId:clients[0].id,status:"GENERATING"}})));
    expect(results.filter(r=>r.status==="fulfilled")).toHaveLength(3);
    for(const result of results)if(result.status==="fulfilled")await failReportGeneration(result.value.id,"Cleanup");
  });
  it("enforces one shared rate bucket under simultaneous requests", async () => {
    const result=await Promise.all(Array.from({length:12},()=>takeRateLimit("local-test",randomSubject,3,60)));
    expect(result.filter(Boolean)).toHaveLength(3);
  });
  it("consumes an email-verification token only once under a race", async () => {
    const {user}=await account();await prisma.user.update({where:{id:user.id},data:{emailVerified:null}});
    const token=randomUUID(); await prisma.verificationToken.create({data:{identifier:`verify-email:${user.id}`,token:createHash("sha256").update(token).digest("hex"),expires:new Date(Date.now()+10000)}});
    expect((await Promise.all([verifyEmailToken(token),verifyEmailToken(token)])).filter(Boolean)).toHaveLength(1);
  });
  it("does not cancel a paid subscription when starting another checkout", async () => {
    const {user} = await account("starter");
    await prisma.user.update({where:{id:user.id},data:{razorpaySubscriptionId:"sub_existing"}});
    vi.stubEnv("RAZORPAY_PLAN_PROFESSIONAL_INR_MONTHLY","plan_pro");
    provider.plans.fetch.mockResolvedValue({item:{amount:129900,currency:"INR"},interval:1,period:"monthly"});
    provider.subscriptions.cancel.mockClear();
    await expect(createRazorpaySubscription({userId:user.id,email:user.email,planId:"professional",currency:"INR",interval:"monthly"})).rejects.toThrow(/paid access/);
    expect(provider.subscriptions.cancel).not.toHaveBeenCalled();
    expect((await prisma.user.findUniqueOrThrow({where:{id:user.id}})).razorpaySubscriptionId).toBe("sub_existing");
  });
  it("ignores an old subscription cancellation and retries transient webhook failures", async () => {
    const {user}=await account("starter");await prisma.user.update({where:{id:user.id},data:{razorpaySubscriptionId:"sub_new"}});
    vi.stubEnv("RAZORPAY_WEBHOOK_SECRET","local-webhook-secret");provider.subscriptions.fetch.mockResolvedValue({status:"cancelled"});
    const call=async (body:unknown)=>{const text=JSON.stringify(body);return billingWebhook(new Request("http://localhost/api/payments/webhook",{method:"POST",body:text,headers:{"x-razorpay-signature":createHmac("sha256","local-webhook-secret").update(text).digest("hex")}}))};
    expect((await call({event:"subscription.cancelled",payload:{subscription:{entity:{id:"sub_old"}}}})).status).toBe(200);
    expect((await prisma.user.findUniqueOrThrow({where:{id:user.id}})).razorpaySubscriptionId).toBe("sub_new");
    provider.payments.fetch.mockRejectedValueOnce(new Error("Synthetic provider outage"));
    expect((await call({event:"payment.captured",payload:{payment:{entity:{id:"p"}}}})).status).toBe(500);
    expect((await call({event:"subscription.authenticated",payload:{subscription:{entity:{id:"sub_new"}}}})).status).toBe(200);
  });
  it("consumes password resets once and increments the session revocation version", async () => {
    const {user}=await account();const token=randomUUID();
    await prisma.passwordResetToken.create({data:{tokenHash:createHash("sha256").update(token).digest("hex"),userId:user.id,expiresAt:new Date(Date.now()+60000)}});
    const results=await Promise.all([resetPasswordWithToken(token,"SafePasswordOne"),resetPasswordWithToken(token,"SafePasswordTwo")]);
    expect(results.filter(result=>result.ok)).toHaveLength(1);
    expect((await prisma.user.findUniqueOrThrow({where:{id:user.id}})).authVersion).toBe(1);
  }, 20000);
  it("binds a real signed checkout to owner and server-side tier, and applies it once", async () => {
    const {user}=await account();const {user:other}=await account();const order=`order_${randomUUID()}`,payment=`pay_${randomUUID()}`;
    await prisma.billingCheckout.create({data:{id:order,userId:user.id,kind:"order",planId:"starter",amount:79900,currency:"INR",interval:"monthly"}});
    provider.payments.fetch.mockResolvedValue({id:payment,status:"captured",order_id:order,amount:79900,currency:"INR",created_at:Math.floor(Date.now()/1000)});
    provider.orders.fetch.mockResolvedValue({id:order,amount:79900,currency:"INR",notes:{userId:user.id,planId:"starter"}});
    await expect(applyCapturedPayment(payment,order,other.id)).rejects.toThrow(/belong/);
    vi.stubEnv("RAZORPAY_KEY_SECRET","local-test-only");mockRouteAuth(auth).mockResolvedValue(mockSession(user.id));
    const signature=createHmac("sha256","local-test-only").update(`${order}|${payment}`).digest("hex");
    const res=await verifyPayment(new Request("http://localhost/api/payments/verify",{method:"POST",body:JSON.stringify({planId:"professional",razorpay_order_id:order,razorpay_payment_id:payment,razorpay_signature:signature})}));
    expect(res.status).toBe(200);
    const updated=await prisma.user.findUniqueOrThrow({where:{id:user.id}});expect(updated.planId).toBe("starter");expect(updated.paidThrough!.getTime()).toBeGreaterThan(Date.now());
    expect((await applyCapturedPayment(payment,order,user.id)).newlyApplied).toBe(false);
    expect(await prisma.billingPayment.count({where:{id:payment}})).toBe(1);
    vi.unstubAllEnvs();
  });
  it("rejects authorized-only, wrong-amount and cross-subscription payments", async () => {
    const {user}=await account();const order=`order_${randomUUID()}`;
    await prisma.billingCheckout.create({data:{id:order,userId:user.id,kind:"order",planId:"starter",amount:79900,currency:"INR",interval:"monthly"}});
    provider.payments.fetch.mockResolvedValue({status:"authorized",amount:79900,currency:"INR"});await expect(applyCapturedPayment("p",order,user.id)).rejects.toThrow(/not captured/);
    provider.payments.fetch.mockResolvedValue({status:"captured",amount:1,currency:"INR"});await expect(applyCapturedPayment("p",order,user.id)).rejects.toThrow(/expected amount/);
    const sub=`sub_${randomUUID()}`;await prisma.billingCheckout.create({data:{id:sub,userId:user.id,kind:"subscription",planId:"starter",amount:79900,currency:"INR",interval:"monthly"}});
    vi.stubEnv("RAZORPAY_PLAN_STARTER_INR_MONTHLY","plan_local");provider.subscriptions.fetch.mockResolvedValue({plan_id:"plan_local",status:"active",current_end:Math.floor(Date.now()/1000)+86400});provider.invoices.fetch.mockResolvedValue({subscription_id:"different_sub"});provider.payments.fetch.mockResolvedValue({status:"captured",amount:79900,currency:"INR",invoice_id:"i"});await expect(applyCapturedPayment("p",sub,user.id)).rejects.toThrow(/different subscription/);vi.unstubAllEnvs();
  });
});
const randomSubject=randomUUID();
