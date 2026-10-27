import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiErrorResponse } from "@/lib/api-error";
import { cancelRazorpaySubscription } from "@/lib/razorpay-subscriptions";

/** Stop future renewal while preserving the paid-through period. */
export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { razorpaySubscriptionId: true },
    });

    if (user?.razorpaySubscriptionId) {
      await cancelRazorpaySubscription(user.razorpaySubscriptionId, true);
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { razorpaySubscriptionId: null },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err, "billing:cancel");
  }
}
