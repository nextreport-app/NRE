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
import { getSubscriptionStatus } from "@/lib/subscription";

const TRIAL_ENDED_MESSAGE = "Your free trial has ended. Subscribe to continue using NextReport.";

/** Returns a 403 response if this user's trial has expired (or their subscription was cancelled) and they haven't subscribed — null means "allowed, proceed." */
export async function requireActiveSubscription(userId: string): Promise<NextResponse | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { planId: true, trialEndsAt: true } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const status = getSubscriptionStatus(user);
  if (status.isBlocked) {
    return NextResponse.json({ error: TRIAL_ENDED_MESSAGE }, { status: 403 });
  }
  return null;
}

/** Same trial/cancelled check as requireActiveSubscription, plus the Starter plan's 5-client cap. null means "allowed, proceed." */
export async function requireClientCapacity(userId: string): Promise<NextResponse | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { planId: true, trialEndsAt: true } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const status = getSubscriptionStatus(user);
  if (status.isBlocked) {
    return NextResponse.json({ error: TRIAL_ENDED_MESSAGE }, { status: 403 });
  }

  if (status.clientLimit !== null) {
    const clientCount = await prisma.client.count({ where: { userId } });
    if (clientCount >= status.clientLimit) {
      return NextResponse.json(
        {
          error: `The Starter plan is limited to ${status.clientLimit} client accounts. Upgrade to Professional for unlimited clients.`,
        },
        { status: 403 },
      );
    }
  }
  return null;
}
