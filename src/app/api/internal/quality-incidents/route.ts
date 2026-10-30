import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { qualityAgentAuthorized } from "@/lib/quality-agents/incident-policy";

/** Redacted operational feed only. Customer records, identifiers and attachments are never returned. */
export async function GET(request: Request) {
  const secret = process.env.QUALITY_AGENT_READ_TOKEN;
  const headers = { "Cache-Control": "private, no-store" };
  if (!secret || secret.length < 32) return NextResponse.json({ error: "Quality feed is not configured." }, { status: 503, headers });
  if (!qualityAgentAuthorized(request, secret)) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  const cursor = new URL(request.url).searchParams.get("cursor");
  if (cursor && !/^c[a-z0-9]{15,40}$/.test(cursor)) return NextResponse.json({ error: "Invalid cursor." }, { status: 400, headers });
  const incidents = await prisma.reportQualityIncident.findMany({
    where: { lastSeenAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 100,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: { id: true, kind: true, platform: true, reportType: true, signalCodes: true, occurrences: true, revision: true, createdAt: true, lastSeenAt: true },
  });
  return NextResponse.json({ incidents, nextCursor: incidents.length === 100 ? incidents[99].id : null }, { headers });
}
