"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type PlanId = "starter" | "professional";

const RAZORPAY_CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

const PLAN_NAMES: Record<PlanId, string> = {
  starter: "Starter",
  professional: "Professional",
};

interface RazorpaySuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayCheckoutOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill?: { name?: string; email?: string };
  theme?: { color?: string };
  handler: (response: RazorpaySuccessResponse) => void;
  modal?: { ondismiss?: () => void };
}

interface RazorpayCheckoutInstance {
  open: () => void;
  on: (event: "payment.failed", handler: (response: { error?: { description?: string } }) => void) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayCheckoutInstance;
  }
}

/** Loads Razorpay's Checkout script once and caches the in-flight promise so concurrent Subscribe clicks don't inject the tag twice. */
let razorpayScriptPromise: Promise<boolean> | null = null;
function loadRazorpayCheckout(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  if (razorpayScriptPromise) return razorpayScriptPromise;

  razorpayScriptPromise = new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${RAZORPAY_CHECKOUT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
      return;
    }
    const script = document.createElement("script");
    script.src = RAZORPAY_CHECKOUT_SRC;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
  return razorpayScriptPromise;
}

export function SubscribeButton({
  planId,
  label,
  className,
  loggedIn,
  userEmail,
  userName,
}: {
  planId: PlanId;
  /** Defaults to "Subscribe" — callers pass e.g. "Upgrade to Professional" for the upgrade-prompt/billing contexts. */
  label?: string;
  className?: string;
  /** Anonymous visitors (this button also renders on the public /pricing page) get sent to log in first rather than hitting a 401 from create-order. */
  loggedIn: boolean;
  userEmail?: string | null;
  userName?: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (!loggedIn) {
      router.push(`/login?callbackUrl=${encodeURIComponent("/pricing")}`);
      return;
    }

    setError(null);
    setLoading(true);

    const scriptReady = await loadRazorpayCheckout();
    if (!scriptReady || !window.Razorpay) {
      setError("Could not load the payment form. Check your connection and try again.");
      setLoading(false);
      return;
    }

    let orderData: { order_id: string; amount: number; currency: string; planId: PlanId };
    try {
      const orderRes = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const data = await orderRes.json();
      if (!orderRes.ok) {
        setError(data.error || "Could not start checkout. Please try again.");
        setLoading(false);
        return;
      }
      orderData = data;
    } catch {
      setError("Could not reach the server to start checkout. Please try again.");
      setLoading(false);
      return;
    }

    const razorpay = new window.Razorpay({
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "",
      amount: orderData.amount,
      currency: orderData.currency,
      name: "NextReport",
      description: `${PLAN_NAMES[planId]} plan — monthly subscription`,
      order_id: orderData.order_id,
      prefill: { name: userName ?? undefined, email: userEmail ?? undefined },
      theme: { color: "#4a90d9" },
      handler: async (response) => {
        try {
          const verifyRes = await fetch("/api/payments/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...response, planId }),
          });
          const verifyData = await verifyRes.json();
          if (!verifyRes.ok || !verifyData.success) {
            setError(verifyData.error || "Payment verification failed. Please contact support before trying again.");
            setLoading(false);
            return;
          }
          router.push("/dashboard");
        } catch {
          setError("Payment succeeded but we could not verify it. Please contact support.");
          setLoading(false);
        }
      },
      modal: {
        // The user closed the checkout modal without paying — not an
        // error, just back to normal.
        ondismiss: () => setLoading(false),
      },
    });

    razorpay.on("payment.failed", (response) => {
      setError(response.error?.description || "Payment failed. Please try again or use a different payment method.");
      setLoading(false);
    });

    razorpay.open();
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={className ?? "rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60"}
      >
        {loading ? "Redirecting…" : (label ?? `Subscribe to ${PLAN_NAMES[planId]}`)}
      </button>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
