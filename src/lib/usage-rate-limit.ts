import { getSubscriptionStatus } from "./subscription";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "./prisma";

/** Durable fixed-window buckets: an in-memory Map cannot protect multiple Vercel instances. */
export async function takeRateLimit(scope: string, subject: string, limit: number, windowSeconds: number): Promise<boolean> {
  const start = Math.floor(Date.now() / (windowSeconds * 1000)) * windowSeconds * 1000;
  const key = createHash("sha256").update(`${scope}:${subject}:${start}`).digest("hex");
  const expiresAt = new Date(start + windowSeconds * 1000);
  const [row] = await prisma.$queryRaw<{ hits: number }[]>`
    INSERT INTO "UsageBucket" ("key", "hits", "expiresAt") VALUES (${key}, 1, ${expiresAt})
    ON CONFLICT ("key") DO UPDATE SET "hits" = "UsageBucket"."hits" + 1 RETURNING "hits"`;
  return row.hits <= limit;
}

export function requestAddress(req: Request): string {
  // Use the platform-authenticated forwarding header in production; never trust caller X-Forwarded-For there.
  return process.env.VERCEL ? req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || "unknown" : "local";
}

export async function enforceRateLimit(scope: string, subject: string, limit: number, windowSeconds: number): Promise<NextResponse | null> {
  try {
    if (await takeRateLimit(scope, subject, limit, windowSeconds)) return null;
    return NextResponse.json({ error: "Too many requests. Please wait and try again." }, { status: 429, headers: { "Retry-After": String(windowSeconds) } });
  } catch (err) {
    console.error("[usage-limit] unavailable", err);
    return NextResponse.json({ error: "Service temporarily unavailable. Please try again shortly." }, { status: 503 });
  }
}

/** Bound pre-generation CPU/storage too; generation-only limits cannot protect repeated uploads. */
export async function enforceWizardLimits(userId: string, kind: "upload" | "work" = "work") {
  const minute = await enforceRateLimit("wizard-work", userId, 30, 60);
  if (minute) return minute;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { planId: true, email: true, emailVerified: true, paidThrough: true, trialEndsAt: true } });
  const trial = user ? getSubscriptionStatus(user).isTrialing : true;
  return enforceRateLimit(`wizard-${kind}-day`, userId, kind === "upload" ? (trial ? 20 : 100) : (trial ? 120 : 1000), 86400);
}
