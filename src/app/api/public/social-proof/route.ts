import { NextResponse } from "next/server";
import { getSocialProofStats } from "@/lib/social-proof-stats";

export const dynamic = "force-dynamic";

export async function GET() {
  const stats = await getSocialProofStats();
  if (!stats) {
    return NextResponse.json({ enabled: false as const }, { headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json(
    { enabled: true as const, ...stats },
    { headers: { "Cache-Control": "no-store" } },
  );
}
