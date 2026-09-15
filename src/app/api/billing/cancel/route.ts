import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiErrorResponse } from "@/lib/api-error";
import { cancelRazorpaySubscription } from "@/lib/razorpay-subscriptions";

/**
 * Cancels paid access. When User.razorpaySubscriptionId is set, calls
 * Razorpay's Subscriptions cancel API (immediate). Legacy one-time Orders
 * subscribers only get a local planId change — no Razorpay object exists.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { razorpaySubscriptionId: true },
    });

    if (user?.razorpaySubscriptionId) {
      await cancelRazorpaySubscription(user.razorpaySubscriptionId, false);
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { planId: "cancelled", razorpaySubscriptionId: null },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err, "billing:cancel");
  }
}
