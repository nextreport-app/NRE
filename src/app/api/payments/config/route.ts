import { NextResponse } from "next/server";
import { isRazorpaySubscriptionsConfigured } from "@/lib/razorpay-subscriptions";

/** Public billing mode hint for SubscribeButton — no secrets exposed. */
export async function GET() {
  return NextResponse.json({
    subscriptionsEnabled: isRazorpaySubscriptionsConfigured(),
  });
}
