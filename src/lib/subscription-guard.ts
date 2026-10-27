/**
 * Server-side enforcement of the paywall/plan-limit rules from
 * lib/subscription.ts, for the two actions the product spec calls out as
 * gated: adding a client and generating a report. The frontend (paywall
 * screen, upgrade prompt) already prevents reaching these routes in the
 * normal UI flow, but that's a UX convenience, not the actual gate — a
 * request straight to the API must be re-checked here regardless of what
 * the client claims, matching this app's "never trust the frontend to
 * report payment success" rule extended to plan status generally.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CLIENT_LIMIT_EXPLAINER, getPlanDisplayName } from "@/lib/plan-labels";
import { getSubscriptionStatus } from "@/lib/subscription";

const TRIAL_ENDED_MESSAGE = "Your trial or paid access has ended. Visit Billing to continue using NextReport.";

/** Returns a 403 response if this user's trial has expired (or their subscription was cancelled) and they haven't subscribed — null means "allowed, proceed." */
export async function requireActiveSubscription(userId: string): Promise<NextResponse | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, planId: true, trialEndsAt: true, paidThrough: true, emailVerified: true, trialReportsUsed: true } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!user.emailVerified) return NextResponse.json({ error: "Verify your email from your workspace before continuing." }, { status: 403 });
  const status = getSubscriptionStatus(user);
  if (status.isTrialing && user.trialReportsUsed >= 10) return NextResponse.json({ error: "You have used your 10 trial reports. Visit Billing to continue." }, { status: 403 });
  if (status.isBlocked) {
    return NextResponse.json({ error: TRIAL_ENDED_MESSAGE }, { status: 403 });
  }
  return null;
}

/** Same trial/cancelled check as requireActiveSubscription, plus the Starter plan's 10-client cap. null means "allowed, proceed." */
export async function requireClientCapacity(userId: string): Promise<NextResponse | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, planId: true, trialEndsAt: true, paidThrough: true, emailVerified: true, trialReportsUsed: true },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!user.emailVerified) return NextResponse.json({ error: "Verify your email from your workspace before continuing." }, { status: 403 });
  const status = getSubscriptionStatus(user);
  if (status.isBlocked) {
    return NextResponse.json({ error: TRIAL_ENDED_MESSAGE }, { status: 403 });
  }

  if (status.clientLimit !== null) {
    // Concurrent cap — active rows in My Clients. Deleting a client frees a
    // slot so agencies can replace churned accounts without upgrading.
    const activeClientCount = await prisma.client.count({ where: { userId } });
    if (activeClientCount >= status.clientLimit) {
      return NextResponse.json(
        {
          error: `The ${getPlanDisplayName(status.planId)} plan is limited to ${status.clientLimit} client workspaces (one brand each — Meta, Google, TikTok, and GA4 included). ${CLIENT_LIMIT_EXPLAINER} Delete an unused client or visit Billing to review your plan.`,
        },
        { status: 403 },
      );
    }
  }
  return null;
}
